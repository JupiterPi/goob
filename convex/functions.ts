import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export const storeUser = mutation({
    args: {},
    handler: async (ctx) => {
        const id = await ctx.auth.getUserIdentity();
        if (!id) {
            throw new Error("No user identity");
        }

        const user = await ctx.db.query("users").withIndex("by_tokenIdentifier", q => q.eq("tokenIdentifier", id.tokenIdentifier)).unique();
        if (user !== null) {
            if (user.name !== id.name) {
                // name has changed
                await ctx.db.patch(user._id, { name: id.name });
            }
            return user._id;
        }

        return await ctx.db.insert("users", {
            name: id.name ?? "Anonymous",
            tokenIdentifier: id.tokenIdentifier,
            friends: [],
            goals: [],
        })
    }
})

async function getUser(ctx: QueryCtx) {
    const id = await ctx.auth.getUserIdentity();
    if (!id) {
        throw new Error("No user identity");
    }

    const user = await ctx.db.query("users").withIndex("by_tokenIdentifier", q =>
        q.eq("tokenIdentifier", id.tokenIdentifier)
    ).unique();
    if (!user) {
        throw new Error("User not found");
    }

    return user;
}

export const getUserInfo = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUser(ctx);
        return {
            _id: user._id,
            name: user.name,
            friendCode: user._id.toString(),
        };
    }
})

export const changeName = mutation({
    args: {
        name: v.string(),
    },
    handler: async (ctx, { name }) => {
        const user = await getUser(ctx);
        await ctx.db.patch(user._id, { name });
    }
})

export const getFriends = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUser(ctx);
        const friends = await Promise.all(user.friends.map(async friendId => {
            const friend = await ctx.db.get(friendId);
            if (!friend) {
                return null;
            }
            return {
                _id: friend._id,
                name: friend.name,
            };
        }));
        return friends.filter((f): f is Doc<"users"> => f !== null);
    }
})

export const addFriend = mutation({
    args: {
        friendCode: v.string(),
    },
    handler: async (ctx, { friendCode }) => {
        const user = await getUser(ctx);
        const friend = await ctx.db.get(friendCode as Id<"users">);
        if (!friend) {
            throw new Error("Friend not found");
        }
        if (user._id === friend._id) {
            throw new Error("Cannot add yourself as a friend");
        }
        if (user.friends.includes(friend._id)) {
            throw new Error("Already friends");
        }

        await ctx.db.patch(user._id, {
            friends: [...user.friends, friend._id],
        });
    }
})

export const removeFriend = mutation({
    args: {
        friendId: v.id("users"),
    },
    handler: async (ctx, { friendId }) => {
        const user = await getUser(ctx);
        if (!user.friends.includes(friendId)) {
            throw new Error("Not friends");
        }

        await ctx.db.patch(user._id, {
            friends: user.friends.filter(f => f !== friendId),
        });
    }
})

export const createGoal = mutation({
    args: {
        title: v.string(),
        description: v.string(),
    },
    handler: async (ctx, { title, description }) => {
        const user = await getUser(ctx);
        return await ctx.db.insert("goals", {
            owner: user._id,
            title,
            description,
            commitments: [],
            hide: false,
            archived: false,
        })
    }
})

export const getGoals = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUser(ctx);
        return await ctx.db.query("goals").withIndex("by_owner", q =>
            q.eq("owner", user._id)
        ).collect();
    }
})

async function getOwnedGoal(ctx: QueryCtx, goalId: Id<"goals">, checkUnarchived = true) {
    const user = await getUser(ctx);
    const goal = await ctx.db.get(goalId);
    if (!goal) {
        throw new Error("Goal not found");
    }
    if (goal.owner !== user._id) {
        throw new Error("Not your goal");
    }
    if (checkUnarchived && goal.archived) {
        throw new Error("Goal is archived");
    }
    return goal;
}

export const updateGoal = mutation({
    args: {
        goalId: v.id("goals"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        hide: v.optional(v.boolean()),
        archived: v.optional(v.boolean()),
    },
    handler: async (ctx, { goalId, title, description, hide, archived }) => {
        const goal = await getOwnedGoal(ctx, goalId, false);
        await ctx.db.patch(goalId, {
            title: title ?? goal.title,
            description: description ?? goal.description,
            hide: hide ?? goal.hide,
            archived: archived ?? goal.archived,
        });
    }
})

export const createCommitment = mutation({
    args: {
        goalId: v.id("goals"),
        due: v.number(),
    },
    handler: async (ctx, { goalId, due }) => {
        const goal = await getOwnedGoal(ctx, goalId);

        // due must be an integer
        if (!Number.isInteger(due)) {
            throw new Error("Due date must be an integer");
        }

        // due must be in the future
        if (due <= BigInt(Date.now())) {
            throw new Error("Due date must be in the future");
        }

        const commitmentId = await ctx.db.insert("commitments", {
            goal: goal._id,
            due,
            completedAt: null,
            cancelled: null,
        });

        await ctx.db.patch(goalId, {
            commitments: [...goal.commitments, commitmentId],
        });

        return commitmentId;
    }
})

function assertCommitmentIsPending(commitment: Doc<"commitments">) {
    if (commitment.completedAt !== null) {
        throw new Error("Commitment already completed");
    }
    if (commitment.cancelled !== null) {
        throw new Error("Commitment already cancelled");
    }
    if (Date.now() > Number(commitment.due)) {
        throw new Error("Commitment overdue");
    }
}

export const getPendingCommitmentsWithGoals = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUser(ctx);
        const goals = await ctx.db.query("goals").withIndex("by_owner", q =>
            q.eq("owner", user._id)
        ).collect();
        return (await Promise.all(goals.flatMap(goal =>
            Promise.all(goal.commitments.map(async commitmentId => {
                const commitment = await ctx.db.get(commitmentId);
                if (!commitment) {
                    return null;
                }
                try {
                    assertCommitmentIsPending(commitment);
                    return { goal, commitment } as { goal: Doc<"goals">, commitment: Doc<"commitments"> };
                } catch {
                    return null;
                }
            }))
        ))).flat()
            .filter(commitmentAndGoal => commitmentAndGoal !== null)
            .filter(({ commitment }) => {
                try {
                    assertCommitmentIsPending(commitment);
                    return true;
                } catch {
                    return false;
                }
            })
    }
})

async function getOwnedPendingCommitment(ctx: QueryCtx, commitmentId: Id<"commitments">, checkPending = true) {
    const commitment = await ctx.db.get(commitmentId);
    if (!commitment) {
        throw new Error("Commitment not found");
    }
    await getOwnedGoal(ctx, commitment.goal);
    if (checkPending) {
        assertCommitmentIsPending(commitment);
    }
    return commitment;
}

export const completeCommitment = mutation({
    args: {
        commitmentId: v.id("commitments"),
    },
    handler: async (ctx, { commitmentId }) => {
        await getOwnedPendingCommitment(ctx, commitmentId);

        await ctx.db.patch(commitmentId, {
            completedAt: Date.now(),
        });
    }
})

export const cancelCommitment = mutation({
    args: {
        commitmentId: v.id("commitments"),
        reason: v.string(),
    },
    handler: async (ctx, { commitmentId, reason }) => {
        await getOwnedPendingCommitment(ctx, commitmentId);

        await ctx.db.patch(commitmentId, {
            cancelled: {
                reason,
                at: Date.now(),
            },
        });
    }
})

// todo: comment on failed commitments