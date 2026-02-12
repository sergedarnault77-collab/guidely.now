import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

interface BetterAuthUser {
  _id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  createdAt: number;
  updatedAt: number;
}

// ============================================================
// First-sync: single mutation that uploads ALL local data
// ============================================================
export const firstSyncUpload = mutation({
  args: {
    months: v.array(
      v.object({
        monthKey: v.string(),
        habits: v.string(),
        days: v.string(),
      })
    ),
    weeks: v.array(
      v.object({
        weekKey: v.string(),
        weekStartDate: v.string(),
        tasks: v.string(),
        habits: v.string(),
        habitCompletions: v.string(),
        notes: v.string(),
      })
    ),
    selectedYear: v.number(),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    // --- Months (idempotent upsert by monthKey) ---
    for (const month of args.months) {
      const existing = await ctx.db
        .query("habitMonths")
        .withIndex("by_user_month", (q: any) =>
          q.eq("userId", user._id).eq("monthKey", month.monthKey)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          habits: month.habits,
          days: month.days,
        });
      } else {
        await ctx.db.insert("habitMonths", {
          userId: user._id,
          monthKey: month.monthKey,
          habits: month.habits,
          days: month.days,
        });
      }
    }

    // --- Weeks (idempotent upsert by weekKey) ---
    for (const week of args.weeks) {
      const existing = await ctx.db
        .query("habitWeeks")
        .withIndex("by_user_week", (q: any) =>
          q.eq("userId", user._id).eq("weekKey", week.weekKey)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          weekStartDate: week.weekStartDate,
          tasks: week.tasks,
          habits: week.habits,
          habitCompletions: week.habitCompletions,
          notes: week.notes,
        });
      } else {
        await ctx.db.insert("habitWeeks", {
          userId: user._id,
          weekKey: week.weekKey,
          weekStartDate: week.weekStartDate,
          tasks: week.tasks,
          habits: week.habits,
          habitCompletions: week.habitCompletions,
          notes: week.notes,
        });
      }
    }

    // --- User settings (idempotent upsert) ---
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        selectedYear: args.selectedYear,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId: user._id,
        selectedYear: args.selectedYear,
      });
    }
  },
});

// Upsert a habitMonth by monthKey
export const upsertHabitMonth = mutation({
  args: {
    monthKey: v.string(),
    habits: v.string(),
    days: v.string(),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("habitMonths")
      .withIndex("by_user_month", (q: any) =>
        q.eq("userId", user._id).eq("monthKey", args.monthKey)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        habits: args.habits,
        days: args.days,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("habitMonths", {
        userId: user._id,
        monthKey: args.monthKey,
        habits: args.habits,
        days: args.days,
      });
    }
  },
});

// Upsert a habitWeek by weekKey
export const upsertHabitWeek = mutation({
  args: {
    weekKey: v.string(),
    weekStartDate: v.string(),
    tasks: v.string(),
    habits: v.string(),
    habitCompletions: v.string(),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("habitWeeks")
      .withIndex("by_user_week", (q: any) =>
        q.eq("userId", user._id).eq("weekKey", args.weekKey)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        weekStartDate: args.weekStartDate,
        tasks: args.tasks,
        habits: args.habits,
        habitCompletions: args.habitCompletions,
        notes: args.notes,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("habitWeeks", {
        userId: user._id,
        weekKey: args.weekKey,
        weekStartDate: args.weekStartDate,
        tasks: args.tasks,
        habits: args.habits,
        habitCompletions: args.habitCompletions,
        notes: args.notes,
      });
    }
  },
});

// Upsert user settings
export const upsertUserSettings = mutation({
  args: {
    selectedYear: v.number(),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        selectedYear: args.selectedYear,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("userSettings", {
        userId: user._id,
        selectedYear: args.selectedYear,
      });
    }
  },
});

// Bulk sync all month data at once (for initial upload from localStorage)
export const bulkSyncMonths = mutation({
  args: {
    months: v.array(
      v.object({
        monthKey: v.string(),
        habits: v.string(),
        days: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    for (const month of args.months) {
      const existing = await ctx.db
        .query("habitMonths")
        .withIndex("by_user_month", (q: any) =>
          q.eq("userId", user._id).eq("monthKey", month.monthKey)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          habits: month.habits,
          days: month.days,
        });
      } else {
        await ctx.db.insert("habitMonths", {
          userId: user._id,
          monthKey: month.monthKey,
          habits: month.habits,
          days: month.days,
        });
      }
    }
  },
});

// Bulk sync all week data at once (for initial upload from localStorage)
export const bulkSyncWeeks = mutation({
  args: {
    weeks: v.array(
      v.object({
        weekKey: v.string(),
        weekStartDate: v.string(),
        tasks: v.string(),
        habits: v.string(),
        habitCompletions: v.string(),
        notes: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    for (const week of args.weeks) {
      const existing = await ctx.db
        .query("habitWeeks")
        .withIndex("by_user_week", (q: any) =>
          q.eq("userId", user._id).eq("weekKey", week.weekKey)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          weekStartDate: week.weekStartDate,
          tasks: week.tasks,
          habits: week.habits,
          habitCompletions: week.habitCompletions,
          notes: week.notes,
        });
      } else {
        await ctx.db.insert("habitWeeks", {
          userId: user._id,
          weekKey: week.weekKey,
          weekStartDate: week.weekStartDate,
          tasks: week.tasks,
          habits: week.habits,
          habitCompletions: week.habitCompletions,
          notes: week.notes,
        });
      }
    }
  },
});

// Log an activity event
export const logActivityEvent = mutation({
  args: {
    type: v.string(),
    title: v.string(),
    detail: v.string(),
    emoji: v.string(),
    occurredAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");
    return await ctx.db.insert("activityEvents", {
      userId: user._id,
      type: args.type,
      title: args.title,
      detail: args.detail,
      emoji: args.emoji,
      occurredAt: args.occurredAt,
    });
  },
});

// Delete all user data (reset)
export const deleteAllUserData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = (await authComponent.getAuthUser(ctx)) as BetterAuthUser | null;
    if (!user) throw new Error("Not authenticated");

    const months = await ctx.db
      .query("habitMonths")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
    for (const m of months) await ctx.db.delete(m._id);

    const weeks = await ctx.db
      .query("habitWeeks")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
    for (const w of weeks) await ctx.db.delete(w._id);

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
    for (const s of settings) await ctx.db.delete(s._id);
  },
});
