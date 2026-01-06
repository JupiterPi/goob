import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEphemeral } from "./util";
import { useNavigate, useParams } from "react-router";
import { Id } from "../convex/_generated/dataModel";
import { BackButton } from "./App";
import { GoalCard } from "./goals";

export function YourFriends() {
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

    const navigate = useNavigate();
    const viewFriend = (id: Id<"users">) => {
        navigate(`/friend/${id.toString()}`);
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
                <div key={friend._id.toString()} className="_card flex-row! items-center py-3! pe-3! gap-2">
                    {friend.name}
                    <div className="flex-1"></div>
                    {friend.isMutualFriend && <button className="_button" onClick={() => viewFriend(friend._id)}>Goals</button>}
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

export function FriendPage() {
    const params = useParams<{ friendId: string }>();
    const friendId = params.friendId as Id<"users">;
    const friendInfoAndGoals = useQuery(api.functions.getFriendInfoAndGoals, { friendId });

    return (
        <div className="flex flex-col gap-3">
            <BackButton />
            {!friendInfoAndGoals && <div>Loading...</div>}
            {friendInfoAndGoals && <>
                <h1 className="text-2xl font-bold">{friendInfoAndGoals.name}'s Goals</h1>
                {friendInfoAndGoals.goals.length === 0 && <div>This friend has no goals yet.</div>}
                {friendInfoAndGoals.goals.length > 0 && <div className="flex flex-col gap-2 mt-2">
                    {friendInfoAndGoals.goals.map(goal => (
                        <GoalCard key={goal._id.toString()} goal={goal} viewable={true} ></GoalCard>
                    ))}
                </div>}
            </>}
        </div>
    )
}