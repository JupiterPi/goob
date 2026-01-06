import { useMutation, useQuery } from "convex/react"
import { api } from "../convex/_generated/api";
import { CreateGoalButton, CreateSampleGoalButton, GoalCard, GoalCardShortCommitmentButtons } from "./goals";
import { useTimer } from "./util";
import { CommitmentCard, CommitmentCardResult } from "./commitments";
import { YourFriends } from "./friends";

export default function Home() {
    return <div className="flex flex-col gap-12">
        <h1 className="text-4xl font-bold text-center mb-4">
            GOOB:<br></br>Get Out Of Bed!
        </h1>

        <PendingCommitmentsAndDashboard />
        <YourGoals />
        <YourFriends />
    </div>
}

function PendingCommitmentsAndDashboard() {
    const oncePendingCommitmentsWithGoals = useQuery(api.functions.getPendingCommitmentsWithGoals);
    const now = useTimer(); // so it rerenders
    const pendingCommitmentsWithGoals = oncePendingCommitmentsWithGoals?.filter(({ commitment }) => {
        // check again that the commitment is still pending, in case it changed since the query was run
        return commitment.completedAt === null && commitment.cancelledAt === null && now <= Number(commitment.due);
    })

    const userInfo = useQuery(api.functions.getUserInfo);
    const commitments = useQuery(api.functions.getDashboardCommitments);
    const commitmentsSortedByDueOrCancellation = commitments?.sort((a, b) => {
        const aTime = a.commitment.cancelledAt ? Number(a.commitment.cancelledAt) : a.commitment.due;
        const bTime = b.commitment.cancelledAt ? Number(b.commitment.cancelledAt) : b.commitment.due;
        return bTime - aTime;
    });

    const unacknowledgedScolds = useQuery(api.functions.getUnacknowledgedScolds);
    const acknowledgeScold = useMutation(api.functions.acknowledgeScold);

    return (pendingCommitmentsWithGoals?.length ?? 0) + (unacknowledgedScolds?.length ?? 0) + (commitmentsSortedByDueOrCancellation?.length ?? 0) > 0 ? <div className="flex flex-col gap-3">
        {pendingCommitmentsWithGoals === undefined && <div>Loading commitments...</div>}
        {pendingCommitmentsWithGoals && pendingCommitmentsWithGoals.map(({ goal, commitment }) =>
            <CommitmentCard key={commitment._id.toString()} goal={goal} commitment={commitment} />
        )}

        {!unacknowledgedScolds && <div>Loading scolds...</div>}
        {unacknowledgedScolds && unacknowledgedScolds.map(scold => (
            <div key={scold._id.toString()} className="_card bg-purple-200 flex flex-col gap-2">
                <div><b>{scold.byName}</b> scolded you for not completing your commitment on <b>{scold.goalTitle}</b>.</div>
                <button className="_button self-end hover:bg-purple-300!" onClick={() => acknowledgeScold({ scoldId: scold._id })}>Feel bad</button>
            </div>
        ))}
        {!commitments && <div>Loading commitments...</div>}
        {commitments && commitments.length > 0 && commitmentsSortedByDueOrCancellation!.map(commitment => (
            <CommitmentCardResult key={commitment.commitment._id.toString()} ownerAndGoal={{ owner: commitment.userId === userInfo?._id ? "self" : commitment.userName, goal: commitment.goal.title }} couldScold={commitment.userId !== userInfo?._id} showCommentButton={commitment.userId === userInfo?._id} commitment={commitment.commitment} />
        ))}
    </div> : <div className="flex justify-center opacity-75 -my-3">Phew, all done!</div>
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
            {goals.map(goal => <GoalCard key={goal._id.toString()} goal={goal} viewable={true}><GoalCardShortCommitmentButtons goal={goal} /></GoalCard>)}
            <CreateGoalButton />
        </>}
    </div>
}
