import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc } from "../convex/_generated/dataModel";

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

export function GoalCard({ goal }: { goal: Doc<"goals"> }) {
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

    return <div className="_card">
        <h3 className="text-xl font-bold mb-2">{goal.title}</h3>
        <p>{goal.description}</p>
        <div className="flex gap-2 mt-3">
            {Object.keys(shortCommitmentIntervals).map(intervalSelection =>
                <button key={intervalSelection} className="_button" onClick={() => createShortCommitment(goal, intervalSelection as keyof typeof shortCommitmentIntervals)}>
                    {intervalSelection}
                </button>
            )}
        </div>
        <div className="flex gap-2 mt-3">
            <button className="_button" onClick={editGoal}>Edit</button>
            <button className="_button" onClick={archiveGoal}>Archive</button>
        </div>
    </div>
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