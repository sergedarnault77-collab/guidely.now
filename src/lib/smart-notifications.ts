import type { UserBehaviorProfile, HabitProfile, BehaviorPattern, Recommendation } from "./behavior-analytics";
import type { YearData, MonthData, WeeklyStore } from "./types";
import { getMonthKey, getWeekKey } from "./types";

// ---- Smart Notification Types ----

export interface SmartNotification {
  id: string;
  type: "nudge" | "celebration" | "warning" | "insight" | "challenge";
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  message: string;
  emoji: string;
  /** When this notification was generated */
  generatedAt: number;
  /** Optional action */
  action?: {
    label: string;
    route?: string;
    callback?: string; // identifier for programmatic actions
  };
  /** Auto-dismiss after this many seconds (0 = manual dismiss) */
  autoDismissSeconds: number;
  /** Source data that triggered this */
  source: string;
}

export interface NotificationState {
  notifications: SmartNotification[];
  dismissedIds: Set<string>;
  lastGeneratedAt: number;
}

// ---- Notification Generation Engine ----

export function generateSmartNotifications(
  profile: UserBehaviorProfile,
  data: YearData,
  weeklyData: WeeklyStore,
  selectedYear: number
): SmartNotification[] {
  const now = new Date();
  const hour = now.getHours();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0
  const monthKey = getMonthKey(selectedYear, currentMonth);
  const monthData: MonthData = data[monthKey] || { habits: [], days: {} };
  const todayEntry = monthData.days[currentDay];
  const totalHabits = monthData.habits.length;

  const notifications: SmartNotification[] = [];

  // ---- Time-Aware Nudges ----

  // Morning kickstart (6-9 AM)
  if (hour >= 6 && hour < 9 && totalHabits > 0) {
    const completedToday = todayEntry?.completedHabits?.length || 0;
    if (completedToday === 0) {
      const easiest = findEasiestHabit(profile.habitProfiles);
      if (easiest) {
        notifications.push({
          id: `morning-start-${currentDay}`,
          type: "nudge",
          priority: "high",
          title: "Start your day strong",
          message: `Begin with "${easiest.habitName}" — your most consistent habit at ${easiest.completionRate}%. One check starts the momentum.`,
          emoji: "🌅",
          generatedAt: now.getTime(),
          action: { label: "Go to Tracker", route: "/tracker" },
          autoDismissSeconds: 0,
          source: "Morning routine analysis",
        });
      }
    }
  }

  // Midday check-in (12-14)
  if (hour >= 12 && hour < 14 && totalHabits > 0) {
    const completedToday = todayEntry?.completedHabits?.length || 0;
    const pct = Math.round((completedToday / totalHabits) * 100);
    if (pct > 0 && pct < 50) {
      notifications.push({
        id: `midday-push-${currentDay}`,
        type: "nudge",
        priority: "medium",
        title: "Halfway through the day",
        message: `You're at ${pct}% — ${totalHabits - completedToday} habits to go. Your afternoon push can make this a great day!`,
        emoji: "☀️",
        generatedAt: now.getTime(),
        autoDismissSeconds: 300,
        source: "Midday progress check",
      });
    }
  }

  // Evening review (19-22)
  if (hour >= 19 && hour < 22) {
    const completedToday = todayEntry?.completedHabits?.length || 0;
    const pct = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

    if (pct >= 100) {
      notifications.push({
        id: `perfect-day-${currentDay}`,
        type: "celebration",
        priority: "high",
        title: "Perfect day! 🏆",
        message: `All ${totalHabits} habits completed! You've had ${profile.perfectDaysThisMonth} perfect days this month.`,
        emoji: "🎉",
        generatedAt: now.getTime(),
        autoDismissSeconds: 0,
        source: "Daily completion check",
      });
    }

    // Mood reminder
    if (!todayEntry || (todayEntry.mood === 5 && todayEntry.motivation === 5)) {
      notifications.push({
        id: `mood-reminder-${currentDay}`,
        type: "nudge",
        priority: "low",
        title: "Log your mood",
        message: "Take a moment to reflect on today. Tracking your mood helps the AI give you better insights.",
        emoji: "💭",
        generatedAt: now.getTime(),
        action: { label: "Set Mood", route: "/tracker" },
        autoDismissSeconds: 600,
        source: "Evening mood reminder",
      });
    }
  }

  // ---- Streak-Based Notifications ----

  // Streak at risk
  if (profile.habitProfiles.length > 0) {
    const avgStreak = profile.habitProfiles.reduce((s, h) => s + h.currentStreak, 0) / profile.habitProfiles.length;
    if (avgStreak >= 3) {
      const completedToday = todayEntry?.completedHabits?.length || 0;
      const pct = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
      if (pct < 50 && hour >= 16) {
        notifications.push({
          id: `streak-risk-${currentDay}`,
          type: "warning",
          priority: "urgent",
          title: "Streak at risk!",
          message: `Your ${Math.round(avgStreak)}-day average streak is in danger. Complete a few more habits to keep it alive.`,
          emoji: "🔥",
          generatedAt: now.getTime(),
          action: { label: "Save Your Streak", route: "/tracker" },
          autoDismissSeconds: 0,
          source: "Streak protection",
        });
      }
    }
  }

  // Streak milestone
  const longestCurrentStreak = Math.max(0, ...profile.habitProfiles.map(h => h.currentStreak));
  if (longestCurrentStreak === 7 || longestCurrentStreak === 14 || longestCurrentStreak === 21 || longestCurrentStreak === 30) {
    const streakHabit = profile.habitProfiles.find(h => h.currentStreak === longestCurrentStreak);
    if (streakHabit) {
      notifications.push({
        id: `streak-milestone-${longestCurrentStreak}-${streakHabit.habitId}`,
        type: "celebration",
        priority: "high",
        title: `${longestCurrentStreak}-day streak! 🔥`,
        message: `"${streakHabit.habitName}" has been going strong for ${longestCurrentStreak} days. ${longestCurrentStreak >= 21 ? "This is becoming automatic!" : "Keep it up!"}`,
        emoji: longestCurrentStreak >= 21 ? "🏅" : "🔥",
        generatedAt: now.getTime(),
        autoDismissSeconds: 0,
        source: "Streak milestone detection",
      });
    }
  }

  // ---- Pattern-Based Notifications ----

  // At-risk habit intervention
  const atRiskHabits = profile.habitProfiles.filter(h => h.abandonmentRisk >= 60);
  if (atRiskHabits.length > 0 && hour >= 8 && hour < 20) {
    const worst = atRiskHabits[0];
    const correlated = worst.correlatedHabits[0];
    const tip = correlated
      ? `Try doing it right after "${correlated.habitName}" — they pair well together.`
      : "Try making it the very first thing you do. Willpower is highest in the morning.";

    notifications.push({
      id: `at-risk-${worst.habitId}-${currentDay}`,
      type: "warning",
      priority: "high",
      title: `"${worst.habitName}" needs attention`,
      message: `This habit is at risk of being dropped (${worst.completionRate}% this month, trending ${worst.trend > 0 ? "up" : "down"}). ${tip}`,
      emoji: "⚠️",
      generatedAt: now.getTime(),
      action: { label: "Focus on This", route: "/tracker" },
      autoDismissSeconds: 0,
      source: `Abandonment risk: ${worst.abandonmentRisk}%`,
    });
  }

  // Weekend-specific guidance
  if ((dayOfWeek === 5 || dayOfWeek === 6) && profile.weekdayWeekendGap > 15) {
    notifications.push({
      id: `weekend-guide-${currentDay}`,
      type: "insight",
      priority: "medium",
      title: "Weekend game plan",
      message: `Your weekend completion is ${profile.weekdayWeekendGap}% lower than weekdays. Even completing 3-4 habits today keeps your momentum alive.`,
      emoji: "📅",
      generatedAt: now.getTime(),
      autoDismissSeconds: 600,
      source: "Weekend pattern analysis",
    });
  }

  // ---- Mood-Based Notifications ----

  if (profile.moodTrend < -1.5) {
    notifications.push({
      id: `mood-declining-${currentDay}`,
      type: "warning",
      priority: "high",
      title: "Your wellbeing matters",
      message: "Your mood has been declining. It's okay to reduce your habit load temporarily. Focus on the 2-3 habits that make you feel best.",
      emoji: "💛",
      generatedAt: now.getTime(),
      autoDismissSeconds: 0,
      source: `Mood trend: ${profile.moodTrend.toFixed(1)}`,
    });
  }

  if (profile.avgMood >= 8 && profile.productivityScore >= 70) {
    notifications.push({
      id: `peak-performance-${currentDay}`,
      type: "celebration",
      priority: "medium",
      title: "You're in the zone!",
      message: `High mood (${profile.avgMood}/10) + strong productivity (${profile.productivityScore}%). This is your peak performance state — make the most of it!`,
      emoji: "⚡",
      generatedAt: now.getTime(),
      autoDismissSeconds: 300,
      source: "Peak performance detection",
    });
  }

  // ---- Weekly Planning Notifications ----

  // Sunday/Monday planning reminder
  if ((dayOfWeek === 6 && hour >= 18) || (dayOfWeek === 0 && hour < 12)) {
    const weekKey = getWeekKey(new Date(now.getTime() + (dayOfWeek === 6 ? 86400000 : 0)));
    const nextWeek = weeklyData[weekKey];
    if (!nextWeek || nextWeek.tasks.length === 0) {
      notifications.push({
        id: `plan-next-week-${weekKey}`,
        type: "nudge",
        priority: "medium",
        title: "Plan your week ahead",
        message: "People who plan their week are 25% more likely to complete their goals. Take 5 minutes to set up next week.",
        emoji: "📋",
        generatedAt: now.getTime(),
        action: { label: "Plan Week", route: "/weekly" },
        autoDismissSeconds: 0,
        source: "Weekly planning reminder",
      });
    }
  }

  // Weekly task overdue alert (mid-week)
  if (dayOfWeek >= 2 && dayOfWeek <= 4) {
    const weekKey = getWeekKey(now);
    const currentWeek = weeklyData[weekKey];
    if (currentWeek) {
      const overdue = currentWeek.tasks.filter(t => !t.completed && t.dayIndex < dayOfWeek);
      if (overdue.length >= 3) {
        notifications.push({
          id: `overdue-tasks-${weekKey}-${currentDay}`,
          type: "warning",
          priority: "medium",
          title: `${overdue.length} overdue tasks`,
          message: "Several tasks from earlier this week are incomplete. Reschedule them for today or remove ones that are no longer relevant.",
          emoji: "📋",
          generatedAt: now.getTime(),
          action: { label: "Review Tasks", route: "/weekly" },
          autoDismissSeconds: 0,
          source: "Overdue task detection",
        });
      }
    }
  }

  // ---- Challenge Notifications ----

  // Daily challenge based on weakness
  if (hour >= 7 && hour < 11 && totalHabits > 0) {
    const weakest = profile.habitProfiles
      .filter(h => h.completionRate < 50 && h.abandonmentRisk < 70)
      .sort((a, b) => a.completionRate - b.completionRate)[0];

    if (weakest) {
      notifications.push({
        id: `daily-challenge-${currentDay}`,
        type: "challenge",
        priority: "medium",
        title: "Today's Challenge",
        message: `Can you complete "${weakest.habitName}" today? It's at ${weakest.completionRate}% — every day you do it brings you closer to making it stick.`,
        emoji: "💪",
        generatedAt: now.getTime(),
        action: { label: "Accept Challenge", route: "/tracker" },
        autoDismissSeconds: 0,
        source: `Weakest habit: ${weakest.completionRate}%`,
      });
    }
  }

  // Improvement insight (based on recommendations)
  if (profile.recommendations.length > 0 && hour >= 9 && hour < 18) {
    const topRec = profile.recommendations[0];
    notifications.push({
      id: `insight-${topRec.id}-${currentDay}`,
      type: "insight",
      priority: topRec.priority === "high" ? "high" : "medium",
      title: topRec.title,
      message: topRec.description,
      emoji: topRec.emoji,
      generatedAt: now.getTime(),
      autoDismissSeconds: 600,
      source: topRec.rationale,
    });
  }

  // ---- Sort and Deduplicate ----
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  notifications.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Limit to avoid notification fatigue
  return notifications.slice(0, 5);
}

// ---- Helpers ----

function findEasiestHabit(profiles: HabitProfile[]): HabitProfile | null {
  if (profiles.length === 0) return null;
  return profiles.reduce((best, h) =>
    h.completionRate > best.completionRate ? h : best
  , profiles[0]);
}

// ---- Notification Priority Colors ----

export const notificationStyles = {
  urgent: {
    border: "border-red-300 dark:border-red-700/50",
    bg: "bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20",
    badge: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
    glow: "shadow-red-500/10",
  },
  high: {
    border: "border-amber-300 dark:border-amber-700/50",
    bg: "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20",
    badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
    glow: "shadow-amber-500/10",
  },
  medium: {
    border: "border-blue-200 dark:border-blue-700/40",
    bg: "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/15 dark:to-indigo-900/15",
    badge: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
    glow: "shadow-blue-500/10",
  },
  low: {
    border: "border-gray-200 dark:border-gray-700/40",
    bg: "bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/30 dark:to-slate-800/30",
    badge: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
    glow: "shadow-gray-500/5",
  },
};

export const notificationTypeIcons: Record<SmartNotification["type"], string> = {
  nudge: "👋",
  celebration: "🎉",
  warning: "⚠️",
  insight: "💡",
  challenge: "💪",
};
