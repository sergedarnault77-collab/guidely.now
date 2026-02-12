import type { YearData, MonthData, DayEntry, WeeklyStore, WeeklyData, Habit } from "./types";
import { getMonthKey, getDaysInMonth, getWeekKey } from "./types";

// ---- Behavioral Analytics Types ----

export interface HabitProfile {
  habitId: string;
  habitName: string;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  trend: number;
  bestDayOfWeek: number;
  worstDayOfWeek: number;
  consistencyScore: number;
  abandonmentRisk: number;
  isAutomatic: boolean;
  correlatedHabits: { habitId: string; habitName: string; correlation: number }[];
}

export interface FocusTimeAnalysis {
  /** Best hour ranges for deep work based on completion patterns */
  peakFocusWindows: { start: number; end: number; label: string; score: number }[];
  /** Average daily productive hours */
  avgProductiveHours: number;
  /** Day-of-week focus heatmap (0=Mon..6=Sun, value 0-100) */
  weeklyFocusHeatmap: number[];
  /** Morning vs afternoon vs evening productivity split */
  timeOfDaySplit: { morning: number; afternoon: number; evening: number };
  /** Best day+time combo */
  optimalSlot: { day: string; time: string; score: number };
}

export interface ProcrastinationAnalysis {
  /** Overall procrastination score 0-100 (higher = more procrastination) */
  score: number;
  /** Detected triggers */
  triggers: ProcrastinationTrigger[];
  /** Tasks/habits most commonly delayed */
  delayedItems: { name: string; avgDelayDays: number; category: string }[];
  /** Day-of-week procrastination pattern */
  worstDays: number[];
  /** Recovery pattern: how quickly user bounces back after a miss */
  recoverySpeed: "fast" | "moderate" | "slow";
}

export interface ProcrastinationTrigger {
  id: string;
  trigger: string;
  description: string;
  confidence: number;
  emoji: string;
  suggestion: string;
}

export interface BurnoutAnalysis {
  /** Current burnout risk 0-100 */
  riskLevel: number;
  /** Burnout stage */
  stage: "thriving" | "strained" | "warning" | "burnout";
  /** Contributing factors */
  factors: BurnoutFactor[];
  /** Recovery recommendations */
  recoveryActions: string[];
  /** Trend: is burnout risk increasing or decreasing? */
  trend: "increasing" | "stable" | "decreasing";
  /** Days until predicted burnout (if trending up) */
  daysUntilCritical: number | null;
}

export interface BurnoutFactor {
  label: string;
  impact: number; // 0-30
  emoji: string;
  detail: string;
}

export interface SuggestedRoutine {
  id: string;
  name: string;
  description: string;
  emoji: string;
  frequency: "daily" | "weekly" | "biweekly";
  suggestedDay?: string;
  suggestedTime?: string;
  tasks: string[];
  rationale: string;
  confidence: number;
  category: "planning" | "review" | "wellness" | "focus" | "social";
}

export interface UserBehaviorProfile {
  productivityScore: number;
  peakDays: number[];
  weekdayWeekendGap: number;
  moodProductivityCorrelation: number;
  avgMood: number;
  avgMotivation: number;
  moodTrend: number;
  daysSinceLastPerfect: number;
  perfectDaysThisMonth: number;
  weeklyTaskRate: number;
  habitProfiles: HabitProfile[];
  patterns: BehaviorPattern[];
  recommendations: Recommendation[];
  /** NEW: Focus time analysis */
  focusAnalysis: FocusTimeAnalysis;
  /** NEW: Procrastination analysis */
  procrastinationAnalysis: ProcrastinationAnalysis;
  /** NEW: Burnout analysis */
  burnoutAnalysis: BurnoutAnalysis;
  /** NEW: Suggested routines */
  suggestedRoutines: SuggestedRoutine[];
}

export interface BehaviorPattern {
  id: string;
  type: "positive" | "negative" | "neutral";
  title: string;
  description: string;
  confidence: number;
  emoji: string;
}

export interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionType: "habit_focus" | "schedule_change" | "wellness" | "planning" | "celebration";
  emoji: string;
  rationale: string;
}

// ---- Core Analytics Engine ----

export function analyzeUserBehavior(
  data: YearData,
  weeklyData: WeeklyStore,
  selectedYear: number
): UserBehaviorProfile {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const monthsToAnalyze = getRecentMonths(selectedYear, currentMonth, 3);
  const allDayEntries = collectDayEntries(data, monthsToAnalyze, selectedYear);
  const currentMonthKey = getMonthKey(selectedYear, currentMonth);
  const currentMonthData: MonthData = data[currentMonthKey] || { habits: [], days: {} };

  const habitProfiles = buildHabitProfiles(data, monthsToAnalyze, selectedYear, currentMonth, currentDay);
  const productivityScore = calculateProductivityScore(currentMonthData, currentDay);
  const peakDays = findPeakDays(allDayEntries);
  const weekdayWeekendGap = calculateWeekdayWeekendGap(allDayEntries);
  const moodAnalysis = analyzeMoodPatterns(allDayEntries);
  const moodProductivityCorrelation = calculateMoodProductivityCorrelation(allDayEntries);
  const { daysSinceLastPerfect, perfectDaysThisMonth } = analyzePerfectDays(currentMonthData, currentDay);
  const weeklyTaskRate = calculateWeeklyTaskRate(weeklyData, now);

  // NEW: Deep behavioral analyses
  const focusAnalysis = analyzeFocusTimes(allDayEntries, data, monthsToAnalyze, weeklyData, now);
  const procrastinationAnalysis = analyzeProcrastination(allDayEntries, habitProfiles, weeklyData, data, monthsToAnalyze, now);
  const burnoutAnalysis = analyzeBurnout(allDayEntries, habitProfiles, moodAnalysis, weeklyData, now, currentMonthData, currentDay);
  const suggestedRoutines = generateRoutineSuggestions(habitProfiles, allDayEntries, weeklyData, focusAnalysis, procrastinationAnalysis, burnoutAnalysis, now);

  const patterns = detectPatterns(
    habitProfiles, allDayEntries, weeklyData, selectedYear, currentMonth, currentDay, moodAnalysis, weekdayWeekendGap,
    focusAnalysis, procrastinationAnalysis, burnoutAnalysis
  );

  const recommendations = generateRecommendations(
    habitProfiles, patterns, moodAnalysis, weekdayWeekendGap, weeklyTaskRate, productivityScore, perfectDaysThisMonth, currentDay,
    burnoutAnalysis, procrastinationAnalysis, focusAnalysis
  );

  return {
    productivityScore,
    peakDays,
    weekdayWeekendGap,
    moodProductivityCorrelation,
    avgMood: moodAnalysis.avgMood,
    avgMotivation: moodAnalysis.avgMotivation,
    moodTrend: moodAnalysis.moodTrend,
    daysSinceLastPerfect,
    perfectDaysThisMonth,
    weeklyTaskRate,
    habitProfiles,
    patterns,
    recommendations,
    focusAnalysis,
    procrastinationAnalysis,
    burnoutAnalysis,
    suggestedRoutines,
  };
}

// ---- Helper: Recent months ----

interface MonthRef {
  year: number;
  month: number;
  key: string;
}

function getRecentMonths(year: number, currentMonth: number, count: number): MonthRef[] {
  const months: MonthRef[] = [];
  for (let i = 0; i < count; i++) {
    let m = currentMonth - i;
    let y = year;
    if (m <= 0) { m += 12; y -= 1; }
    months.push({ year: y, month: m, key: getMonthKey(y, m) });
  }
  return months;
}

// ---- Helper: Collect all day entries with metadata ----

interface DayEntryWithMeta {
  entry: DayEntry;
  day: number;
  month: number;
  year: number;
  dayOfWeek: number;
  totalHabits: number;
  completionRate: number;
}

function collectDayEntries(data: YearData, months: MonthRef[], _selectedYear: number): DayEntryWithMeta[] {
  const entries: DayEntryWithMeta[] = [];
  const now = new Date();

  for (const mr of months) {
    const md = data[mr.key];
    if (!md) continue;
    const daysInMonth = getDaysInMonth(mr.year, mr.month);
    const maxDay = (mr.year === now.getFullYear() && mr.month === now.getMonth() + 1)
      ? Math.min(now.getDate(), daysInMonth)
      : daysInMonth;

    for (let d = 1; d <= maxDay; d++) {
      const entry = md.days[d];
      if (!entry) continue;
      const date = new Date(mr.year, mr.month - 1, d);
      const dow = (date.getDay() + 6) % 7;
      const totalHabits = md.habits.length;
      entries.push({
        entry,
        day: d,
        month: mr.month,
        year: mr.year,
        dayOfWeek: dow,
        totalHabits,
        completionRate: totalHabits > 0 ? (entry.completedHabits.length / totalHabits) * 100 : 0,
      });
    }
  }
  return entries;
}

// ---- NEW: Focus Time Analysis ----

function analyzeFocusTimes(
  entries: DayEntryWithMeta[],
  data: YearData,
  months: MonthRef[],
  weeklyData: WeeklyStore,
  now: Date
): FocusTimeAnalysis {
  // Analyze day-of-week completion patterns to infer focus windows
  const dowRates: number[] = Array(7).fill(0);
  const dowCounts: number[] = Array(7).fill(0);

  for (const e of entries) {
    dowRates[e.dayOfWeek] += e.completionRate;
    dowCounts[e.dayOfWeek]++;
  }

  const weeklyFocusHeatmap = dowRates.map((total, i) =>
    dowCounts[i] > 0 ? Math.round(total / dowCounts[i]) : 0
  );

  // Infer time-of-day patterns from habit types and completion
  // Morning habits (health, planning) vs afternoon (work, errands) vs evening (wellness, creative)
  const morningHabitKeywords = ["gym", "workout", "exercise", "run", "meditation", "journal", "plan", "morning"];
  const eveningHabitKeywords = ["read", "relax", "yoga", "stretch", "reflect", "review", "evening", "sleep"];

  let morningScore = 0, afternoonScore = 0, eveningScore = 0;
  let morningCount = 0, afternoonCount = 0, eveningCount = 0;

  for (const mr of months) {
    const md = data[mr.key];
    if (!md) continue;
    for (const habit of md.habits) {
      const lower = habit.name.toLowerCase();
      const isMorning = morningHabitKeywords.some(k => lower.includes(k));
      const isEvening = eveningHabitKeywords.some(k => lower.includes(k));

      // Calculate this habit's completion rate
      const daysInMonth = getDaysInMonth(mr.year, mr.month);
      const nowDate = new Date();
      const maxDay = (mr.year === nowDate.getFullYear() && mr.month === nowDate.getMonth() + 1)
        ? Math.min(nowDate.getDate(), daysInMonth) : daysInMonth;
      let done = 0, total = 0;
      for (let d = 1; d <= maxDay; d++) {
        total++;
        if (md.days[d]?.completedHabits?.includes(habit.id)) done++;
      }
      const rate = total > 0 ? (done / total) * 100 : 0;

      if (isMorning) { morningScore += rate; morningCount++; }
      else if (isEvening) { eveningScore += rate; eveningCount++; }
      else { afternoonScore += rate; afternoonCount++; }
    }
  }

  const timeOfDaySplit = {
    morning: morningCount > 0 ? Math.round(morningScore / morningCount) : 50,
    afternoon: afternoonCount > 0 ? Math.round(afternoonScore / afternoonCount) : 50,
    evening: eveningCount > 0 ? Math.round(eveningScore / eveningCount) : 50,
  };

  // Determine peak focus windows
  const peakFocusWindows: FocusTimeAnalysis["peakFocusWindows"] = [];
  if (timeOfDaySplit.morning >= timeOfDaySplit.afternoon && timeOfDaySplit.morning >= timeOfDaySplit.evening) {
    peakFocusWindows.push({ start: 8, end: 11, label: "Morning Focus", score: timeOfDaySplit.morning });
  }
  if (timeOfDaySplit.afternoon >= 40) {
    peakFocusWindows.push({ start: 13, end: 16, label: "Afternoon Block", score: timeOfDaySplit.afternoon });
  }
  if (timeOfDaySplit.evening >= 40) {
    peakFocusWindows.push({ start: 19, end: 21, label: "Evening Wind-down", score: timeOfDaySplit.evening });
  }
  if (peakFocusWindows.length === 0) {
    peakFocusWindows.push({ start: 9, end: 12, label: "Default Morning", score: 50 });
  }
  peakFocusWindows.sort((a, b) => b.score - a.score);

  // Avg productive hours estimate
  const avgCompletionRate = entries.length > 0
    ? entries.reduce((s, e) => s + e.completionRate, 0) / entries.length
    : 0;
  const avgProductiveHours = Math.round((avgCompletionRate / 100) * 8 * 10) / 10; // assume 8h potential

  // Best day+time combo
  const bestDayIdx = weeklyFocusHeatmap.indexOf(Math.max(...weeklyFocusHeatmap));
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const bestTime = peakFocusWindows[0]?.label || "Morning";
  const optimalSlot = {
    day: dayNames[bestDayIdx] || "Mon",
    time: bestTime,
    score: Math.max(...weeklyFocusHeatmap, 0),
  };

  return {
    peakFocusWindows,
    avgProductiveHours,
    weeklyFocusHeatmap,
    timeOfDaySplit,
    optimalSlot,
  };
}

// ---- NEW: Procrastination Analysis ----

function analyzeProcrastination(
  entries: DayEntryWithMeta[],
  habitProfiles: HabitProfile[],
  weeklyData: WeeklyStore,
  data: YearData,
  months: MonthRef[],
  now: Date
): ProcrastinationAnalysis {
  const triggers: ProcrastinationTrigger[] = [];

  // 1. Analyze weekly task delay patterns
  let totalOverdue = 0;
  let totalWeeklyTasks = 0;
  const delayedCategories: Record<string, number> = {};

  for (let offset = 0; offset < 6; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() - offset * 7);
    const weekKey = getWeekKey(d);
    const wd = weeklyData[weekKey];
    if (!wd) continue;

    for (const task of wd.tasks) {
      totalWeeklyTasks++;
      if (!task.completed) {
        totalOverdue++;
        // Categorize by keyword
        const lower = task.text.toLowerCase();
        if (lower.includes("admin") || lower.includes("email") || lower.includes("organize")) {
          delayedCategories["admin"] = (delayedCategories["admin"] || 0) + 1;
        } else if (lower.includes("plan") || lower.includes("review") || lower.includes("reflect")) {
          delayedCategories["planning"] = (delayedCategories["planning"] || 0) + 1;
        } else if (lower.includes("gym") || lower.includes("exercise") || lower.includes("workout")) {
          delayedCategories["fitness"] = (delayedCategories["fitness"] || 0) + 1;
        } else {
          delayedCategories["general"] = (delayedCategories["general"] || 0) + 1;
        }
      }
    }
  }

  // 2. Detect procrastination triggers
  // Trigger: Low mood days → low completion
  const lowMoodEntries = entries.filter(e => e.entry.mood <= 4);
  const highMoodEntries = entries.filter(e => e.entry.mood >= 7);
  if (lowMoodEntries.length >= 3 && highMoodEntries.length >= 3) {
    const lowMoodRate = lowMoodEntries.reduce((s, e) => s + e.completionRate, 0) / lowMoodEntries.length;
    const highMoodRate = highMoodEntries.reduce((s, e) => s + e.completionRate, 0) / highMoodEntries.length;
    if (highMoodRate - lowMoodRate > 25) {
      triggers.push({
        id: "mood-trigger",
        trigger: "Low Mood",
        description: `When your mood drops below 5, completion falls to ${Math.round(lowMoodRate)}% (vs ${Math.round(highMoodRate)}% on good days).`,
        confidence: Math.min(90, lowMoodEntries.length * 12),
        emoji: "😔",
        suggestion: "On low-mood days, reduce your habit load to 2-3 essentials. Completing fewer tasks is better than skipping entirely.",
      });
    }
  }

  // Trigger: Weekend avoidance
  const weekendEntries = entries.filter(e => e.dayOfWeek >= 5);
  const weekdayEntries = entries.filter(e => e.dayOfWeek < 5);
  if (weekendEntries.length >= 4 && weekdayEntries.length >= 10) {
    const weekendRate = weekendEntries.reduce((s, e) => s + e.completionRate, 0) / weekendEntries.length;
    const weekdayRate = weekdayEntries.reduce((s, e) => s + e.completionRate, 0) / weekdayEntries.length;
    if (weekdayRate - weekendRate > 20) {
      triggers.push({
        id: "weekend-avoidance",
        trigger: "Weekend Avoidance",
        description: `Weekend completion is ${Math.round(weekendRate)}% vs ${Math.round(weekdayRate)}% on weekdays. Routines break down without structure.`,
        confidence: Math.min(85, weekendEntries.length * 8),
        emoji: "📅",
        suggestion: "Create a minimal weekend routine with just 2-3 non-negotiable habits. Anchor them to existing weekend activities.",
      });
    }
  }

  // Trigger: Mid-week energy dip
  const midweekEntries = entries.filter(e => e.dayOfWeek === 2 || e.dayOfWeek === 3);
  const bookendEntries = entries.filter(e => e.dayOfWeek === 0 || e.dayOfWeek === 4);
  if (midweekEntries.length >= 4 && bookendEntries.length >= 4) {
    const midAvg = midweekEntries.reduce((s, e) => s + e.completionRate, 0) / midweekEntries.length;
    const bookendAvg = bookendEntries.reduce((s, e) => s + e.completionRate, 0) / bookendEntries.length;
    if (bookendAvg - midAvg > 15) {
      triggers.push({
        id: "midweek-dip",
        trigger: "Mid-Week Energy Dip",
        description: `Wed/Thu completion drops to ${Math.round(midAvg)}%. Decision fatigue accumulates by mid-week.`,
        confidence: 70,
        emoji: "⚡",
        suggestion: "Schedule your easiest habits for Wed/Thu. Save challenging tasks for Mon/Tue when willpower is highest.",
      });
    }
  }

  // Trigger: Task complexity avoidance
  const atRiskHabits = habitProfiles.filter(h => h.abandonmentRisk >= 50);
  if (atRiskHabits.length >= 2) {
    triggers.push({
      id: "complexity-avoidance",
      trigger: "Difficulty Avoidance",
      description: `${atRiskHabits.length} habits are at risk of being abandoned. Complex or unenjoyable tasks get deprioritized.`,
      confidence: 75,
      emoji: "🏔️",
      suggestion: "Break struggling habits into smaller steps. \"Exercise 30 min\" becomes \"Put on workout clothes\" — the hardest part is starting.",
    });
  }

  // Trigger: Declining motivation
  if (entries.length >= 14) {
    const recent = entries.slice(-7);
    const previous = entries.slice(-14, -7);
    const recentMotivation = recent.reduce((s, e) => s + e.entry.motivation, 0) / recent.length;
    const prevMotivation = previous.reduce((s, e) => s + e.entry.motivation, 0) / previous.length;
    if (prevMotivation - recentMotivation > 1.5) {
      triggers.push({
        id: "motivation-decline",
        trigger: "Motivation Decline",
        description: `Motivation dropped from ${prevMotivation.toFixed(1)} to ${recentMotivation.toFixed(1)} over 2 weeks. This often precedes habit abandonment.`,
        confidence: 80,
        emoji: "📉",
        suggestion: "Reconnect with your \"why\". Write down 3 reasons these habits matter to you. Consider rewarding yourself for streaks.",
      });
    }
  }

  // Delayed items
  const delayedItems: ProcrastinationAnalysis["delayedItems"] = [];
  for (const hp of habitProfiles) {
    if (hp.completionRate < 40 && hp.abandonmentRisk >= 40) {
      delayedItems.push({
        name: hp.habitName,
        avgDelayDays: Math.round((100 - hp.completionRate) / 15),
        category: "habit",
      });
    }
  }

  // Worst days for procrastination (lowest completion)
  const dowRates = Array(7).fill(0).map((_, i) => {
    const dayEntries = entries.filter(e => e.dayOfWeek === i);
    return dayEntries.length > 0
      ? dayEntries.reduce((s, e) => s + e.completionRate, 0) / dayEntries.length
      : 50;
  });
  const minRate = Math.min(...dowRates);
  const worstDays = dowRates
    .map((r, i) => ({ rate: r, day: i }))
    .filter(d => d.rate <= minRate + 10)
    .map(d => d.day);

  // Recovery speed
  let recoverySpeed: "fast" | "moderate" | "slow" = "moderate";
  if (entries.length >= 10) {
    let missStreaks: number[] = [];
    let currentMiss = 0;
    for (const e of entries) {
      if (e.completionRate < 30) {
        currentMiss++;
      } else {
        if (currentMiss > 0) missStreaks.push(currentMiss);
        currentMiss = 0;
      }
    }
    if (currentMiss > 0) missStreaks.push(currentMiss);
    const avgMissStreak = missStreaks.length > 0
      ? missStreaks.reduce((a, b) => a + b, 0) / missStreaks.length
      : 0;
    recoverySpeed = avgMissStreak <= 1 ? "fast" : avgMissStreak <= 3 ? "moderate" : "slow";
  }

  // Overall procrastination score
  const overdueRate = totalWeeklyTasks > 0 ? (totalOverdue / totalWeeklyTasks) * 100 : 0;
  const avgCompletion = entries.length > 0
    ? entries.reduce((s, e) => s + e.completionRate, 0) / entries.length
    : 50;
  const score = Math.round(
    Math.min(100, Math.max(0,
      (overdueRate * 0.3) +
      ((100 - avgCompletion) * 0.4) +
      (triggers.length * 8) +
      (recoverySpeed === "slow" ? 15 : recoverySpeed === "moderate" ? 5 : 0)
    ))
  );

  return {
    score,
    triggers: triggers.sort((a, b) => b.confidence - a.confidence),
    delayedItems: delayedItems.slice(0, 5),
    worstDays,
    recoverySpeed,
  };
}

// ---- NEW: Burnout Analysis ----

function analyzeBurnout(
  entries: DayEntryWithMeta[],
  habitProfiles: HabitProfile[],
  moodAnalysis: MoodAnalysis,
  weeklyData: WeeklyStore,
  now: Date,
  currentMonthData: MonthData,
  currentDay: number
): BurnoutAnalysis {
  const factors: BurnoutFactor[] = [];
  let riskScore = 0;

  // Factor 1: Declining mood trend
  if (moodAnalysis.moodTrend < -1) {
    const impact = Math.min(25, Math.round(Math.abs(moodAnalysis.moodTrend) * 10));
    factors.push({
      label: "Declining mood",
      impact,
      emoji: "😞",
      detail: `Mood dropped ${Math.abs(moodAnalysis.moodTrend).toFixed(1)} points over 2 weeks`,
    });
    riskScore += impact;
  }

  // Factor 2: Declining motivation
  if (moodAnalysis.motivationTrend < -1) {
    const impact = Math.min(20, Math.round(Math.abs(moodAnalysis.motivationTrend) * 8));
    factors.push({
      label: "Declining motivation",
      impact,
      emoji: "⚡",
      detail: `Motivation dropped ${Math.abs(moodAnalysis.motivationTrend).toFixed(1)} points`,
    });
    riskScore += impact;
  }

  // Factor 3: Overloaded (too many habits)
  if (currentMonthData.habits.length >= 8) {
    const impact = Math.min(20, (currentMonthData.habits.length - 6) * 5);
    factors.push({
      label: "Habit overload",
      impact,
      emoji: "📋",
      detail: `${currentMonthData.habits.length} active habits — research suggests 3-5 is optimal`,
    });
    riskScore += impact;
  }

  // Factor 4: Consistently low mood
  if (moodAnalysis.avgMood < 4.5) {
    const impact = Math.round((5 - moodAnalysis.avgMood) * 8);
    factors.push({
      label: "Persistently low mood",
      impact,
      emoji: "💛",
      detail: `Average mood ${moodAnalysis.avgMood.toFixed(1)}/10 over recent weeks`,
    });
    riskScore += impact;
  }

  // Factor 5: Completion rate dropping
  if (entries.length >= 14) {
    const recent = entries.slice(-7);
    const previous = entries.slice(-14, -7);
    const recentRate = recent.reduce((s, e) => s + e.completionRate, 0) / recent.length;
    const prevRate = previous.reduce((s, e) => s + e.completionRate, 0) / previous.length;
    if (prevRate - recentRate > 15) {
      const impact = Math.min(20, Math.round((prevRate - recentRate) * 0.8));
      factors.push({
        label: "Falling completion rate",
        impact,
        emoji: "📉",
        detail: `Dropped from ${Math.round(prevRate)}% to ${Math.round(recentRate)}% in one week`,
      });
      riskScore += impact;
    }
  }

  // Factor 6: Multiple at-risk habits
  const atRiskCount = habitProfiles.filter(h => h.abandonmentRisk >= 60).length;
  if (atRiskCount >= 2) {
    const impact = Math.min(15, atRiskCount * 5);
    factors.push({
      label: "Multiple habits failing",
      impact,
      emoji: "⚠️",
      detail: `${atRiskCount} habits at high abandonment risk`,
    });
    riskScore += impact;
  }

  // Factor 7: No perfect days recently
  let daysSincePerfect = -1;
  for (let d = currentDay; d >= 1; d--) {
    const entry = currentMonthData.days[d];
    if (entry && currentMonthData.habits.length > 0 && entry.completedHabits.length >= currentMonthData.habits.length) {
      daysSincePerfect = currentDay - d;
      break;
    }
  }
  if (daysSincePerfect > 10 && currentMonthData.habits.length > 0) {
    factors.push({
      label: "No recent wins",
      impact: 10,
      emoji: "🏆",
      detail: daysSincePerfect > 0 ? `${daysSincePerfect} days since last perfect day` : "No perfect days this month",
    });
    riskScore += 10;
  }

  // Determine stage
  riskScore = Math.min(100, riskScore);
  let stage: BurnoutAnalysis["stage"];
  if (riskScore < 25) stage = "thriving";
  else if (riskScore < 50) stage = "strained";
  else if (riskScore < 75) stage = "warning";
  else stage = "burnout";

  // Trend
  let trend: BurnoutAnalysis["trend"] = "stable";
  if (moodAnalysis.moodTrend < -0.5 || moodAnalysis.motivationTrend < -0.5) trend = "increasing";
  else if (moodAnalysis.moodTrend > 0.5 && moodAnalysis.motivationTrend > 0) trend = "decreasing";

  // Days until critical
  let daysUntilCritical: number | null = null;
  if (trend === "increasing" && riskScore < 75) {
    const ratePerWeek = Math.abs(moodAnalysis.moodTrend) * 5;
    if (ratePerWeek > 0) {
      daysUntilCritical = Math.round(((75 - riskScore) / ratePerWeek) * 7);
    }
  }

  // Recovery actions
  const recoveryActions: string[] = [];
  if (stage === "burnout" || stage === "warning") {
    recoveryActions.push("Reduce your active habits to just 2-3 essentials for the next week");
    recoveryActions.push("Schedule a full rest day with zero obligations");
    if (moodAnalysis.avgMood < 5) {
      recoveryActions.push("Prioritize activities that bring you joy, not just productivity");
    }
    recoveryActions.push("Consider talking to someone you trust about how you're feeling");
  } else if (stage === "strained") {
    recoveryActions.push("Take one habit off your plate temporarily");
    recoveryActions.push("Add a 10-minute daily wind-down routine");
    recoveryActions.push("Celebrate small wins — you don't need perfection");
  }

  factors.sort((a, b) => b.impact - a.impact);

  return {
    riskLevel: riskScore,
    stage,
    factors: factors.slice(0, 5),
    recoveryActions,
    trend,
    daysUntilCritical,
  };
}

// ---- NEW: Auto-Routine Builder ----

function generateRoutineSuggestions(
  habitProfiles: HabitProfile[],
  entries: DayEntryWithMeta[],
  weeklyData: WeeklyStore,
  focusAnalysis: FocusTimeAnalysis,
  procrastinationAnalysis: ProcrastinationAnalysis,
  burnoutAnalysis: BurnoutAnalysis,
  now: Date
): SuggestedRoutine[] {
  const routines: SuggestedRoutine[] = [];
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // 1. Weekly Review routine (if user doesn't already do it)
  const hasWeeklyReview = Object.values(weeklyData).some(w =>
    w.tasks.some(t => t.text.toLowerCase().includes("review") || t.text.toLowerCase().includes("reflect"))
  );
  if (!hasWeeklyReview) {
    routines.push({
      id: "weekly-review",
      name: "Weekly Review",
      description: "A structured end-of-week reflection to plan ahead and celebrate wins.",
      emoji: "📝",
      frequency: "weekly",
      suggestedDay: "Sunday",
      suggestedTime: "7:00 PM",
      tasks: [
        "Review this week's completed habits and tasks",
        "Identify what worked well and what didn't",
        "Plan top 3 priorities for next week",
        "Set mood/motivation intentions for the week ahead",
      ],
      rationale: "Users who do weekly reviews are 40% more likely to maintain habit streaks. You don't currently have a review routine.",
      confidence: 85,
      category: "review",
    });
  }

  // 2. Morning Launch routine (if morning is peak time)
  if (focusAnalysis.timeOfDaySplit.morning >= 45) {
    const morningHabits = habitProfiles
      .filter(h => {
        const lower = h.habitName.toLowerCase();
        return ["gym", "workout", "exercise", "meditation", "journal", "read", "plan"].some(k => lower.includes(k));
      })
      .slice(0, 3);

    routines.push({
      id: "morning-launch",
      name: "Morning Launch Sequence",
      description: "Start your day with your highest-impact habits during your peak focus window.",
      emoji: "🌅",
      frequency: "daily",
      suggestedTime: `${focusAnalysis.peakFocusWindows[0]?.start || 8}:00 AM`,
      tasks: morningHabits.length > 0
        ? morningHabits.map(h => h.habitName)
        : ["Quick 5-min planning session", "Top priority task first", "Movement or exercise"],
      rationale: `Your morning productivity score is ${focusAnalysis.timeOfDaySplit.morning}% — your strongest time of day. Stack your hardest habits here.`,
      confidence: 80,
      category: "focus",
    });
  }

  // 3. Mid-week Reset (if mid-week dip detected)
  const hasMidweekDip = procrastinationAnalysis.triggers.some(t => t.id === "midweek-dip");
  if (hasMidweekDip) {
    routines.push({
      id: "midweek-reset",
      name: "Wednesday Reset",
      description: "A quick mid-week check-in to combat the energy dip and re-align priorities.",
      emoji: "🔄",
      frequency: "weekly",
      suggestedDay: "Wednesday",
      suggestedTime: "12:00 PM",
      tasks: [
        "Review remaining weekly tasks",
        "Move or reschedule anything unrealistic",
        "Pick ONE priority for the rest of the week",
        "5-minute walk or stretch break",
      ],
      rationale: "Your Wed/Thu completion drops significantly. A mid-week reset helps maintain momentum through the second half.",
      confidence: 75,
      category: "planning",
    });
  }

  // 4. Burnout Prevention routine
  if (burnoutAnalysis.stage === "strained" || burnoutAnalysis.stage === "warning") {
    routines.push({
      id: "burnout-prevention",
      name: "Recovery & Recharge",
      description: "Protect your energy with intentional rest and reduced expectations.",
      emoji: "🧘",
      frequency: "daily",
      suggestedTime: "8:00 PM",
      tasks: [
        "Rate your energy level (1-10)",
        "Do one thing purely for enjoyment",
        "Set tomorrow's expectations to 70% of normal",
        "10-minute wind-down (no screens)",
      ],
      rationale: `Your burnout risk is ${burnoutAnalysis.riskLevel}% (${burnoutAnalysis.stage}). Proactive recovery prevents full burnout.`,
      confidence: 90,
      category: "wellness",
    });
  }

  // 5. Weekend Anchor routine (if weekend slump detected)
  const hasWeekendSlump = procrastinationAnalysis.triggers.some(t => t.id === "weekend-avoidance");
  if (hasWeekendSlump) {
    routines.push({
      id: "weekend-anchor",
      name: "Weekend Anchor",
      description: "A minimal weekend routine to maintain consistency without feeling like work.",
      emoji: "⚓",
      frequency: "weekly",
      suggestedDay: "Saturday",
      suggestedTime: "10:00 AM",
      tasks: [
        "Complete your top 2 easiest habits",
        "One enjoyable physical activity",
        "Quick 5-min weekly planner check",
      ],
      rationale: "Your weekend completion drops significantly. This minimal anchor keeps the habit loop alive without overwhelming your rest days.",
      confidence: 78,
      category: "planning",
    });
  }

  // 6. Habit Stacking routine (if correlated habits found)
  const bundledHabits = habitProfiles.filter(h => h.correlatedHabits.length > 0 && h.completionRate >= 60);
  if (bundledHabits.length >= 2) {
    const stack = bundledHabits.slice(0, 3);
    routines.push({
      id: "habit-stack",
      name: "Power Stack",
      description: "Your naturally correlated habits bundled into one efficient block.",
      emoji: "🔗",
      frequency: "daily",
      tasks: stack.map(h => h.habitName),
      rationale: `These habits are already completed together ${stack[0].correlatedHabits[0]?.correlation || 70}%+ of the time. Formalizing the stack makes it automatic.`,
      confidence: 82,
      category: "focus",
    });
  }

  // 7. Planning Block (if weekly task rate is low)
  const weeklyTaskRate = calculateWeeklyTaskRateSimple(weeklyData, now);
  if (weeklyTaskRate < 50) {
    routines.push({
      id: "planning-block",
      name: "Sunday Planning Block",
      description: "Spend 15 minutes planning your week to dramatically improve task completion.",
      emoji: "📋",
      frequency: "weekly",
      suggestedDay: "Sunday",
      suggestedTime: "6:00 PM",
      tasks: [
        "Open weekly planner",
        "Add 3-5 key tasks for the week",
        "Assign tasks to specific days",
        "Set one weekly focus theme",
      ],
      rationale: `Your weekly task completion is ${weeklyTaskRate}%. Planning ahead typically doubles completion rates.`,
      confidence: 85,
      category: "planning",
    });
  }

  routines.sort((a, b) => b.confidence - a.confidence);
  return routines.slice(0, 5);
}

function calculateWeeklyTaskRateSimple(weeklyData: WeeklyStore, now: Date): number {
  let totalCompleted = 0;
  let totalTasks = 0;
  for (let offset = 0; offset < 3; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() - offset * 7);
    const weekKey = getWeekKey(d);
    const wd = weeklyData[weekKey];
    if (wd && wd.tasks.length > 0) {
      totalTasks += wd.tasks.length;
      totalCompleted += wd.tasks.filter(t => t.completed).length;
    }
  }
  return totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
}

// ---- Habit Profiles ----

function buildHabitProfiles(
  data: YearData,
  months: MonthRef[],
  selectedYear: number,
  currentMonth: number,
  _currentDay: number
): HabitProfile[] {
  const currentMonthKey = getMonthKey(selectedYear, currentMonth);
  const currentMonthData = data[currentMonthKey] || { habits: [], days: {} };
  if (currentMonthData.habits.length === 0) return [];

  const profiles: HabitProfile[] = [];

  for (const habit of currentMonthData.habits) {
    let totalDays = 0;
    let completedDays = 0;
    const dailyCompletions: boolean[] = [];
    const dayOfWeekCompletions: number[] = Array(7).fill(0);
    const dayOfWeekTotals: number[] = Array(7).fill(0);

    for (const mr of months) {
      const md = data[mr.key];
      if (!md) continue;
      const matchingHabit = md.habits.find(h => h.id === habit.id) || md.habits.find(h => h.name === habit.name);
      if (!matchingHabit) continue;

      const daysInMonth = getDaysInMonth(mr.year, mr.month);
      const now = new Date();
      const maxDay = (mr.year === now.getFullYear() && mr.month === now.getMonth() + 1)
        ? Math.min(now.getDate(), daysInMonth)
        : daysInMonth;

      for (let d = 1; d <= maxDay; d++) {
        const entry = md.days[d];
        const date = new Date(mr.year, mr.month - 1, d);
        const dow = (date.getDay() + 6) % 7;
        totalDays++;
        dayOfWeekTotals[dow]++;
        const completed = entry?.completedHabits?.includes(matchingHabit.id) || false;
        dailyCompletions.push(completed);
        if (completed) {
          completedDays++;
          dayOfWeekCompletions[dow]++;
        }
      }
    }

    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
    const { currentStreak, longestStreak } = calculateStreaks(dailyCompletions);
    const trend = calculateTrend(dailyCompletions);
    const dayOfWeekRates = dayOfWeekTotals.map((total, i) =>
      total > 0 ? (dayOfWeekCompletions[i] / total) * 100 : 0
    );
    const bestDayOfWeek = dayOfWeekRates.indexOf(Math.max(...dayOfWeekRates));
    const worstDayOfWeek = dayOfWeekRates.indexOf(Math.min(...dayOfWeekRates.filter(r => r >= 0)));
    const consistencyScore = calculateConsistency(dailyCompletions);
    const abandonmentRisk = calculateAbandonmentRisk(dailyCompletions, currentStreak, trend);
    const isAutomatic = completionRate >= 85 && totalDays >= 14;

    profiles.push({
      habitId: habit.id,
      habitName: habit.name,
      completionRate,
      currentStreak,
      longestStreak,
      trend,
      bestDayOfWeek,
      worstDayOfWeek,
      consistencyScore,
      abandonmentRisk,
      isAutomatic,
      correlatedHabits: [],
    });
  }

  fillHabitCorrelations(profiles, data, months);
  return profiles;
}

function calculateStreaks(completions: boolean[]): { currentStreak: number; longestStreak: number } {
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  for (let i = completions.length - 1; i >= 0; i--) {
    if (completions[i]) {
      streak++;
      if (i === completions.length - 1 || currentStreak > 0) currentStreak++;
    } else {
      if (currentStreak === 0 && i === completions.length - 1) continue;
      longestStreak = Math.max(longestStreak, streak);
      streak = 0;
      if (currentStreak === 0 && i < completions.length - 2) break;
    }
  }
  longestStreak = Math.max(longestStreak, streak);
  return { currentStreak, longestStreak };
}

function calculateTrend(completions: boolean[]): number {
  if (completions.length < 14) return 0;
  const recent = completions.slice(-7);
  const previous = completions.slice(-14, -7);
  const recentRate = recent.filter(Boolean).length / recent.length;
  const previousRate = previous.filter(Boolean).length / previous.length;
  return Math.round((recentRate - previousRate) * 100);
}

function calculateConsistency(completions: boolean[]): number {
  if (completions.length < 7) return 50;
  const weeklyRates: number[] = [];
  for (let i = 0; i < completions.length; i += 7) {
    const week = completions.slice(i, i + 7);
    if (week.length < 3) continue;
    weeklyRates.push(week.filter(Boolean).length / week.length);
  }
  if (weeklyRates.length < 2) return 50;
  const mean = weeklyRates.reduce((a, b) => a + b, 0) / weeklyRates.length;
  const variance = weeklyRates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / weeklyRates.length;
  return Math.round(Math.max(0, Math.min(100, (1 - Math.sqrt(variance)) * 100)));
}

function calculateAbandonmentRisk(completions: boolean[], currentStreak: number, trend: number): number {
  if (completions.length < 7) return 20;
  const last7 = completions.slice(-7);
  const recentRate = last7.filter(Boolean).length / last7.length;

  let risk = 0;
  if (recentRate < 0.3) risk += 40;
  else if (recentRate < 0.5) risk += 20;
  if (trend < -20) risk += 30;
  else if (trend < -10) risk += 15;
  if (currentStreak === 0) risk += 15;

  let gapAtEnd = 0;
  for (let i = completions.length - 1; i >= 0; i--) {
    if (!completions[i]) gapAtEnd++;
    else break;
  }
  if (gapAtEnd >= 3) risk += 20;

  return Math.min(100, risk);
}

function fillHabitCorrelations(profiles: HabitProfile[], data: YearData, months: MonthRef[]) {
  if (profiles.length < 2) return;

  for (let i = 0; i < profiles.length; i++) {
    const correlations: { habitId: string; habitName: string; correlation: number }[] = [];

    for (let j = 0; j < profiles.length; j++) {
      if (i === j) continue;

      let bothDone = 0;
      let eitherDone = 0;

      for (const mr of months) {
        const md = data[mr.key];
        if (!md) continue;
        const daysInMonth = getDaysInMonth(mr.year, mr.month);
        const now = new Date();
        const maxDay = (mr.year === now.getFullYear() && mr.month === now.getMonth() + 1)
          ? Math.min(now.getDate(), daysInMonth) : daysInMonth;

        for (let d = 1; d <= maxDay; d++) {
          const entry = md.days[d];
          if (!entry) continue;
          const aId = md.habits.find(h => h.id === profiles[i].habitId || h.name === profiles[i].habitName)?.id;
          const bId = md.habits.find(h => h.id === profiles[j].habitId || h.name === profiles[j].habitName)?.id;
          if (!aId || !bId) continue;

          const aDone = entry.completedHabits.includes(aId);
          const bDone = entry.completedHabits.includes(bId);
          if (aDone || bDone) eitherDone++;
          if (aDone && bDone) bothDone++;
        }
      }

      const correlation = eitherDone > 0 ? Math.round((bothDone / eitherDone) * 100) : 0;
      if (correlation > 60) {
        correlations.push({ habitId: profiles[j].habitId, habitName: profiles[j].habitName, correlation });
      }
    }

    correlations.sort((a, b) => b.correlation - a.correlation);
    profiles[i].correlatedHabits = correlations.slice(0, 3);
  }
}

// ---- Productivity Score ----

function calculateProductivityScore(monthData: MonthData, currentDay: number): number {
  if (monthData.habits.length === 0 || currentDay === 0) return 0;
  let totalPct = 0;
  let daysWithData = 0;
  for (let d = 1; d <= currentDay; d++) {
    const entry = monthData.days[d];
    if (entry) {
      totalPct += (entry.completedHabits.length / monthData.habits.length) * 100;
      daysWithData++;
    }
  }
  return daysWithData > 0 ? Math.round(totalPct / daysWithData) : 0;
}

// ---- Peak Days ----

function findPeakDays(entries: DayEntryWithMeta[]): number[] {
  const dayTotals: number[] = Array(7).fill(0);
  const dayCounts: number[] = Array(7).fill(0);
  for (const e of entries) {
    dayTotals[e.dayOfWeek] += e.completionRate;
    dayCounts[e.dayOfWeek]++;
  }
  const dayAvgs = dayTotals.map((t, i) => dayCounts[i] > 0 ? t / dayCounts[i] : 0);
  const maxAvg = Math.max(...dayAvgs);
  if (maxAvg === 0) return [];
  return dayAvgs
    .map((avg, i) => ({ avg, day: i }))
    .filter(d => d.avg >= maxAvg - 10)
    .sort((a, b) => b.avg - a.avg)
    .map(d => d.day);
}

// ---- Weekday/Weekend Gap ----

function calculateWeekdayWeekendGap(entries: DayEntryWithMeta[]): number {
  let weekdayTotal = 0, weekdayCount = 0;
  let weekendTotal = 0, weekendCount = 0;
  for (const e of entries) {
    if (e.dayOfWeek <= 4) { weekdayTotal += e.completionRate; weekdayCount++; }
    else { weekendTotal += e.completionRate; weekendCount++; }
  }
  const weekdayAvg = weekdayCount > 0 ? weekdayTotal / weekdayCount : 0;
  const weekendAvg = weekendCount > 0 ? weekendTotal / weekendCount : 0;
  return Math.round(weekdayAvg - weekendAvg);
}

// ---- Mood Analysis ----

interface MoodAnalysis {
  avgMood: number;
  avgMotivation: number;
  moodTrend: number;
  motivationTrend: number;
  lowMoodDays: number;
  highMoodDays: number;
}

function analyzeMoodPatterns(entries: DayEntryWithMeta[]): MoodAnalysis {
  if (entries.length === 0) return { avgMood: 5, avgMotivation: 5, moodTrend: 0, motivationTrend: 0, lowMoodDays: 0, highMoodDays: 0 };

  const moods = entries.map(e => e.entry.mood);
  const motivations = entries.map(e => e.entry.motivation);
  const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length;
  const avgMotivation = motivations.reduce((a, b) => a + b, 0) / motivations.length;

  let moodTrend = 0;
  let motivationTrend = 0;
  if (moods.length >= 14) {
    const recentMoods = moods.slice(-7);
    const prevMoods = moods.slice(-14, -7);
    moodTrend = (recentMoods.reduce((a, b) => a + b, 0) / 7) - (prevMoods.reduce((a, b) => a + b, 0) / 7);
    const recentMotivation = motivations.slice(-7);
    const prevMotivation = motivations.slice(-14, -7);
    motivationTrend = (recentMotivation.reduce((a, b) => a + b, 0) / 7) - (prevMotivation.reduce((a, b) => a + b, 0) / 7);
  }

  return {
    avgMood: Math.round(avgMood * 10) / 10,
    avgMotivation: Math.round(avgMotivation * 10) / 10,
    moodTrend: Math.round(moodTrend * 10) / 10,
    motivationTrend: Math.round(motivationTrend * 10) / 10,
    lowMoodDays: moods.filter(m => m <= 4).length,
    highMoodDays: moods.filter(m => m >= 7).length,
  };
}

// ---- Mood-Productivity Correlation ----

function calculateMoodProductivityCorrelation(entries: DayEntryWithMeta[]): number {
  if (entries.length < 5) return 0;
  const moods = entries.map(e => e.entry.mood);
  const rates = entries.map(e => e.completionRate);
  const n = moods.length;
  const meanMood = moods.reduce((a, b) => a + b, 0) / n;
  const meanRate = rates.reduce((a, b) => a + b, 0) / n;

  let numerator = 0, denomMood = 0, denomRate = 0;
  for (let i = 0; i < n; i++) {
    const dm = moods[i] - meanMood;
    const dr = rates[i] - meanRate;
    numerator += dm * dr;
    denomMood += dm * dm;
    denomRate += dr * dr;
  }
  const denom = Math.sqrt(denomMood * denomRate);
  return denom > 0 ? Math.round((numerator / denom) * 100) / 100 : 0;
}

// ---- Perfect Days ----

function analyzePerfectDays(monthData: MonthData, currentDay: number): { daysSinceLastPerfect: number; perfectDaysThisMonth: number } {
  const totalHabits = monthData.habits.length;
  if (totalHabits === 0) return { daysSinceLastPerfect: -1, perfectDaysThisMonth: 0 };

  let lastPerfect = -1;
  let perfectCount = 0;
  for (let d = 1; d <= currentDay; d++) {
    const entry = monthData.days[d];
    if (entry && entry.completedHabits.length >= totalHabits) {
      perfectCount++;
      lastPerfect = d;
    }
  }

  return { daysSinceLastPerfect: lastPerfect >= 0 ? currentDay - lastPerfect : -1, perfectDaysThisMonth: perfectCount };
}

// ---- Weekly Task Rate ----

function calculateWeeklyTaskRate(weeklyData: WeeklyStore, now: Date): number {
  let totalCompleted = 0;
  let totalTasks = 0;
  for (let offset = 0; offset < 3; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() - offset * 7);
    const weekKey = getWeekKey(d);
    const wd = weeklyData[weekKey];
    if (wd && wd.tasks.length > 0) {
      totalTasks += wd.tasks.length;
      totalCompleted += wd.tasks.filter(t => t.completed).length;
    }
  }
  return totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
}

// ---- Pattern Detection (enhanced) ----

function detectPatterns(
  habitProfiles: HabitProfile[],
  entries: DayEntryWithMeta[],
  weeklyData: WeeklyStore,
  _selectedYear: number,
  _currentMonth: number,
  _currentDay: number,
  moodAnalysis: MoodAnalysis,
  weekdayWeekendGap: number,
  focusAnalysis: FocusTimeAnalysis,
  procrastinationAnalysis: ProcrastinationAnalysis,
  burnoutAnalysis: BurnoutAnalysis
): BehaviorPattern[] {
  const patterns: BehaviorPattern[] = [];

  // 1. Monday Motivation
  const mondayEntries = entries.filter(e => e.dayOfWeek === 0);
  const otherEntries = entries.filter(e => e.dayOfWeek !== 0);
  if (mondayEntries.length >= 3 && otherEntries.length >= 3) {
    const mondayAvg = mondayEntries.reduce((s, e) => s + e.completionRate, 0) / mondayEntries.length;
    const otherAvg = otherEntries.reduce((s, e) => s + e.completionRate, 0) / otherEntries.length;
    if (mondayAvg > otherAvg + 10) {
      patterns.push({
        id: "monday-motivation", type: "positive", title: "Monday Motivation",
        description: `You start weeks strong with ${Math.round(mondayAvg)}% completion on Mondays vs ${Math.round(otherAvg)}% other days.`,
        confidence: Math.min(90, mondayEntries.length * 10), emoji: "🚀",
      });
    }
  }

  // 2. Weekend Slump
  if (weekdayWeekendGap > 15) {
    patterns.push({
      id: "weekend-slump", type: "negative", title: "Weekend Slump",
      description: `Your completion drops ${weekdayWeekendGap}% on weekends. Weekend routines may need adjustment.`,
      confidence: Math.min(85, entries.length), emoji: "📉",
    });
  }

  // 3. Mood-Driven Performance
  const highMoodEntries = entries.filter(e => e.entry.mood >= 7);
  const lowMoodEntries = entries.filter(e => e.entry.mood <= 4);
  if (highMoodEntries.length >= 3 && lowMoodEntries.length >= 3) {
    const highMoodRate = highMoodEntries.reduce((s, e) => s + e.completionRate, 0) / highMoodEntries.length;
    const lowMoodRate = lowMoodEntries.reduce((s, e) => s + e.completionRate, 0) / lowMoodEntries.length;
    if (highMoodRate - lowMoodRate > 20) {
      patterns.push({
        id: "mood-driven", type: "neutral", title: "Mood-Driven Performance",
        description: `High mood days: ${Math.round(highMoodRate)}% vs ${Math.round(lowMoodRate)}% on low mood days.`,
        confidence: 80, emoji: "🎭",
      });
    }
  }

  // 4. Habit Bundling
  const bundledHabits = habitProfiles.filter(h => h.correlatedHabits.length > 0);
  if (bundledHabits.length > 0) {
    const strongest = bundledHabits[0];
    const topCorrelation = strongest.correlatedHabits[0];
    if (topCorrelation && topCorrelation.correlation > 70) {
      patterns.push({
        id: "habit-bundle", type: "positive", title: "Habit Bundle Detected",
        description: `"${strongest.habitName}" and "${topCorrelation.habitName}" are completed together ${topCorrelation.correlation}% of the time.`,
        confidence: topCorrelation.correlation, emoji: "🔗",
      });
    }
  }

  // 5. Declining Motivation
  if (moodAnalysis.motivationTrend < -1) {
    patterns.push({
      id: "declining-motivation", type: "negative", title: "Declining Motivation",
      description: `Motivation dropped by ${Math.abs(moodAnalysis.motivationTrend).toFixed(1)} points over 2 weeks.`,
      confidence: 75, emoji: "⚡",
    });
  }

  // 6. Consistency Champion
  const consistentHabits = habitProfiles.filter(h => h.consistencyScore >= 80 && h.completionRate >= 70);
  if (consistentHabits.length >= 3) {
    patterns.push({
      id: "consistency-champion", type: "positive", title: "Consistency Champion",
      description: `${consistentHabits.length} habits have 80%+ consistency. You've built strong routines!`,
      confidence: 90, emoji: "🏅",
    });
  }

  // 7. At-Risk Habits
  const atRiskHabits = habitProfiles.filter(h => h.abandonmentRisk >= 60);
  if (atRiskHabits.length > 0) {
    patterns.push({
      id: "at-risk-habits", type: "negative",
      title: `${atRiskHabits.length} Habit${atRiskHabits.length > 1 ? "s" : ""} at Risk`,
      description: `${atRiskHabits.map(h => `"${h.habitName}"`).join(", ")} ${atRiskHabits.length > 1 ? "have" : "has"} high abandonment risk.`,
      confidence: 85, emoji: "⚠️",
    });
  }

  // 8. Automatic Habits
  const automaticHabits = habitProfiles.filter(h => h.isAutomatic);
  if (automaticHabits.length > 0) {
    patterns.push({
      id: "automatic-habits", type: "positive",
      title: `${automaticHabits.length} Automatic Habit${automaticHabits.length > 1 ? "s" : ""}`,
      description: `${automaticHabits.map(h => `"${h.habitName}"`).join(", ")} require minimal willpower!`,
      confidence: 95, emoji: "🤖",
    });
  }

  // NEW: 9. Focus Time Pattern
  if (focusAnalysis.peakFocusWindows.length > 0) {
    const best = focusAnalysis.peakFocusWindows[0];
    if (best.score >= 60) {
      patterns.push({
        id: "peak-focus", type: "positive", title: "Peak Focus Window",
        description: `Your best productivity window is ${best.label} (${best.start}:00-${best.end}:00) with ${best.score}% effectiveness.`,
        confidence: 80, emoji: "🎯",
      });
    }
  }

  // NEW: 10. Burnout Warning
  if (burnoutAnalysis.stage === "warning" || burnoutAnalysis.stage === "burnout") {
    patterns.push({
      id: "burnout-signal", type: "negative", title: "Burnout Signal Detected",
      description: `Burnout risk at ${burnoutAnalysis.riskLevel}%. ${burnoutAnalysis.factors[0]?.detail || "Multiple stress indicators detected."}`,
      confidence: 90, emoji: "🔥",
    });
  }

  // NEW: 11. Procrastination Pattern
  if (procrastinationAnalysis.score >= 40) {
    const topTrigger = procrastinationAnalysis.triggers[0];
    patterns.push({
      id: "procrastination-pattern", type: "negative", title: "Procrastination Pattern",
      description: topTrigger
        ? `Primary trigger: ${topTrigger.trigger}. ${topTrigger.description}`
        : `Procrastination score: ${procrastinationAnalysis.score}%. Tasks are being deferred frequently.`,
      confidence: Math.min(85, procrastinationAnalysis.score), emoji: "⏳",
    });
  }

  patterns.sort((a, b) => b.confidence - a.confidence);
  return patterns.slice(0, 8);
}

// ---- Recommendations (enhanced) ----

function generateRecommendations(
  habitProfiles: HabitProfile[],
  patterns: BehaviorPattern[],
  moodAnalysis: MoodAnalysis,
  weekdayWeekendGap: number,
  weeklyTaskRate: number,
  productivityScore: number,
  perfectDaysThisMonth: number,
  currentDay: number,
  burnoutAnalysis: BurnoutAnalysis,
  procrastinationAnalysis: ProcrastinationAnalysis,
  focusAnalysis: FocusTimeAnalysis
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Burnout-first recommendation
  if (burnoutAnalysis.stage === "warning" || burnoutAnalysis.stage === "burnout") {
    recs.push({
      id: "burnout-recovery", priority: "high",
      title: "Burnout Recovery Mode",
      description: burnoutAnalysis.recoveryActions[0] || "Reduce your habit load and prioritize rest.",
      actionType: "wellness", emoji: "🛑",
      rationale: `Burnout risk: ${burnoutAnalysis.riskLevel}% (${burnoutAnalysis.stage}). ${burnoutAnalysis.factors[0]?.detail || ""}`,
    });
  }

  // Focus on at-risk habits
  const atRisk = habitProfiles.filter(h => h.abandonmentRisk >= 50).sort((a, b) => b.abandonmentRisk - a.abandonmentRisk);
  if (atRisk.length > 0) {
    recs.push({
      id: "focus-at-risk", priority: "high",
      title: `Rescue "${atRisk[0].habitName}"`,
      description: `At ${atRisk[0].abandonmentRisk}% abandonment risk. Try doing it first thing or pairing with a strong habit.`,
      actionType: "habit_focus", emoji: "🆘",
      rationale: `${atRisk[0].completionRate}% completion, trend: ${atRisk[0].trend > 0 ? "+" : ""}${atRisk[0].trend}%`,
    });
  }

  // Procrastination-specific recommendation
  if (procrastinationAnalysis.triggers.length > 0) {
    const trigger = procrastinationAnalysis.triggers[0];
    recs.push({
      id: "beat-procrastination", priority: "medium",
      title: `Beat ${trigger.trigger}`,
      description: trigger.suggestion,
      actionType: "schedule_change", emoji: "⏰",
      rationale: trigger.description,
    });
  }

  // Focus time optimization
  if (focusAnalysis.peakFocusWindows.length > 0) {
    const peak = focusAnalysis.peakFocusWindows[0];
    recs.push({
      id: "optimize-focus", priority: "medium",
      title: `Protect Your ${peak.label}`,
      description: `Schedule your hardest habits between ${peak.start}:00-${peak.end}:00. This is when you're most effective.`,
      actionType: "schedule_change", emoji: "🎯",
      rationale: `${peak.label} productivity: ${peak.score}%`,
    });
  }

  // Weekend strategy
  if (weekdayWeekendGap > 15) {
    recs.push({
      id: "weekend-strategy", priority: "medium",
      title: "Create a Weekend Routine",
      description: `Your weekday performance is ${weekdayWeekendGap}% higher. Set specific weekend times for habits.`,
      actionType: "schedule_change", emoji: "📅",
      rationale: `Weekday-weekend gap: ${weekdayWeekendGap}%`,
    });
  }

  // Mood-based wellness
  if (moodAnalysis.avgMood < 5 || moodAnalysis.moodTrend < -1) {
    recs.push({
      id: "mood-wellness", priority: "high",
      title: "Prioritize Your Wellbeing",
      description: moodAnalysis.moodTrend < -1
        ? "Your mood has been declining. Consider reducing habit load temporarily."
        : "Your mood has been low. Consistency matters more than perfection.",
      actionType: "wellness", emoji: "💛",
      rationale: `Avg mood: ${moodAnalysis.avgMood}/10, trend: ${moodAnalysis.moodTrend > 0 ? "+" : ""}${moodAnalysis.moodTrend}`,
    });
  }

  // Weekly planning
  if (weeklyTaskRate < 40) {
    recs.push({
      id: "improve-planning", priority: "medium",
      title: "Improve Weekly Planning",
      description: "Weekly task completion is below 40%. Try planning fewer, more specific tasks.",
      actionType: "planning", emoji: "📋",
      rationale: `Weekly task completion: ${weeklyTaskRate}%`,
    });
  }

  // Celebrate wins
  if (perfectDaysThisMonth >= 3) {
    recs.push({
      id: "celebrate", priority: "low",
      title: `${perfectDaysThisMonth} Perfect Days!`,
      description: "You're doing amazing! Consider rewarding yourself for this consistency.",
      actionType: "celebration", emoji: "🎉",
      rationale: `${perfectDaysThisMonth} perfect days in ${currentDay} days`,
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  return recs.slice(0, 6);
}
