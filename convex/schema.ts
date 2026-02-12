import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  habitMonths: defineTable({
    userId: v.string(),
    monthKey: v.string(),
    habits: v.string(),
    days: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_month", ["userId", "monthKey"]),

  habitWeeks: defineTable({
    userId: v.string(),
    weekKey: v.string(),
    weekStartDate: v.string(),
    tasks: v.string(),
    habits: v.string(),
    habitCompletions: v.string(),
    notes: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_week", ["userId", "weekKey"]),

  userSettings: defineTable({
    userId: v.string(),
    selectedYear: v.number(),
  })
    .index("by_user", ["userId"]),

  activityEvents: defineTable({
    userId: v.string(),
    type: v.string(),
    title: v.string(),
    detail: v.string(),
    emoji: v.string(),
    occurredAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_time", ["userId", "occurredAt"]),
});
