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

    const undoCommitment = useMutation(api.functions.undoCommitment);
    const cancelCommitment = useMutation(api.functions.cancelCommitment);
    const undoPeriod = useQuery(api.functions.getCommitmentUndoPeriod);
    const canUndoCommitment = undoPeriod !== undefined && (Date.now() - Number(commitment._creationTime)) <= undoPeriod.durationMs;
    const undoOrCancelCommitment = () => {
        if (canUndoCommitment) {
            undoCommitment({ commitmentId: commitment._id });
        } else {
            const reason = prompt("Enter reason for cancelling this commitment:");
            if (!reason) return;
            cancelCommitment({
                commitmentId: commitment._id,
                reason,
            })
        }
    }

    return (
        <div className="_card bg-amber-200 justify-between flex-row!">
            <div className="flex flex-col items-start gap-1.5">
                <b className="text-md">{goal.title}</b>
                <button className="_button px-2! py-1! border-2! border-gray-700! bg-amber-100! hover:bg-amber-50!" onClick={undoOrCancelCommitment}>{canUndoCommitment ? "Undo" : "Cancel"}</button>
            </div>
            <div className="flex justify-end">
                <b className="text-md text-3xl">{timeRemainingStr}</b>
            </div>
        </div>
    )
}

export function CommitmentCardResult({ ownerAndGoal, couldScold, showCommentButton, commitment }: { ownerAndGoal: { owner: string | "self", goal: string } | undefined, couldScold: boolean, showCommentButton: boolean, commitment: Doc<"commitments"> }) {
    const now = useTimer();
    const status = commitment.completedAt ? "completed" : commitment.cancelledAt ? "cancelled" : commitment.due < now ? "failed" : "pending";

    const commentOnCommitment = useMutation(api.functions.commentOnCommitment);
    const comment = () => {
        const comment = prompt("Enter your comment for this commitment:", commitment.comment ?? "");
        if (comment === null) return;
        commentOnCommitment({ commitmentId: commitment._id, comment });
    }

    const userInfo = useQuery(api.functions.getUserInfo);
    const scoldCommitment = useMutation(api.functions.scoldCommitment);
    const scold = () => {
        scoldCommitment({ commitmentId: commitment._id });
    }

    return (
        <div key={commitment._id.toString()} className={classNames("_card py-3! pe-3! flex flex-col items-stretch", {
            "bg-green-300": status === "completed",
            "bg-orange-300": status === "cancelled",
            "bg-red-300": status === "failed",
            "bg-amber-200": status === "pending",
        })}>
            {ownerAndGoal && <div className="">
                {ownerAndGoal.owner === "self" ? <b>Your</b> : <><b>{ownerAndGoal.owner}</b>'s</>} goal: <b>{ownerAndGoal.goal}</b>
            </div>}
            <div className="flex justify-between items-center">
                <div>{new Date(Number(commitment.due)).toLocaleString()}</div>
                <div>{status.charAt(0).toUpperCase() + status.slice(1)}</div>
            </div>
            <div className={classNames("flex text-sm items-center gap-2", { "justify-end": !commitment.comment })}>
                {commitment.comment && <div className="italic">&bdquo;{commitment.comment}&rdquo;</div>}
                {showCommentButton && (status === "cancelled" || status === "failed") &&
                    <button className="_button px-2! py-1! text-xs! mt-1 hover:bg-amber-100!" onClick={comment}>{commitment.comment ? "Edit" : "Comment"}</button>
                }
            </div>
            {couldScold && userInfo && !commitment.scoldedBy.includes(userInfo._id) && (status === "failed" || status === "cancelled") && (
                <div className="flex justify-end">
                    <button className="_button hover:bg-amber-100! mt-2" onClick={scold}>Scold</button>
                </div>
            )}
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
            if (result && typeof result.commitmentsCompleted === "number") {
                setNumberOfCompletions(n => (n ?? 0) + result.commitmentsCompleted);
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
                {recentCommitments.sort((a, b) => -(a.due - b.due)).map(commitment => <CommitmentCardResult key={commitment._id.toString()} ownerAndGoal={undefined} couldScold={false} showCommentButton={false} commitment={commitment} />)}
            </div>}
        </div>
    );
}