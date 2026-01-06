import { useQuery } from "convex/react"
import { api } from "../convex/_generated/api";
import { CreateGoalButton, CreateSampleGoalButton, GoalCard, GoalCardShortCommitmentButtons } from "./goals";
import { useTimer } from "./util";
import { CommitmentCard } from "./commitments";
import { YourFriends } from "./friends";

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
            {goals.map(goal => <GoalCard key={goal._id.toString()} goal={goal} viewable={true}><GoalCardShortCommitmentButtons goal={goal} /></GoalCard>)}
            <CreateGoalButton />
        </>}
    </div>
}
