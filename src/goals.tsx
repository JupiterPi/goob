import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc, Id } from "../convex/_generated/dataModel";
import { useNavigate, useParams } from "react-router";
import { BackButton } from "./App";
import { CopyButton, useEphemeral } from "./util";
import { CommitmentCardResult } from "./commitments";
import { useState } from "react";

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

export function GoalCard({ goal, viewable, children }: { goal: Doc<"goals">, viewable?: boolean, children?: React.ReactNode }) {
    const navigate = useNavigate();
    const viewGoal = () => {
        navigate(`/goal/${goal._id}`);
    }
    return <div className="_card">
        <h3 className="text-xl font-bold mb-2 inline-flex justify-between">
            {goal.title}
            {viewable && <button className="_button px-3! py-1!" onClick={viewGoal}>Open</button>}
        </h3>
        <p className="mb-3">{goal.description}</p>
        <div className="flex flex-col gap-2">
            {children}
        </div>
    </div>
}

export function GoalCardShortCommitmentButtons({ goal }: { goal: Doc<"goals"> }) {
    // todo: it doesn't make sense to keep when a commitment already exists for this goal
    const createCommitment = useMutation(api.functions.createCommitment);
    const createShortCommitment = (goal: Doc<"goals">, duration: number) => {
        createCommitment({
            goalId: goal._id,
            due: Date.now() + duration,
        })
    }
    const createCustomCommitment = () => {
        const minutesStr = prompt("Enter commitment duration in minutes:");
        if (!minutesStr) return;
        const minutes = parseInt(minutesStr);
        if (isNaN(minutes) || minutes <= 0) {
            alert("Invalid duration");
            return;
        }
        createCommitment({
            goalId: goal._id,
            due: Date.now() + minutes * 60 * 1000,
        });
    }
    return <div className="flex -space-x-px">
        <button className="_button bg-amber-200 border-e-1! rounded-e-none! pe-3!" onClick={() => createShortCommitment(goal, 5 * 1000)}>5s</button>
        <button className="_button bg-amber-200 border-e-1! rounded-e-none! pe-3! rounded-s-none! ps-3!" onClick={() => createShortCommitment(goal, 30 * 1000)}>30s</button>
        <button className="_button bg-amber-200 border-e-1! rounded-e-none! pe-3! rounded-s-none! ps-3!" onClick={() => createShortCommitment(goal, 60 * 1000)}>1m</button>
        <button className="_button bg-amber-200 border-e-1! rounded-e-none! pe-3! rounded-s-none! ps-3!" onClick={() => createShortCommitment(goal, 5 * 60 * 1000)}>5m</button>
        <button className="_button bg-amber-200 border-e-1! rounded-e-none! pe-3! rounded-s-none! ps-3!" onClick={() => createShortCommitment(goal, 10 * 60 * 1000)}>10m</button>
        <button className="_button bg-amber-200 rounded-s-none! ps-3!" onClick={createCustomCommitment}>+</button>
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

export function GoalPage() {
    // todo: show that goal is acrhived

    const params = useParams<{ goalId: string }>();
    const goalId = params.goalId as Id<"goals">;
    const goal = useQuery(api.functions.getGoalPublic, { goalId });
    const commitments = goal?.commitments;

    const [showCompletionKeySection, setShowCompletionKeySection] = useState(false);

    return <div className="flex flex-col gap-3">
        <BackButton />

        <div><b>{goal?.isOwn ? "Your" : `${goal?.ownerName}'s`}</b> Goal:</div>

        {!goal && <div>Loading...</div>}
        {goal && <GoalCard goal={goal.goal}>
            {goal.isOwn && <GoalCardActionButtons goal={goal.goal} />}
        </GoalCard>}

        {goal?.isOwn && !showCompletionKeySection && <>
            <button className="_button" onClick={() => setShowCompletionKeySection(true)}>&gt; Completion Key Options</button>
        </>}
        {goal?.isOwn && showCompletionKeySection && <>
            <button className="_button" onClick={() => setShowCompletionKeySection(false)}>(minimize)</button>
            <CompletionKeySection goal={goal.goal} />
        </>}

        <h2 className="mt-6">Timeline</h2>
        {!commitments && <div>Loading commitments...</div>}
        {commitments && commitments.length === 0 && <div>No commitments yet.</div>}
        {commitments && commitments.length > 0 && <div className="flex flex-col gap-2">
            {commitments.sort((a, b) => -(a.due - b.due)).map(commitment => <CommitmentCardResult key={commitment._id.toString()} commitment={commitment} />)}
        </div>}
    </div>
}

function GoalCardActionButtons({ goal }: { goal: Doc<"goals"> }) {
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

function CompletionKeySection({ goal }: { goal: Doc<"goals"> }) {
    const user = useQuery(api.functions.getUserInfo);
    const completionKey = useQuery(api.functions.getCompletionKey, { completionKeyId: goal.completionKey });

    const [wasJustCopied, setWasJustCopied] = useEphemeral(false, 2000);
    const copyCompletionLink = () => {
        if (!goal) return;
        // todo: make it actually show up in timeline
        if (!window.confirm("This action will show up in your timeline. Are you sure?")) return;
        if (!completionKey) return;
        navigator.clipboard.writeText(`${window.location.origin}/complete/${completionKey.key}`);
        setWasJustCopied(true);
    }

    const setGoalCompletionKey = useMutation(api.functions.setGoalCompletionKey);
    const regenerateCompletionKey = async () => {
        const confirm = window.confirm("Regenerating the completion key will invalidate the previous key. Are you sure?");
        if (!confirm) return;
        await setGoalCompletionKey({
            goalId: goal._id,
            completionKey: undefined,
        });
    }
    const importSharedKey = () => {
        const sharedKey = prompt("Enter shared completion key:");
        if (!sharedKey) return;
        setGoalCompletionKey({
            goalId: goal._id,
            completionKey: sharedKey as Id<"completionKeys">,
        });
    }

    const renameCompletionKey = useMutation(api.functions.renameCompletionKey);
    const renameThisCompletionKey = async () => {
        const newName = prompt("Enter new name for completion key:", completionKey?.name);
        if (!newName) return;
        await renameCompletionKey({
            completionKeyId: goal.completionKey,
            name: newName,
        });
    }

    return (
        <div className="flex flex-col items-start gap-3 mt-4">
            <h2 className="mb-0!">Completion Key</h2>
            <p>Key: <b>{completionKey?.name}</b></p>
            <div className="flex gap-2">
                <button className="_button" onClick={regenerateCompletionKey}>Reset</button>
                {completionKey?.creator === user?._id && <button className="_button" onClick={renameThisCompletionKey}>Rename</button>}
            </div>
            <div className="flex gap-2">
                <CopyButton label="Share" onCopy={() => completionKey?._id ?? ""} />
                <button className="_button" onClick={importSharedKey}>Import Shared Key</button>
            </div>
            <button className="_button" onClick={copyCompletionLink}>{wasJustCopied ? "Copied!" : "Copy Completion Link"}</button>
            <p>Open this link to complete a commitment for this goal.</p>
        </div>
    )
}