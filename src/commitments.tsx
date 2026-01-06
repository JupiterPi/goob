import { useMutation } from "convex/react";
import { Doc } from "../convex/_generated/dataModel";
import { useTimer } from "./util";
import { api } from "../convex/_generated/api";

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
            </div>
            <div className="flex justify-end">
                <b className="text-md text-3xl">{timeRemainingStr}</b>
            </div>
        </div>
    )
}