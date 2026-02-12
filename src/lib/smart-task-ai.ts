import type { YearData, MonthData, DayEntry, WeeklyStore, WeeklyData, WeeklyTask, Habit } from "./types";
import { getMonthKey, getDaysInMonth, getWeekKey } from "./types";

// ============================================================
// SMART TASK INTERPRETATION
// When a user types a task, AI infers category, duration, priority
// ============================================================

export interface TaskInterpretation {
  category: TaskCategory;
  estimatedMinutes: number;
  priority: "high" | "medium" | "low";
  tags: string[];
  confidence: number; // 0-100
  emoji: string;
  suggestion?: string; // optional tip
}

export type TaskCategory =
  | "work"
  | "health"
  | "learning"
  | "finance"
  | "social"
  | "creative"
  | "errands"
  | "planning"
  | "wellness"
  | "home";

interface CategoryRule {
  category: TaskCategory;
  keywords: string[];
  emoji: string;
  defaultMinutes: number;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "health",
    keywords: ["gym", "workout", "exercise", "run", "jog", "yoga", "stretch", "walk", "swim", "bike", "fitness", "push-up", "pushup", "squat", "plank", "cardio", "weight", "lift", "sport", "cold shower", "meditation", "meditate"],
    emoji: "💪",
    defaultMinutes: 45,
  },
  {
    category: "work",
    keywords: ["meeting", "email", "report", "project", "client", "proposal", "presentation", "deadline", "review", "code", "develop", "design", "marketing", "sales", "invoice", "budget", "strategy", "analyze", "research", "call", "conference", "sprint", "deploy", "ship", "launch", "reels", "content", "targeting", "commercial", "portfolio", "competitor"],
    emoji: "💼",
    defaultMinutes: 60,
  },
  {
    category: "learning",
    keywords: ["read", "study", "learn", "course", "book", "tutorial", "practice", "lesson", "class", "lecture", "english", "language", "skill", "certificate", "exam", "homework", "research"],
    emoji: "📚",
    defaultMinutes: 30,
  },
  {
    category: "finance",
    keywords: ["budget", "pay", "bill", "bank", "invest", "save", "expense", "tax", "insurance", "subscription", "finance", "money", "transfer", "accounting"],
    emoji: "💰",
    defaultMinutes: 15,
  },
  {
    category: "social",
    keywords: ["call", "meet", "friend", "family", "dinner", "lunch", "coffee", "party", "event", "birthday", "gift", "visit", "hangout", "date", "catch up"],
    emoji: "👥",
    defaultMinutes: 60,
  },
  {
    category: "creative",
    keywords: ["write", "draw", "paint", "music", "photo", "video", "blog", "journal", "brainstorm", "idea", "create", "art", "compose", "script", "story"],
    emoji: "🎨",
    defaultMinutes: 45,
  },
  {
    category: "errands",
    keywords: ["buy", "shop", "grocery", "store", "pick up", "drop off", "deliver", "mail", "post", "clean", "laundry", "repair", "fix", "appointment", "doctor", "dentist", "pharmacy", "bread", "driving"],
    emoji: "🏃",
    defaultMinutes: 30,
  },
  {
    category: "planning",
    keywords: ["plan", "organize", "schedule", "prioritize", "goal", "review", "reflect", "journal", "track", "list", "prepare", "setup", "set up"],
    emoji: "📋",
    defaultMinutes: 15,
  },
  {
    category: "wellness",
    keywords: ["relax", "rest", "sleep", "nap", "break", "mindful", "breathe", "therapy", "self-care", "spa", "massage", "detox", "unplug", "disconnect"],
    emoji: "🧘",
    defaultMinutes: 20,
  },
  {
    category: "home",
    keywords: ["cook", "meal", "recipe", "garden", "decorate", "organize", "tidy", "vacuum", "dishes", "trash", "water plants", "furniture"],
    emoji: "🏠",
    defaultMinutes: 30,
  },
];

const DURATION_MODIFIERS: { pattern: RegExp; minutes: number }[] = [
  { pattern: /(\d+)\s*min/i, minutes: -1 }, // extract from text
  { pattern: /(\d+)\s*hour/i, minutes: -2 }, // extract from text
  { pattern: /quick|brief|short|fast|5.?min/i, minutes: 10 },
  { pattern: /long|deep|thorough|extended|detailed/i, minutes: 90 },
  { pattern: /half.?hour|30.?min/i, minutes: 30 },
  { pattern: /1.?hour|one.?hour|60.?min/i, minutes: 60 },
  { pattern: /15.?min|quarter/i, minutes: 15 },
];

const PRIORITY_SIGNALS = {
  high: ["urgent", "asap", "deadline", "important", "critical", "must", "overdue", "today", "now", "immediately", "priority", "crucial"],
  low: ["maybe", "someday", "optional", "if time", "when possible", "low priority", "nice to have", "eventually"],
};

export function interpretTask(text: string): TaskInterpretation {
  const lower = text.toLowerCase().trim();

  // 1. Detect category
  let bestCategory: TaskCategory = "work";
  let bestScore = 0;
  let bestEmoji = "📝";
  let baseMinutes = 30;

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        score += kw.length; // longer keyword matches = higher confidence
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
      bestEmoji = rule.emoji;
      baseMinutes = rule.defaultMinutes;
    }
  }

  // 2. Estimate duration
  let estimatedMinutes = baseMinutes;
  for (const mod of DURATION_MODIFIERS) {
    const match = lower.match(mod.pattern);
    if (match) {
      if (mod.minutes === -1 && match[1]) {
        estimatedMinutes = parseInt(match[1], 10);
      } else if (mod.minutes === -2 && match[1]) {
        estimatedMinutes = parseInt(match[1], 10) * 60;
      } else if (mod.minutes > 0) {
        estimatedMinutes = mod.minutes;
      }
      break;
    }
  }

  // 3. Detect priority
  let priority: "high" | "medium" | "low" = "medium";
  for (const kw of PRIORITY_SIGNALS.high) {
    if (lower.includes(kw)) { priority = "high"; break; }
  }
  if (priority === "medium") {
    for (const kw of PRIORITY_SIGNALS.low) {
      if (lower.includes(kw)) { priority = "low"; break; }
    }
  }

  // 4. Extract tags
  const tags: string[] = [];
  if (bestCategory !== "work") tags.push(bestCategory);
  if (estimatedMinutes <= 15) tags.push("quick-win");
  if (estimatedMinutes >= 60) tags.push("deep-work");
  if (priority === "high") tags.push("urgent");

  // 5. Confidence
  const confidence = bestScore > 0 ? Math.min(95, 50 + bestScore * 5) : 30;

  // 6. Suggestion
  let suggestion: string | undefined;
  if (estimatedMinutes >= 90) {
    suggestion = "Consider breaking this into smaller 30-min blocks for better focus";
  } else if (priority === "high" && estimatedMinutes > 60) {
    suggestion = "High priority + long task — schedule this for your peak energy time";
  }

  return {
    category: bestCategory,
    estimatedMinutes,
    priority,
    tags,
    confidence,
    emoji: bestEmoji,
    suggestion,
  };
}

// ============================================================
// PREDICTIVE COMPLETION SCORE
// Likelihood of completing a task now vs later based on history
// ============================================================

export interface PredictiveScore {
  /** 0-100 likelihood of completing this task right now */
  completeNowScore: number;
  /** 0-100 likelihood if deferred to later today */
  completeLaterScore: number;
  /** 0-100 likelihood if deferred to tomorrow */
  completeTomorrowScore: number;
  /** Factors that influenced the score */
  factors: PredictionFactor[];
  /** Best time to do this task */
  optimalTimeSlot: "morning" | "afternoon" | "evening";
  /** Recommendation */
  recommendation: string;
}

export interface PredictionFactor {
  label: string;
  impact: number; // -20 to +20
  emoji: string;
}

export function predictCompletion(
  taskText: string,
  interpretation: TaskInterpretation,
  data: YearData,
  weeklyData: WeeklyStore,
  selectedYear: number
): PredictiveScore {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const monthKey = getMonthKey(selectedYear, currentMonth);
  const monthData: MonthData = data[monthKey] || { habits: [], days: {} };

  const factors: PredictionFactor[] = [];
  let baseScore = 60; // start at 60%

  // Factor 1: Time of day alignment
  const timeScore = getTimeAlignmentScore(hour, interpretation.category);
  factors.push({
    label: timeScore > 0 ? "Good time for this type of task" : "Not ideal time for this task",
    impact: timeScore,
    emoji: timeScore > 0 ? "⏰" : "🕐",
  });
  baseScore += timeScore;

  // Factor 2: Day of week performance
  const dowScore = getDayOfWeekScore(data, selectedYear, currentMonth, currentDay, dayOfWeek);
  factors.push({
    label: dowScore > 0
      ? `${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dayOfWeek]} is a strong day for you`
      : `${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dayOfWeek]} tends to be lower productivity`,
    impact: dowScore,
    emoji: dowScore > 0 ? "📅" : "📉",
  });
  baseScore += dowScore;

  // Factor 3: Current momentum (today's completion rate)
  const todayEntry = monthData.days[currentDay];
  const totalHabits = monthData.habits.length;
  const todayRate = todayEntry && totalHabits > 0
    ? (todayEntry.completedHabits.length / totalHabits) * 100
    : 0;
  const momentumScore = todayRate >= 70 ? 10 : todayRate >= 40 ? 5 : todayRate > 0 ? 0 : -5;
  factors.push({
    label: todayRate >= 70 ? "Strong momentum today" : todayRate >= 40 ? "Decent progress today" : "Low activity so far today",
    impact: momentumScore,
    emoji: todayRate >= 70 ? "🚀" : todayRate >= 40 ? "👍" : "😴",
  });
  baseScore += momentumScore;

  // Factor 4: Mood influence
  const recentMood = getRecentMoodAvg(monthData, currentDay, 3);
  const moodScore = recentMood >= 7 ? 10 : recentMood >= 5 ? 3 : recentMood > 0 ? -8 : 0;
  if (recentMood > 0) {
    factors.push({
      label: recentMood >= 7 ? "High mood boosts completion" : recentMood >= 5 ? "Neutral mood" : "Low mood may reduce focus",
      impact: moodScore,
      emoji: recentMood >= 7 ? "😊" : recentMood >= 5 ? "😐" : "😔",
    });
    baseScore += moodScore;
  }

  // Factor 5: Task duration vs energy
  const durationScore = getDurationScore(interpretation.estimatedMinutes, hour);
  factors.push({
    label: durationScore > 0
      ? `${interpretation.estimatedMinutes}min task fits your current energy`
      : `${interpretation.estimatedMinutes}min task may be too long for current energy`,
    impact: durationScore,
    emoji: durationScore > 0 ? "⚡" : "🔋",
  });
  baseScore += durationScore;

  // Factor 6: Weekly task completion history
  const weeklyRate = getWeeklyCompletionRate(weeklyData, now);
  const weeklyScore = weeklyRate >= 70 ? 8 : weeklyRate >= 40 ? 3 : weeklyRate > 0 ? -5 : 0;
  if (weeklyRate > 0) {
    factors.push({
      label: weeklyRate >= 70 ? `${weeklyRate}% weekly task rate — you follow through` : `${weeklyRate}% weekly task rate`,
      impact: weeklyScore,
      emoji: weeklyRate >= 70 ? "✅" : "📊",
    });
    baseScore += weeklyScore;
  }

  // Factor 7: Priority urgency boost
  if (interpretation.priority === "high") {
    factors.push({ label: "High priority — urgency drives action", impact: 8, emoji: "🔴" });
    baseScore += 8;
  } else if (interpretation.priority === "low") {
    factors.push({ label: "Low priority — easy to defer", impact: -8, emoji: "🟢" });
    baseScore -= 8;
  }

  // Clamp
  const completeNowScore = Math.max(5, Math.min(98, baseScore));

  // Later today: drops based on fatigue curve
  const laterDrop = hour < 14 ? 8 : hour < 18 ? 15 : 25;
  const completeLaterScore = Math.max(5, Math.min(95, completeNowScore - laterDrop));

  // Tomorrow: regression to mean + day-of-week factor
  const tomorrowDow = (dayOfWeek + 1) % 7;
  const tomorrowDowScore = getDayOfWeekScore(data, selectedYear, currentMonth, currentDay, tomorrowDow);
  const completeTomorrowScore = Math.max(5, Math.min(90, 50 + tomorrowDowScore + (interpretation.priority === "high" ? 10 : 0)));

  // Optimal time slot
  let optimalTimeSlot: "morning" | "afternoon" | "evening" = "morning";
  if (interpretation.category === "wellness" || interpretation.category === "social") {
    optimalTimeSlot = "evening";
  } else if (interpretation.category === "errands" || interpretation.category === "finance") {
    optimalTimeSlot = "afternoon";
  } else if (interpretation.estimatedMinutes >= 60) {
    optimalTimeSlot = "morning"; // deep work in morning
  }

  // Recommendation
  let recommendation: string;
  if (completeNowScore >= 75) {
    recommendation = "Do it now — conditions are ideal for this task";
  } else if (completeNowScore >= 55) {
    recommendation = completeLaterScore > completeNowScore - 5
      ? "Good to start now, or schedule for later today"
      : "Start now while momentum is on your side";
  } else if (completeTomorrowScore > completeNowScore + 10) {
    recommendation = `Consider deferring to tomorrow (${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][tomorrowDow]}) — historically a better day for you`;
  } else {
    recommendation = "Break this into a smaller first step to build momentum";
  }

  return {
    completeNowScore,
    completeLaterScore,
    completeTomorrowScore,
    factors,
    optimalTimeSlot,
    recommendation,
  };
}

// ============================================================
// ADAPTIVE REMINDERS
// AI chooses when and how to remind based on past success
// ============================================================

export interface AdaptiveReminder {
  taskText: string;
  suggestedTime: string; // "09:00", "14:30", etc.
  suggestedTimeLabel: string; // "Morning (9 AM)", etc.
  reason: string;
  urgency: "now" | "soon" | "later" | "tomorrow";
  nudgeStyle: "gentle" | "direct" | "motivational" | "accountability";
  message: string;
}

export function generateAdaptiveReminders(
  tasks: { text: string; interpretation: TaskInterpretation; dayIndex: number }[],
  data: YearData,
  weeklyData: WeeklyStore,
  selectedYear: number
): AdaptiveReminder[] {
  const now = new Date();
  const hour = now.getHours();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const monthKey = getMonthKey(selectedYear, currentMonth);
  const monthData: MonthData = data[monthKey] || { habits: [], days: {} };

  // Determine user's nudge style preference based on behavior
  const recentMood = getRecentMoodAvg(monthData, currentDay, 5);
  const todayEntry = monthData.days[currentDay];
  const totalHabits = monthData.habits.length;
  const todayRate = todayEntry && totalHabits > 0
    ? (todayEntry.completedHabits.length / totalHabits) * 100
    : 0;

  const reminders: AdaptiveReminder[] = [];

  for (const task of tasks) {
    const { text, interpretation } = task;

    // Determine optimal time
    let suggestedHour: number;
    let suggestedTimeLabel: string;

    if (interpretation.priority === "high") {
      // High priority: suggest ASAP or next available slot
      if (hour < 10) {
        suggestedHour = 9;
        suggestedTimeLabel = "Morning (9 AM)";
      } else if (hour < 14) {
        suggestedHour = hour + 1;
        suggestedTimeLabel = `Soon (${hour + 1}:00)`;
      } else {
        suggestedHour = hour;
        suggestedTimeLabel = "Now";
      }
    } else if (interpretation.category === "health" || interpretation.category === "wellness") {
      // Health tasks: morning or evening based on type
      if (text.toLowerCase().includes("gym") || text.toLowerCase().includes("workout") || text.toLowerCase().includes("run")) {
        suggestedHour = hour < 8 ? 7 : 17;
        suggestedTimeLabel = hour < 8 ? "Early Morning (7 AM)" : "After Work (5 PM)";
      } else {
        suggestedHour = 20;
        suggestedTimeLabel = "Evening (8 PM)";
      }
    } else if (interpretation.estimatedMinutes >= 60) {
      // Deep work: morning focus block
      suggestedHour = hour < 10 ? 9 : hour < 14 ? hour + 1 : 9;
      suggestedTimeLabel = suggestedHour === 9 ? "Morning Focus (9 AM)" : `Focus Block (${suggestedHour}:00)`;
    } else if (interpretation.estimatedMinutes <= 15) {
      // Quick tasks: batch in afternoon
      suggestedHour = 14;
      suggestedTimeLabel = "Afternoon Batch (2 PM)";
    } else {
      suggestedHour = hour < 12 ? 10 : 15;
      suggestedTimeLabel = hour < 12 ? "Mid-Morning (10 AM)" : "Afternoon (3 PM)";
    }

    // Determine urgency
    let urgency: "now" | "soon" | "later" | "tomorrow";
    if (suggestedHour <= hour) {
      urgency = "now";
    } else if (suggestedHour - hour <= 2) {
      urgency = "soon";
    } else if (suggestedHour > 20 && hour < 15) {
      urgency = "later";
    } else {
      urgency = hour >= 20 ? "tomorrow" : "later";
    }

    // Determine nudge style based on user state
    let nudgeStyle: "gentle" | "direct" | "motivational" | "accountability";
    if (recentMood < 5) {
      nudgeStyle = "gentle"; // be kind when mood is low
    } else if (todayRate >= 70) {
      nudgeStyle = "motivational"; // keep the momentum
    } else if (interpretation.priority === "high") {
      nudgeStyle = "direct"; // urgent = direct
    } else {
      nudgeStyle = "accountability";
    }

    // Generate message
    const message = generateNudgeMessage(text, nudgeStyle, urgency, interpretation);

    const suggestedTime = `${String(suggestedHour).padStart(2, "0")}:00`;

    reminders.push({
      taskText: text,
      suggestedTime,
      suggestedTimeLabel,
      reason: getReminderReason(interpretation, suggestedHour, hour),
      urgency,
      nudgeStyle,
      message,
    });
  }

  // Sort: now > soon > later > tomorrow
  const urgencyOrder = { now: 0, soon: 1, later: 2, tomorrow: 3 };
  reminders.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return reminders;
}

function generateNudgeMessage(
  taskText: string,
  style: "gentle" | "direct" | "motivational" | "accountability",
  urgency: "now" | "soon" | "later" | "tomorrow",
  interpretation: TaskInterpretation
): string {
  const shortTask = taskText.length > 30 ? taskText.slice(0, 30) + "..." : taskText;
  const duration = interpretation.estimatedMinutes;

  switch (style) {
    case "gentle":
      if (urgency === "now") return `When you're ready, "${shortTask}" would be a great next step. Just ${duration} minutes.`;
      return `No rush — "${shortTask}" is on your list for later. Take your time.`;
    case "direct":
      if (urgency === "now") return `Time to tackle "${shortTask}" — it's high priority and will take ~${duration} min.`;
      return `"${shortTask}" is coming up. Block ${duration} minutes for it.`;
    case "motivational":
      if (urgency === "now") return `You're on a roll! "${shortTask}" is next — ${duration} min and you'll feel amazing.`;
      return `Keep the momentum going! "${shortTask}" is queued up for later.`;
    case "accountability":
      if (urgency === "now") return `"${shortTask}" — you planned this. ${duration} min to check it off. Let's go.`;
      return `Reminder: "${shortTask}" is scheduled. Past you made this plan for a reason.`;
  }
}

function getReminderReason(
  interpretation: TaskInterpretation,
  suggestedHour: number,
  currentHour: number
): string {
  if (interpretation.priority === "high") {
    return "High priority — scheduled for earliest available slot";
  }
  if (interpretation.estimatedMinutes >= 60) {
    return suggestedHour < 12
      ? "Deep work tasks perform best in morning focus blocks"
      : "Scheduled for your next available focus block";
  }
  if (interpretation.estimatedMinutes <= 15) {
    return "Quick task — batched with other short tasks for efficiency";
  }
  if (interpretation.category === "health") {
    return "Health tasks have highest completion at consistent daily times";
  }
  return "Scheduled based on your typical productivity patterns";
}

// ============================================================
// ENHANCED AI DAILY AGENDA
// Prioritized plan with deadlines, urgency, behavior-based ordering
// ============================================================

export interface EnhancedAgendaItem {
  id: string;
  text: string;
  interpretation: TaskInterpretation;
  prediction: PredictiveScore;
  reminder: AdaptiveReminder | null;
  source: "habit" | "weekly" | "overdue" | "ai-suggested";
  sourceDetail: string;
  isCompleted: boolean;
}

export interface EnhancedDailyAgenda {
  items: EnhancedAgendaItem[];
  summary: AgendaSummary;
  optimalOrder: string[]; // item IDs in recommended order
}

export interface AgendaSummary {
  totalItems: number;
  totalMinutes: number;
  highPriorityCount: number;
  predictedCompletionRate: number;
  peakProductivityWindow: string;
  motivationalMessage: string;
}

export function generateEnhancedAgenda(
  data: YearData,
  weeklyData: WeeklyStore,
  selectedYear: number
): EnhancedDailyAgenda {
  const now = new Date();
  const hour = now.getHours();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const monthKey = getMonthKey(selectedYear, currentMonth);
  const monthData: MonthData = data[monthKey] || { habits: [], days: {} };
  const todayEntry = monthData.days[currentDay];
  const todayDayIdx = (now.getDay() + 6) % 7;

  const weekKey = getWeekKeyLocal(now);
  const weekData = weeklyData[weekKey];

  const items: EnhancedAgendaItem[] = [];

  // 1. Incomplete habits for today
  if (monthData.habits.length > 0) {
    const completedToday = todayEntry?.completedHabits || [];
    const remaining = monthData.habits.filter(h => !completedToday.includes(h.id));

    for (const habit of remaining) {
      const interp = interpretTask(habit.name);
      // Override priority based on habit strength
      const strength = getHabitStrength(monthData, currentDay, habit.id);
      if (strength < 30) interp.priority = "high";
      else if (strength < 60) interp.priority = "medium";

      const prediction = predictCompletion(habit.name, interp, data, weeklyData, selectedYear);

      items.push({
        id: `habit-${habit.id}`,
        text: habit.name,
        interpretation: interp,
        prediction,
        reminder: null,
        source: "habit",
        sourceDetail: `${strength}% this month`,
        isCompleted: false,
      });
    }
  }

  // 2. Today's weekly tasks
  if (weekData) {
    const todayTasks = weekData.tasks.filter(t => t.dayIndex === todayDayIdx && !t.completed);
    for (const task of todayTasks) {
      const interp = interpretTask(task.text);
      const prediction = predictCompletion(task.text, interp, data, weeklyData, selectedYear);

      items.push({
        id: `weekly-${task.id}`,
        text: task.text,
        interpretation: interp,
        prediction,
        reminder: null,
        source: "weekly",
        sourceDetail: "Scheduled for today",
        isCompleted: false,
      });
    }

    // 3. Overdue tasks from earlier this week
    const overdue = weekData.tasks.filter(t => !t.completed && t.dayIndex < todayDayIdx);
    for (const task of overdue.slice(0, 3)) {
      const interp = interpretTask(task.text);
      interp.priority = "high"; // overdue = high priority
      const prediction = predictCompletion(task.text, interp, data, weeklyData, selectedYear);

      items.push({
        id: `overdue-${task.id}`,
        text: task.text,
        interpretation: interp,
        prediction,
        reminder: null,
        source: "overdue",
        sourceDetail: `Overdue from ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][task.dayIndex]}`,
        isCompleted: false,
      });
    }
  }

  // Generate adaptive reminders for all items
  const taskInputs = items.map(item => ({
    text: item.text,
    interpretation: item.interpretation,
    dayIndex: todayDayIdx,
  }));
  const reminders = generateAdaptiveReminders(taskInputs, data, weeklyData, selectedYear);

  // Attach reminders to items
  for (let i = 0; i < items.length && i < reminders.length; i++) {
    items[i].reminder = reminders[i] || null;
  }

  // Sort by optimal order: high priority first, then by prediction score (descending)
  const sorted = [...items].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const pDiff = priorityOrder[a.interpretation.priority] - priorityOrder[b.interpretation.priority];
    if (pDiff !== 0) return pDiff;
    return b.prediction.completeNowScore - a.prediction.completeNowScore;
  });

  const optimalOrder = sorted.map(item => item.id);

  // Summary
  const totalMinutes = items.reduce((sum, item) => sum + item.interpretation.estimatedMinutes, 0);
  const highPriorityCount = items.filter(item => item.interpretation.priority === "high").length;
  const avgPrediction = items.length > 0
    ? Math.round(items.reduce((sum, item) => sum + item.prediction.completeNowScore, 0) / items.length)
    : 0;

  let peakProductivityWindow: string;
  if (hour < 10) peakProductivityWindow = "9 AM – 12 PM";
  else if (hour < 14) peakProductivityWindow = "Now – 2 PM";
  else if (hour < 18) peakProductivityWindow = "Now – 6 PM";
  else peakProductivityWindow = "Tomorrow morning";

  const motivationalMessages = [
    `${items.length} items, ~${Math.round(totalMinutes / 60 * 10) / 10}h of work. You've got this!`,
    `Focus on the top 3 and you'll have a great day.`,
    `${highPriorityCount} high-priority items need your attention first.`,
    `Your prediction score is ${avgPrediction}% — conditions are ${avgPrediction >= 65 ? "great" : "decent"} for productivity.`,
    `Start with the hardest task while your energy is highest.`,
  ];
  const msgIdx = (currentDay + hour) % motivationalMessages.length;

  const summary: AgendaSummary = {
    totalItems: items.length,
    totalMinutes,
    highPriorityCount,
    predictedCompletionRate: avgPrediction,
    peakProductivityWindow,
    motivationalMessage: motivationalMessages[msgIdx],
  };

  return {
    items: sorted,
    summary,
    optimalOrder,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getTimeAlignmentScore(hour: number, category: TaskCategory): number {
  // Morning (5-12): best for deep work, health, planning
  // Afternoon (12-17): good for meetings, errands, social
  // Evening (17-22): wellness, creative, learning
  const morningCategories: TaskCategory[] = ["work", "health", "planning", "learning"];
  const afternoonCategories: TaskCategory[] = ["errands", "finance", "social"];
  const eveningCategories: TaskCategory[] = ["wellness", "creative", "home"];

  if (hour >= 5 && hour < 12) {
    return morningCategories.includes(category) ? 10 : afternoonCategories.includes(category) ? -3 : 0;
  } else if (hour >= 12 && hour < 17) {
    return afternoonCategories.includes(category) ? 8 : morningCategories.includes(category) ? 0 : -3;
  } else if (hour >= 17 && hour < 22) {
    return eveningCategories.includes(category) ? 8 : -5;
  }
  return -10; // late night
}

function getDayOfWeekScore(
  data: YearData,
  selectedYear: number,
  currentMonth: number,
  currentDay: number,
  targetDow: number
): number {
  // Look at last 4 weeks of this day-of-week
  const monthKey = getMonthKey(selectedYear, currentMonth);
  const monthData = data[monthKey] || { habits: [], days: {} };
  if (monthData.habits.length === 0) return 0;

  let totalRate = 0;
  let count = 0;

  for (let d = 1; d <= currentDay; d++) {
    const date = new Date(selectedYear, currentMonth - 1, d);
    const dow = (date.getDay() + 6) % 7;
    if (dow === targetDow) {
      const entry = monthData.days[d];
      if (entry) {
        totalRate += (entry.completedHabits.length / monthData.habits.length) * 100;
        count++;
      }
    }
  }

  if (count === 0) return 0;
  const avg = totalRate / count;
  // Compare to overall average
  let overallTotal = 0;
  let overallCount = 0;
  for (let d = 1; d <= currentDay; d++) {
    const entry = monthData.days[d];
    if (entry) {
      overallTotal += (entry.completedHabits.length / monthData.habits.length) * 100;
      overallCount++;
    }
  }
  const overallAvg = overallCount > 0 ? overallTotal / overallCount : 50;
  const diff = avg - overallAvg;

  if (diff > 15) return 12;
  if (diff > 5) return 6;
  if (diff < -15) return -10;
  if (diff < -5) return -5;
  return 0;
}

function getRecentMoodAvg(monthData: MonthData, currentDay: number, days: number): number {
  let total = 0;
  let count = 0;
  for (let d = Math.max(1, currentDay - days + 1); d <= currentDay; d++) {
    const entry = monthData.days[d];
    if (entry) {
      total += entry.mood;
      count++;
    }
  }
  return count > 0 ? total / count : 0;
}

function getDurationScore(minutes: number, hour: number): number {
  // Energy curve: high in morning, dips after lunch, moderate afternoon
  const energyLevel = hour < 10 ? 90 : hour < 13 ? 75 : hour < 15 ? 50 : hour < 18 ? 65 : hour < 21 ? 45 : 25;

  if (minutes <= 15) return 8; // quick tasks always doable
  if (minutes <= 30 && energyLevel >= 50) return 5;
  if (minutes <= 60 && energyLevel >= 65) return 3;
  if (minutes > 60 && energyLevel < 50) return -10;
  if (minutes > 60 && energyLevel >= 75) return 5;
  return 0;
}

function getWeeklyCompletionRate(weeklyData: WeeklyStore, now: Date): number {
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

function getHabitStrength(monthData: MonthData, upToDay: number, habitId: string): number {
  let done = 0;
  let total = 0;
  for (let d = 1; d <= upToDay; d++) {
    total++;
    if (monthData.days[d]?.completedHabits?.includes(habitId)) done++;
  }
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function getWeekKeyLocal(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ============================================================
// NATURAL LANGUAGE DATE/TIME PARSER
// Parses dates like "tuesday 17 feb 2026 at 13:00"
// ============================================================

export interface ParsedSchedule {
  date: Date | null;
  time: string | null; // "HH:MM" format
  dayOfWeek: number | null; // 0=Mon, 6=Sun (ISO)
  weekKey: string | null;
  dayIndex: number | null; // 0-6 for weekly planner
  cleanedText: string; // task text with date/time removed
  formattedDate: string | null; // human-readable
  formattedTime: string | null; // human-readable
  isToday: boolean;
  isTomorrow: boolean;
  isPast: boolean;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

const DAY_NAMES: Record<string, number> = {
  monday: 0, mon: 0, tuesday: 1, tue: 1, tues: 1,
  wednesday: 2, wed: 2, thursday: 3, thu: 3, thur: 3, thurs: 3,
  friday: 4, fri: 4, saturday: 5, sat: 5, sunday: 6, sun: 6,
};

export function parseSchedule(text: string): ParsedSchedule {
  const lower = text.toLowerCase().trim();
  let cleaned = text;
  let date: Date | null = null;
  let time: string | null = null;

  // 1. Parse time patterns: "at 13:00", "at 1pm", "at 9:30am", "13:00"
  const timePatterns = [
    /\bat\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i,
    /\bat\s+(\d{1,2})\s*(am|pm)/i,
    /(?:^|\s)(\d{1,2}):(\d{2})\s*(am|pm)?(?:\s|$)/i,
  ];

  for (const pat of timePatterns) {
    const match = lower.match(pat);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const ampm = (match[3] || "").toLowerCase();
      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        cleaned = cleaned.replace(pat, " ").trim();
      }
      break;
    }
  }

  // 2. Parse explicit dates: "17 feb 2026", "feb 17 2026", "17/02/2026", "2026-02-17"
  const datePatterns: { pattern: RegExp; handler: (m: RegExpMatchArray) => Date | null }[] = [
    // "17 feb 2026" or "17 february 2026"
    {
      pattern: /(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})/i,
      handler: (m) => {
        const day = parseInt(m[1], 10);
        const monthStr = m[2].toLowerCase().slice(0, 3);
        const month = MONTH_NAMES[monthStr];
        const year = parseInt(m[3], 10);
        if (month !== undefined && day >= 1 && day <= 31) return new Date(year, month, day);
        return null;
      },
    },
    // "feb 17 2026" or "february 17, 2026"
    {
      pattern: /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i,
      handler: (m) => {
        const monthStr = m[1].toLowerCase().slice(0, 3);
        const month = MONTH_NAMES[monthStr];
        const day = parseInt(m[2], 10);
        const year = parseInt(m[3], 10);
        if (month !== undefined && day >= 1 && day <= 31) return new Date(year, month, day);
        return null;
      },
    },
    // "17 feb" or "feb 17" (no year, assume current/next occurrence)
    {
      pattern: /(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i,
      handler: (m) => {
        const day = parseInt(m[1], 10);
        const monthStr = m[2].toLowerCase().slice(0, 3);
        const month = MONTH_NAMES[monthStr];
        if (month === undefined || day < 1 || day > 31) return null;
        const now = new Date();
        let year = now.getFullYear();
        const candidate = new Date(year, month, day);
        if (candidate < now) candidate.setFullYear(year + 1);
        return candidate;
      },
    },
    // "feb 17" (no year)
    {
      pattern: /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
      handler: (m) => {
        const monthStr = m[1].toLowerCase().slice(0, 3);
        const month = MONTH_NAMES[monthStr];
        const day = parseInt(m[2], 10);
        if (month === undefined || day < 1 || day > 31) return null;
        const now = new Date();
        let year = now.getFullYear();
        const candidate = new Date(year, month, day);
        if (candidate < now) candidate.setFullYear(year + 1);
        return candidate;
      },
    },
    // "dd/mm/yyyy" or "dd-mm-yyyy"
    {
      pattern: /(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/,
      handler: (m) => {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const year = parseInt(m[3], 10);
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) return new Date(year, month, day);
        return null;
      },
    },
  ];

  for (const { pattern, handler } of datePatterns) {
    const match = lower.match(pattern);
    if (match) {
      const parsed = handler(match);
      if (parsed && !isNaN(parsed.getTime())) {
        date = parsed;
        cleaned = cleaned.replace(pattern, " ").trim();
        break;
      }
    }
  }

  // 3. Parse relative dates: "today", "tomorrow", "next monday"
  if (!date) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (/\btoday\b/i.test(lower)) {
      date = new Date(now);
      cleaned = cleaned.replace(/\btoday\b/i, "").trim();
    } else if (/\btomorrow\b/i.test(lower)) {
      date = new Date(now);
      date.setDate(date.getDate() + 1);
      cleaned = cleaned.replace(/\btomorrow\b/i, "").trim();
    } else if (/\bday after tomorrow\b/i.test(lower)) {
      date = new Date(now);
      date.setDate(date.getDate() + 2);
      cleaned = cleaned.replace(/\bday after tomorrow\b/i, "").trim();
    } else {
      // "next tuesday", "on wednesday", "this friday", or just "tuesday"
      const dayMatch = lower.match(/(?:(?:next|this|on)\s+)?(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/i);
      if (dayMatch) {
        const targetDow = DAY_NAMES[dayMatch[1].toLowerCase()];
        if (targetDow !== undefined) {
          const currentDow = (now.getDay() + 6) % 7; // Mon=0
          let daysAhead = targetDow - currentDow;
          if (daysAhead <= 0) daysAhead += 7;
          if (/\bnext\b/i.test(dayMatch[0]) && daysAhead <= 7) daysAhead += 7;
          date = new Date(now);
          date.setDate(date.getDate() + daysAhead);
          cleaned = cleaned.replace(dayMatch[0], "").trim();
        }
      }
    }
  }

  // 4. Clean up the task text
  // Remove leading "add" command
  cleaned = cleaned.replace(/^\s*add\s+/i, "").trim();
  // Remove dangling prepositions
  cleaned = cleaned.replace(/\s+(on|at|for|by)\s*$/i, "").trim();
  // Remove double spaces
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // 5. Compute derived fields
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let dayOfWeek: number | null = null;
  let weekKey: string | null = null;
  let dayIndex: number | null = null;
  let formattedDate: string | null = null;
  let formattedTime: string | null = null;
  let isToday = false;
  let isTomorrow = false;
  let isPast = false;

  if (date) {
    dayOfWeek = (date.getDay() + 6) % 7; // Mon=0
    dayIndex = dayOfWeek;
    weekKey = getWeekKeyForDate(date);

    const todayStr = now.toDateString();
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);

    isToday = date.toDateString() === todayStr;
    isTomorrow = date.toDateString() === tomorrowDate.toDateString();
    isPast = date < now;

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    formattedDate = isToday
      ? "Today"
      : isTomorrow
      ? "Tomorrow"
      : `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  if (time) {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    formattedTime = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  return {
    date,
    time,
    dayOfWeek,
    weekKey,
    dayIndex,
    cleanedText: cleaned,
    formattedDate,
    formattedTime,
    isToday,
    isTomorrow,
    isPast,
  };
}

function getWeekKeyForDate(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ============================================================
// CATEGORY & DURATION DISPLAY HELPERS
// ============================================================

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  work: "Work",
  health: "Health",
  learning: "Learning",
  finance: "Finance",
  social: "Social",
  creative: "Creative",
  errands: "Errands",
  planning: "Planning",
  wellness: "Wellness",
  home: "Home",
};

export const CATEGORY_COLORS: Record<TaskCategory, { bg: string; text: string; border: string }> = {
  work: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  health: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  learning: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  finance: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800" },
  social: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
  creative: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  errands: { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
  planning: { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  wellness: { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
  home: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
};

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
