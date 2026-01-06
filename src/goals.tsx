import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc, Id } from "../convex/_generated/dataModel";
import { useParams } from "react-router";
import { BackButton } from "./App";
import classNames from "classnames";
import { useTimer } from "./util";

export function CreateSampleGoalButton() {
    const createGoal = useMutation(api.functions.createGoal);
    const createSampleGoal = async () => {
        await createGoal({
            title: "Get Out Of Bed",
            description: "Wake up and start your day, without hitting snooze!",
        })
    }
    return (
        <button onClick={createSampleGoal} className="_button">
            Create Sample Goal
        </button>
    )
}

function promptForGoalDetails(): { title: string; description: string } | null {
    const title = prompt("Enter goal title:");
    if (!title) return null;
    const description = prompt("Enter goal description:");
    if (!description) return null;
    return { title, description }
}

export function GoalCard({ goal, children }: { goal: Doc<"goals">, children?: React.ReactNode }) {
    return <div className="_card">
        <h3 className="text-xl font-bold mb-2">{goal.title}</h3>
        <p className="mb-3">{goal.description}</p>
        <div className="flex flex-col gap-2">
            {children}
        </div>
    </div>
}

export function GoalCardShortCommitmentButtons({ goal }: { goal: Doc<"goals"> }) {
    const createCommitment = useMutation(api.functions.createCommitment);
    const shortCommitmentIntervals = {
        "5s": 5 * 1000,
        "30s": 30 * 1000,
        "1min": 60 * 1000,
        "2min": 2 * 60 * 1000,
        "5min": 5 * 60 * 1000,
    }
    const createShortCommitment = (goal: Doc<"goals">, intervalSelection: keyof typeof shortCommitmentIntervals) => {
        const due = Date.now() + shortCommitmentIntervals[intervalSelection];
        createCommitment({
            goalId: goal._id,
            due: due,
        })
    }
    return <div className="flex gap-2">{Object.keys(shortCommitmentIntervals).map(intervalSelection =>
        <button key={intervalSelection} className="_button" onClick={() => createShortCommitment(goal, intervalSelection as keyof typeof shortCommitmentIntervals)}>
            {intervalSelection}
        </button>
    )}</div>
}

export function GoalCardActionButtons({ goal }: { goal: Doc<"goals"> }) {
    const updateGoal = useMutation(api.functions.updateGoal);
    const editGoal = () => {
        const details = promptForGoalDetails();
        if (!details) return;
        updateGoal({
            goalId: goal._id,
            title: details.title,
            description: details.description,
        })
    }
    const archiveGoal = () => {
        const confirm = window.confirm("Are you sure you want to archive this goal?");
        if (!confirm) return;
        updateGoal({
            goalId: goal._id,
            archived: true,
        })
    }

    return (
        <div className="flex gap-2">
            <button className="_button" onClick={editGoal}>Edit</button>
            <button className="_button" onClick={archiveGoal}>Archive</button>
        </div>
    )
}

export function CreateGoalButton() {
    const createGoal = useMutation(api.functions.createGoal);
    const createNewGoal = async () => {
        const details = promptForGoalDetails();
        if (!details) return;
        await createGoal({
            title: details.title,
            description: details.description,
        })
    }
    return (
        <button onClick={createNewGoal} className="_button">
            Create New Goal
        </button>
    )
}

export function GoalPage() {
    const params = useParams<{ goalId: string }>();
    const goalId = params.goalId as Id<"goals">;
    const goal = useQuery(api.functions.getGoalPublic, { goalId });

    const commitments = goal?.commitments?.sort((a, b) => -(a.due - b.due)); // newest due first
    const now = useTimer();

    return <div className="flex flex-col gap-3">
        <BackButton />

        <div><b>{goal?.isOwn ? "Your" : `${goal?.ownerName}'s`}</b> Goal:</div>

        {!goal && <div>Loading...</div>}
        {goal && <GoalCard goal={goal.goal}>{goal.isOwn && <GoalCardActionButtons goal={goal.goal} />}</GoalCard>}

        <h2 className="mt-6">Commitments</h2>
        {!commitments && <div>Loading commitments...</div>}
        {commitments && commitments.length === 0 && <div>No commitments yet.</div>}
        {commitments && commitments.length > 0 && <div className="flex flex-col gap-2">
            {commitments.map(commitment => {
                const status = commitment.completedAt ? "completed" : commitment.cancelled ? "cancelled" : commitment.due < now ? "failed" : "pending";
                return (
                    <div key={commitment._id.toString()} className={classNames("_card flex-row! justify-between items-center py-3! pe-3!", {
                        "bg-green-300": status === "completed",
                        "bg-orange-300": status === "cancelled",
                        "bg-red-300": status === "failed",
                        "bg-amber-200": status === "pending",
                    })}>
                        <div>{new Date(Number(commitment.due)).toLocaleString()}</div>
                        <div>{status.charAt(0).toUpperCase() + status.slice(1)}</div>
                    </div>
                )
            })}
        </div>}
    </div>
}