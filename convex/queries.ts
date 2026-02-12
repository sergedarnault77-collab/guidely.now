import { query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

// Type for Better Auth user (for TypeScript)
interface BetterAuthUser {
  _id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  createdAt: number;
  updatedAt: number;
}

// List all habitMonths for the authenticated user
// Available as: api.queries.listHabitMonths OR api.queries.getMyHabitMonths
export const listHabitMonths = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];

    return await ctx.db
      .query("habitMonths")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

// Alias for listHabitMonths - use whichever name you prefer
export const getMyHabitMonths = listHabitMonths;

// Get a single habitMonth by ID (only if owned by user)
export const getHabitMonth = query({
  args: { id: v.id("habitMonths") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== user._id) return null;
    return item;
  },
});

// List all habitWeeks for the authenticated user
// Available as: api.queries.listHabitWeeks OR api.queries.getMyHabitWeeks
export const listHabitWeeks = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];

    return await ctx.db
      .query("habitWeeks")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

// Alias for listHabitWeeks - use whichever name you prefer
export const getMyHabitWeeks = listHabitWeeks;

// Get a single habitWeek by ID (only if owned by user)
export const getHabitWeek = query({
  args: { id: v.id("habitWeeks") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== user._id) return null;
    return item;
  },
});

// List all userSettings for the authenticated user
// Available as: api.queries.listUserSettings OR api.queries.getMyUserSettings
export const listUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];

    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q: any) => q.eq("userId", user._id))
      .collect();
  },
});

// Alias for listUserSettings - use whichever name you prefer
export const getMyUserSettings = listUserSettings;

// Get a single userSetting by ID (only if owned by user)
export const getUserSetting = query({
  args: { id: v.id("userSettings") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return null;

    const item = await ctx.db.get(args.id);
    if (!item || item.userId !== user._id) return null;
    return item;
  },
});

// List recent activity events for the authenticated user
export const listActivityEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx) as BetterAuthUser | null;
    if (!user) return [];

    const events = await ctx.db
      .query("activityEvents")
      .withIndex("by_user_time", (q: any) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit ?? 50);

    return events;
  },
});
