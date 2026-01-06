import { useMutation, useQuery } from "convex/react";
import { Doc } from "../convex/_generated/dataModel";
import { useTimer } from "./util";
import { api } from "../convex/_generated/api";
import { useParams } from "react-router";
import classNames from "classnames";
import { useEffect, useState } from "react";

export function CommitmentCard({ goal, commitment }: { goal: Doc<"goals">, commitment: Doc<"commitments"> }) {
    const now = useTimer();

    // format time remaining as HH:MM:SS
    const timeRemaining = commitment.due - now;
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    const timeRemainingStr = timeRemaining < 0 ? "00:00:00" : `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    const cancelCommitment = useMutation(api.functions.cancelCommitment);
    const cancelThisCommitment = () => {
        const reason = prompt("Enter reason for cancelling this commitment:");
        if (!reason) return;
        cancelCommitment({
            commitmentId: commitment._id,
            reason,
        })
    }

    return (
        <div className="_card bg-amber-200 justify-between flex-row!">
            <div className="flex flex-col items-start gap-1.5">
                <b className="text-md">{goal.title}</b>
                <button className="_button px-2! py-1! border-2! border-gray-700! bg-amber-100! hover:bg-amber-50!" onClick={cancelThisCommitment}>Cancel</button>
                {/* todo: allow cancelling without reason up to 10s after creation, reflect in button "undo" */}
            </div>
            <div className="flex justify-end">
                <b className="text-md text-3xl">{timeRemainingStr}</b>
            </div>
        </div>
    )
}

export function CommitmentCardResult({ commitment }: { commitment: Doc<"commitments"> }) {
    const now = useTimer();
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
    );
}

export function CompleteCommitmentsPage() {
    const { key } = useParams<{ key: string }>();
    const completeCommitment = useMutation(api.functions.completeCommitment);

    const [numberOfCompletions, setNumberOfCompletions] = useState<number | null>(null);
    useEffect(() => {
        if (!key) return;
        completeCommitment({ key }).then(result => {
            if (result && typeof result.completed === "number") {
                setNumberOfCompletions(n => (n ?? 0) + result.completed);
            }
        });
    }, [key]);

    const recentCommitments = useQuery(api.functions.getRecentCommitments);

    return (
        <div className="flex flex-col gap-3">
            <div className={classNames("_card text-center rounded-full! border-1! shadow-lg!", { "bg-green-300": numberOfCompletions !== null && numberOfCompletions > 0, "bg-red-300": numberOfCompletions === 0 })}>
                {numberOfCompletions !== null ? `Completed ${numberOfCompletions} commitments` : "Completing commitments..."}
            </div>

            <h2 className="mt-6">Recent Commitments</h2>
            {!recentCommitments && <div>Loading commitments...</div>}
            {recentCommitments && recentCommitments.length === 0 && <div>No recent commitments yet.</div>}
            {recentCommitments && recentCommitments.length > 0 && <div className="flex flex-col gap-2">
                {recentCommitments.sort((a, b) => -(a.due - b.due)).map(commitment => <CommitmentCardResult key={commitment._id.toString()} commitment={commitment} />)}
            </div>}
        </div>
    );
}