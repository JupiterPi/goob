import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc, Id } from "../convex/_generated/dataModel";
import { useNavigate, useParams } from "react-router";
import { BackButton } from "./App";
import { useEphemeral } from "./util";
import { CommitmentCardResult } from "./commitments";

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
    // todo: it doesn't make sense to keep when a commitment alraedy exists for this goal
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

export function GoalCardViewButton({ goal }: { goal: Doc<"goals"> }) {
    const navigate = useNavigate();
    const viewGoal = (goalId: Id<"goals">) => {
        navigate(`/goal/${goalId.toString()}`);
    }
    return <button className="_button" onClick={() => viewGoal(goal._id)}>View</button>
}

export function GoalCardActionButtons({ goal, showViewButton }: { goal: Doc<"goals">, showViewButton?: boolean }) {
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
            {showViewButton && <GoalCardViewButton goal={goal} />}
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
    const commitments = goal?.commitments;

    const [wasJustCopied, setWasJustCopied] = useEphemeral(false, 2000);
    const copyCompletionLink = () => {
        if (!goal) return;
        navigator.clipboard.writeText(`${window.location.origin}/complete/${goal.goal.key}`);
        setWasJustCopied(true);
    }
    // todo: only show compltion key once when creating goal, or show it on the timeline for others to see

    return <div className="flex flex-col gap-3">
        <BackButton />

        <div><b>{goal?.isOwn ? "Your" : `${goal?.ownerName}'s`}</b> Goal:</div>

        {!goal && <div>Loading...</div>}
        {goal && <GoalCard goal={goal.goal}>{goal.isOwn && <GoalCardActionButtons goal={goal.goal} />}</GoalCard>}

        {goal?.isOwn && (
            <div className="flex flex-col items-start gap-3 mt-4">
                <h2 className="mb-0!">Completion Link</h2>
                <p>Open the following link to complete a commitment for this goal:</p>
                <button className="_button" onClick={copyCompletionLink}>{wasJustCopied ? "Copied!" : "Copy Completion Link"}</button>
            </div>
        )}

        <h2 className="mt-6">Commitments</h2>
        {!commitments && <div>Loading commitments...</div>}
        {commitments && commitments.length === 0 && <div>No commitments yet.</div>}
        {commitments && commitments.length > 0 && <div className="flex flex-col gap-2">
            {commitments.sort((a, b) => -(a.due - b.due)).map(commitment => <CommitmentCardResult key={commitment._id.toString()} commitment={commitment} />)}
        </div>}
    </div>
}