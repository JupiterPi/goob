import { useMutation, useQuery } from "convex/react"
import { api } from "../convex/_generated/api";
import { CreateGoalButton, CreateSampleGoalButton, GoalCard } from "./goals";
import { useEphemeral, useTimer } from "./util";
import { CommitmentCard } from "./commitments";
import { Id } from "../convex/_generated/dataModel";

export default function Home() {
    return <div className="flex flex-col gap-12">
        <h1 className="text-4xl font-bold text-center mb-4">
            GOOB:<br></br>Get Out Of Bed!
        </h1>

        <PendingCommitments />
        <YourGoals />
        <YourFriends />
    </div>
}

function PendingCommitments() {
    const oncePendingCommitmentsWithGoals = useQuery(api.functions.getPendingCommitmentsWithGoals);
    const now = useTimer(); // so it rerenders
    const pendingCommitmentsWithGoals = oncePendingCommitmentsWithGoals?.filter(({ commitment }) => {
        // check again that the commitment is still pending, in case it changed since the query was run
        return commitment.completedAt === null && commitment.cancelled === null && now <= Number(commitment.due);
    })

    return <div>
        <h2 className="mb-5!">Active Commitments</h2>
        {pendingCommitmentsWithGoals === undefined && <div>Loading commitments...</div>}
        {pendingCommitmentsWithGoals && pendingCommitmentsWithGoals.length === 0 && <div className="text-center">Phew, all done!</div>}
        {pendingCommitmentsWithGoals && <div className="flex flex-col gap-3">
            {pendingCommitmentsWithGoals.map(({ goal, commitment }) =>
                <CommitmentCard key={commitment._id.toString()} goal={goal} commitment={commitment} />
            )}
        </div>}
    </div>
}

function YourGoals() {
    const goalsAndArchivedGoals = useQuery(api.functions.getGoals);
    const goals = goalsAndArchivedGoals?.filter(goal => !goal.archived) ?? undefined;

    return <div className="flex flex-col gap-3">
        <h2>Your Goals</h2>
        {!goals && <div>Loading goals...</div>}
        {goals && <>
            {goals.length === 0 && <>
                <div>No goals yet. Create one!</div>
                <CreateSampleGoalButton />
            </>}
            {goals.map(goal => <GoalCard key={goal._id.toString()} goal={goal} />)}
            <CreateGoalButton />
        </>}
    </div>
}

function YourFriends() {
    const userInfo = useQuery(api.functions.getUserInfo);
    const friends = useQuery(api.functions.getFriends);

    const changeName = useMutation(api.functions.changeName);
    const editName = () => {
        const newName = prompt("Enter your new name:", userInfo?.name ?? "");
        if (!newName) return;
        changeName({ name: newName });
    }

    const addFriend = useMutation(api.functions.addFriend);
    const enterFriendCode = () => {
        const friendCode = prompt("Enter your friend's code:");
        if (!friendCode) return;
        addFriend({ friendCode }).catch(err => {
            alert(`Error adding friend: ${err.message}`);
        })
    }

    const [wasJustCopied, setWasJustCopied] = useEphemeral(false, 2000);
    const copyFriendInviteLink = () => {
        if (!userInfo) return;
        navigator.clipboard.writeText(userInfo.friendCode);
        setWasJustCopied(true);
    }

    const removeFriend = useMutation(api.functions.removeFriend);
    const removeThisFriend = (id: Id<"users">) => {
        const confirm = window.confirm("Are you sure you want to remove this friend?");
        if (!confirm) return;
        removeFriend({ friendId: id });
    }

    return <div className="flex flex-col gap-3">
        <h2>Your Friends</h2>
        <div className="flex gap-3 items-center">
            Your name: <b>{userInfo?.name ?? "..."}</b>
            <div className="flex-1"></div>
            <button className="_button" onClick={editName}>Edit</button>
        </div>
        {!friends && <div>Loading friends...</div>}
        {friends && friends.length === 0 && <div className="mb-3">You have no friends yet.</div>}
        {friends && friends.length > 0 && <div className="flex flex-col gap-2">
            {friends.map(friend => (
                <div key={friend._id.toString()} className="_card flex-row! justify-between items-center py-3! pe-3!">
                    {friend.name}
                    <button className="_button" onClick={() => removeThisFriend(friend._id)}>Remove</button>
                </div>
            ))}
        </div>}
        <div className="flex gap-3">
            <button className="_button flex-1" onClick={enterFriendCode}>Add Friend</button>
            <button className="_button flex-1" onClick={copyFriendInviteLink}>{wasJustCopied ? "Copied!" : "Copy Friend Code"}</button>
        </div>
    </div>
}