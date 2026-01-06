import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    tokenIdentifier: v.string(),
    friends: v.array(v.id("users")),
    goals: v.array(v.id("goals")),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),
  goals: defineTable({
    owner: v.id("users"),
    title: v.string(),
    description: v.string(),
    commitments: v.array(v.id("commitments")),
    hide: v.boolean(),
    archived: v.boolean(),
  }).index("by_owner", ["owner"]),
  commitments: defineTable({
    goal: v.id("goals"),
    due: v.number(),
    completedAt: v.nullable(v.number()),
    cancelled: v.nullable(v.object({
      reason: v.string(),
      at: v.number(),
    })),
  }),
})