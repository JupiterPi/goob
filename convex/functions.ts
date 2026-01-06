import { v } from "convex/values";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { faker } from "@faker-js/faker";

export const storeUser = mutation({
    args: {},
    handler: async (ctx) => {
        const id = await ctx.auth.getUserIdentity();
        if (!id) {
            throw new Error("No user identity");
        }

        const user = await ctx.db.query("users").withIndex("by_tokenIdentifier", q => q.eq("tokenIdentifier", id.tokenIdentifier)).unique();
        if (user !== null) {
            /* if (user.name !== id.name) {
                // name has changed
                await ctx.db.patch(user._id, { name: id.name });
            } */
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

export const getFriendInfoAndGoals = query({
    args: {
        friendId: v.id("users"),
    },
    handler: async (ctx, { friendId }) => {
        const user = await getUser(ctx);
        const friend = await ctx.db.get(friendId);
        if (!friend) {
            throw new Error("Friend not found");
        }
        if (!friend.friends.includes(user._id)) {
            throw new Error("You're not their friend");
        }
        const goals = (await ctx.db.query("goals").withIndex("by_owner", q =>
            q.eq("owner", friend._id)
        ).collect()).filter(goal => !goal.hide && !goal.archived);
        return {
            _id: friend._id,
            name: friend.name,
            goals,
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
                isMutualFriend: friend.friends.includes(user._id),
            };
        }));
        return friends.filter(f => f !== null);
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

function generateKey() {
    // generate an 8-character random alphanumeric string
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "";
    for (let i = 0; i < 8; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

async function createCompletionKey(ctx: MutationCtx) {
    const user = await getUser(ctx);
    faker.seed();
    return await ctx.db.insert("completionKeys", {
        creator: user._id,
        name: `random key ${faker.word.preposition()} ${faker.word.adjective()} ${faker.word.noun()}`,
        key: generateKey(),
    });
}

export const createGoal = mutation({
    args: {
        title: v.string(),
        description: v.string(),
        completionKey: v.optional(v.id("completionKeys")),
    },
    handler: async (ctx, { title, description, completionKey }) => {
        const user = await getUser(ctx);
        return await ctx.db.insert("goals", {
            owner: user._id,
            title,
            description,
            commitments: [],
            completionKey: completionKey ?? await createCompletionKey(ctx),
            hide: false,
            archived: false,
        })
    }
})

export const getCompletionKey = query({
    args: {
        completionKeyId: v.id("completionKeys"),
    },
    handler: async (ctx, { completionKeyId }) => {
        const key = await ctx.db.get(completionKeyId);
        if (!key) {
            throw new Error("Completion key not found");
        }
        return key;
    }
})

export const setGoalCompletionKey = mutation({
    args: {
        goalId: v.id("goals"),
        completionKey: v.optional(v.id("completionKeys")),
    },
    handler: async (ctx, { goalId, completionKey }) => {
        await getOwnedGoal(ctx, goalId);
        await ctx.db.patch(goalId, {
            completionKey: completionKey ?? await createCompletionKey(ctx),
        });

        // delete unused completion keys
        const keys = await ctx.db.query("completionKeys").collect();
        const usedKeys = new Set<Id<"completionKeys">>();
        const goals = await ctx.db.query("goals").collect();
        for (const goal of goals) {
            usedKeys.add(goal.completionKey);
        }
        for (const key of keys) {
            if (!usedKeys.has(key._id)) {
                ctx.db.delete(key._id);
            }
        }
    }
})

export const renameCompletionKey = mutation({
    args: {
        completionKeyId: v.id("completionKeys"),
        name: v.string(),
    },
    handler: async (ctx, { completionKeyId, name }) => {
        const user = await getUser(ctx);
        const key = await ctx.db.get(completionKeyId);
        if (!key) {
            throw new Error("Completion key not found");
        }
        if (key.creator !== user._id) {
            throw new Error("Not your completion key");
        }
        await ctx.db.patch(completionKeyId, { name: `${user.name}'s key ${name}` });
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

export const getGoalPublic = query({
    args: {
        goalId: v.id("goals"),
    },
    handler: async (ctx, { goalId }) => {
        const user = await getUser(ctx);
        const goal = await ctx.db.get(goalId);
        if (!goal) {
            throw new Error("Goal not found");
        }
        const owner = await ctx.db.get(goal.owner);
        if (!owner) {
            throw new Error("Goal owner not found");
        }
        if (goal.owner !== user._id) {
            if (goal.hide) {
                throw new Error("This goal is hidden");
            }
            if (goal.archived) {
                throw new Error("This goal is archived");
            }
            if (!owner.friends.includes(user._id)) {
                throw new Error("This goal is not being shared with you");
            }
        }
        const commitments = await ctx.db.query("commitments").withIndex("by_goal", q =>
            q.eq("goal", goalId)
        ).collect();
        return { ownerName: owner.name, isOwn: goal.owner === user._id, goal, commitments }
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
        key: v.string(),
    },
    handler: async (ctx, { key }) => {
        const user = await getUser(ctx);
        const goals = await ctx.db.query("goals").withIndex("by_owner", q =>
            q.eq("owner", user._id)
        ).collect();
        let commitmentsCompleted = 0;
        for (const goal of goals) {
            const completionKey = await ctx.db.get(goal.completionKey);
            if (completionKey && completionKey.key === key) {
                const commitments = await ctx.db.query("commitments").withIndex("by_goal", q =>
                    q.eq("goal", goal._id)
                ).collect();
                commitmentsCompleted += (await Promise.all(commitments.filter(c => {
                    try {
                        assertCommitmentIsPending(c);
                        return true;
                    } catch {
                        return false;
                    }
                }).map(async commitment => {
                    await ctx.db.patch(commitment._id, { completedAt: Date.now() });
                    return 1
                }))).reduce((a, b) => a + b, 0);
            }
        }
        return { commitmentsCompleted };
    }
})

export const getRecentCommitments = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUser(ctx);
        // get all commitments for user's goals that were completed, cancelled or due in last 5mins and up to 5min from now
        const goals = await ctx.db.query("goals").withIndex("by_owner", q =>
            q.eq("owner", user._id)
        ).collect();
        const now = Date.now();
        const fiveMins = 5 * 60 * 1000;
        const recentCommitments = (await Promise.all(goals.flatMap(goal =>
            Promise.all(goal.commitments.map(async commitmentId => {
                const commitment = await ctx.db.get(commitmentId);
                if (!commitment) {
                    return null;
                }
                if (
                    (commitment.completedAt !== null && commitment.completedAt >= now - fiveMins) ||
                    (commitment.cancelled !== null && commitment.cancelled.at >= now - fiveMins) ||
                    (commitment.due >= BigInt(now - fiveMins) && commitment.due <= BigInt(now + fiveMins))
                ) {
                    return commitment;
                }
                return null;
            }))
        ))).flat().filter((c): c is Doc<"commitments"> => c !== null);
        return recentCommitments;
    }
})

const undoPeriod = 10 * 1000; // 10 seconds

export const getCommitmentUndoPeriod = query({
    args: {},
    handler: async () => {
        // 10 seconds
        return { durationMs: undoPeriod };
    }
})

export const undoCommitment = mutation({
    args: {
        commitmentId: v.id("commitments"),
    },
    handler: async (ctx, { commitmentId }) => {
        const commitment = await getOwnedPendingCommitment(ctx, commitmentId, false);
        if (commitment._creationTime + undoPeriod < Date.now()) {
            throw new Error("Undo period has expired");
        }
        await ctx.db.delete(commitmentId);
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