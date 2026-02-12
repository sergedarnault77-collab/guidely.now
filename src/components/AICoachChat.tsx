import { useState, useRef, useEffect, useMemo } from "react";
import { useAIAccess } from "@/hooks/useAIAccess";
import { LockedFeature } from "@/lib/subscription";
import type { UserBehaviorProfile, HabitProfile, BurnoutAnalysis, ProcrastinationAnalysis, FocusTimeAnalysis, SuggestedRoutine } from "../lib/behavior-analytics";

interface ChatMessage {
  id: string;
  role: "user" | "coach";
  content: string;
  timestamp: Date;
}

interface AICoachChatProps {
  profile: UserBehaviorProfile;
}

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ---- Context-Aware Response Engine ----

function generateCoachResponse(
  question: string,
  profile: UserBehaviorProfile
): string {
  const lower = question.toLowerCase().trim();

  // "Why do I keep delaying..." / procrastination questions
  if (lower.includes("delay") || lower.includes("procrastinat") || lower.includes("putting off") || lower.includes("avoid") || lower.includes("skip")) {
    return handleProcrastinationQuestion(lower, profile);
  }

  // "How should I plan tomorrow?" / planning questions
  if (lower.includes("plan") || lower.includes("tomorrow") || lower.includes("schedule") || lower.includes("organize")) {
    return handlePlanningQuestion(lower, profile);
  }

  // Burnout / stress / overwhelmed questions
  if (lower.includes("burnout") || lower.includes("overwhelm") || lower.includes("stress") || lower.includes("tired") || lower.includes("exhausted")) {
    return handleBurnoutQuestion(profile);
  }

  // Focus / productivity questions
  if (lower.includes("focus") || lower.includes("productive") || lower.includes("concentration") || lower.includes("distract") || lower.includes("best time")) {
    return handleFocusQuestion(profile);
  }

  // Mood questions
  if (lower.includes("mood") || lower.includes("feel") || lower.includes("motivation") || lower.includes("energy") || lower.includes("happy") || lower.includes("sad")) {
    return handleMoodQuestion(profile);
  }

  // Habit-specific questions
  if (lower.includes("habit") || lower.includes("streak") || lower.includes("routine") || lower.includes("consistent")) {
    return handleHabitQuestion(lower, profile);
  }

  // Weekend questions
  if (lower.includes("weekend") || lower.includes("saturday") || lower.includes("sunday")) {
    return handleWeekendQuestion(profile);
  }

  // "What should I focus on?" / priority questions
  if (lower.includes("focus on") || lower.includes("priority") || lower.includes("important") || lower.includes("what should")) {
    return handlePriorityQuestion(profile);
  }

  // "How am I doing?" / progress questions
  if (lower.includes("how am i") || lower.includes("progress") || lower.includes("doing") || lower.includes("performance") || lower.includes("stats")) {
    return handleProgressQuestion(profile);
  }

  // Routine suggestions
  if (lower.includes("routine") || lower.includes("suggest") || lower.includes("recommend") || lower.includes("improve")) {
    return handleRoutineQuestion(profile);
  }

  // Default: general coaching based on current state
  return handleGeneralQuestion(profile);
}

function handleProcrastinationQuestion(question: string, profile: UserBehaviorProfile): string {
  const { procrastinationAnalysis: pa, habitProfiles } = profile;
  const parts: string[] = [];

  parts.push(`Based on your data, your procrastination score is **${pa.score}/100**. Here's what I see:\n`);

  if (pa.triggers.length > 0) {
    parts.push("**Your main procrastination triggers:**\n");
    for (const trigger of pa.triggers.slice(0, 3)) {
      parts.push(`${trigger.emoji} **${trigger.trigger}**: ${trigger.description}\n`);
      parts.push(`   💡 *${trigger.suggestion}*\n`);
    }
  }

  // Check if they asked about a specific task type
  const adminWords = ["admin", "email", "paperwork", "organize", "clean"];
  const fitnessWords = ["gym", "exercise", "workout", "run"];
  const isAskingAboutAdmin = adminWords.some(w => question.includes(w));
  const isAskingAboutFitness = fitnessWords.some(w => question.includes(w));

  if (isAskingAboutAdmin) {
    parts.push("\n**About admin tasks specifically:**\nAdmin tasks lack immediate reward, making them easy to defer. Try the \"2-minute rule\" — if it takes less than 2 minutes, do it now. For longer admin, batch them into a 30-minute \"admin block\" on your best productivity day.");
  } else if (isAskingAboutFitness) {
    const fitnessHabit = habitProfiles.find(h => fitnessWords.some(w => h.habitName.toLowerCase().includes(w)));
    if (fitnessHabit) {
      parts.push(`\n**About "${fitnessHabit.habitName}":**\nYour completion rate is ${fitnessHabit.completionRate}%. ${fitnessHabit.completionRate < 50 ? "The key is lowering the bar — commit to just showing up for 10 minutes. Once you start, you'll usually continue." : "You're actually doing well! Focus on consistency over intensity."}`);
    }
  }

  if (pa.recoverySpeed === "slow") {
    parts.push("\n⚠️ **Recovery pattern**: When you miss a day, it takes you a while to bounce back. Try the \"never miss twice\" rule — one miss is fine, but get back on track the very next day.");
  } else if (pa.recoverySpeed === "fast") {
    parts.push("\n✅ **Good news**: You bounce back quickly after misses. That resilience is a huge strength!");
  }

  return parts.join("");
}

function handlePlanningQuestion(question: string, profile: UserBehaviorProfile): string {
  const { focusAnalysis, habitProfiles, burnoutAnalysis, procrastinationAnalysis } = profile;
  const parts: string[] = [];
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = WEEKDAY_NAMES[(tomorrow.getDay() + 6) % 7];

  parts.push(`**Planning for ${tomorrowDay}:**\n`);

  // Check if tomorrow is a peak day
  const tomorrowDow = (tomorrow.getDay() + 6) % 7;
  const isPeakDay = profile.peakDays.includes(tomorrowDow);

  if (isPeakDay) {
    parts.push(`🌟 ${tomorrowDay} is one of your **peak productivity days**! Schedule your hardest tasks here.\n`);
  } else {
    parts.push(`${tomorrowDay} isn't your strongest day. Keep expectations realistic and focus on essentials.\n`);
  }

  // Focus windows
  if (focusAnalysis.peakFocusWindows.length > 0) {
    const peak = focusAnalysis.peakFocusWindows[0];
    parts.push(`\n⏰ **Best focus window**: ${peak.start}:00-${peak.end}:00 (${peak.label})\n`);
    parts.push("Schedule your most important habit or task during this window.\n");
  }

  // Priority habits
  const atRisk = habitProfiles.filter(h => h.abandonmentRisk >= 40).sort((a, b) => b.abandonmentRisk - a.abandonmentRisk);
  const strong = habitProfiles.filter(h => h.completionRate >= 80);

  if (atRisk.length > 0) {
    parts.push(`\n🎯 **Priority habits** (at risk of being dropped):\n`);
    atRisk.slice(0, 3).forEach(h => {
      parts.push(`   • ${h.habitName} (${h.completionRate}% completion)\n`);
    });
  }

  // Burnout check
  if (burnoutAnalysis.stage === "warning" || burnoutAnalysis.stage === "burnout") {
    parts.push(`\n⚠️ **Burnout alert**: Your burnout risk is ${burnoutAnalysis.riskLevel}%. Plan a lighter day — aim for 70% of your normal load. Rest is productive too.\n`);
  }

  // Suggested structure
  parts.push("\n**Suggested structure:**\n");
  parts.push(`1. 🌅 Start with your easiest habit to build momentum\n`);
  if (atRisk.length > 0) {
    parts.push(`2. 🎯 Tackle "${atRisk[0].habitName}" during your peak focus window\n`);
  } else {
    parts.push(`2. 🎯 Do your most important task during peak focus\n`);
  }
  parts.push(`3. 📋 Batch any quick tasks (< 15 min) in the afternoon\n`);
  parts.push(`4. 🧘 End with a wind-down habit or reflection\n`);

  return parts.join("");
}

function handleBurnoutQuestion(profile: UserBehaviorProfile): string {
  const { burnoutAnalysis: ba } = profile;
  const parts: string[] = [];

  const stageEmoji = { thriving: "🌟", strained: "😤", warning: "⚠️", burnout: "🔥" };
  const stageLabel = { thriving: "Thriving", strained: "Strained", warning: "Warning", burnout: "Burnout" };

  parts.push(`**Burnout Assessment: ${stageEmoji[ba.stage]} ${stageLabel[ba.stage]}**\n`);
  parts.push(`Risk level: **${ba.riskLevel}/100**\n`);

  if (ba.factors.length > 0) {
    parts.push("\n**Contributing factors:**\n");
    ba.factors.forEach(f => {
      parts.push(`${f.emoji} ${f.label} (impact: ${f.impact}/30) — ${f.detail}\n`);
    });
  }

  if (ba.trend === "increasing") {
    parts.push(`\n📈 **Trend**: Burnout risk is **increasing**. ${ba.daysUntilCritical ? `At this rate, you could hit critical levels in ~${ba.daysUntilCritical} days.` : ""}\n`);
  } else if (ba.trend === "decreasing") {
    parts.push("\n📉 **Trend**: Good news — burnout risk is **decreasing**. Keep up the recovery.\n");
  }

  if (ba.recoveryActions.length > 0) {
    parts.push("\n**Recommended actions:**\n");
    ba.recoveryActions.forEach((action, i) => {
      parts.push(`${i + 1}. ${action}\n`);
    });
  }

  if (ba.stage === "thriving") {
    parts.push("\nYou're in great shape! Your energy and motivation are sustainable. Keep doing what you're doing. 💪");
  }

  return parts.join("");
}

function handleFocusQuestion(profile: UserBehaviorProfile): string {
  const { focusAnalysis: fa } = profile;
  const parts: string[] = [];

  parts.push("**Your Focus Profile:**\n");
  parts.push(`Average productive hours: **${fa.avgProductiveHours}h/day**\n`);

  parts.push("\n**Time-of-day effectiveness:**\n");
  parts.push(`🌅 Morning: ${fa.timeOfDaySplit.morning}%\n`);
  parts.push(`☀️ Afternoon: ${fa.timeOfDaySplit.afternoon}%\n`);
  parts.push(`🌙 Evening: ${fa.timeOfDaySplit.evening}%\n`);

  if (fa.peakFocusWindows.length > 0) {
    parts.push("\n**Peak focus windows:**\n");
    fa.peakFocusWindows.forEach(w => {
      parts.push(`⏰ ${w.label}: ${w.start}:00-${w.end}:00 (${w.score}% effective)\n`);
    });
  }

  parts.push(`\n🏆 **Optimal slot**: ${fa.optimalSlot.day} during ${fa.optimalSlot.time} (${fa.optimalSlot.score}% effectiveness)\n`);

  // Weekly heatmap
  parts.push("\n**Weekly focus heatmap:**\n");
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  fa.weeklyFocusHeatmap.forEach((score, i) => {
    const bar = "█".repeat(Math.round(score / 10)) + "░".repeat(10 - Math.round(score / 10));
    parts.push(`${dayNames[i]}: ${bar} ${score}%\n`);
  });

  parts.push("\n💡 **Tip**: Protect your peak windows fiercely. No meetings, no distractions. This is when you do your best work.");

  return parts.join("");
}

function handleMoodQuestion(profile: UserBehaviorProfile): string {
  const parts: string[] = [];

  const moodEmoji = profile.avgMood >= 7 ? "😊" : profile.avgMood >= 5 ? "😐" : "😔";
  parts.push(`**Mood & Energy Report** ${moodEmoji}\n`);
  parts.push(`Average mood: **${profile.avgMood}/10**\n`);
  parts.push(`Average motivation: **${profile.avgMotivation}/10**\n`);
  parts.push(`Mood trend: ${profile.moodTrend > 0 ? "📈 Improving" : profile.moodTrend < -0.5 ? "📉 Declining" : "→ Stable"} (${profile.moodTrend > 0 ? "+" : ""}${profile.moodTrend})\n`);

  parts.push(`\nMood-productivity correlation: **${profile.moodProductivityCorrelation > 0.3 ? "Strong" : profile.moodProductivityCorrelation > 0 ? "Moderate" : "Weak"}** (r=${profile.moodProductivityCorrelation.toFixed(2)})\n`);

  if (profile.moodProductivityCorrelation > 0.3) {
    parts.push("Your mood strongly drives your habits. On low days, focus on mood-boosting activities first (exercise, social connection, nature).\n");
  } else {
    parts.push("Your habits are fairly independent of mood — that's a sign of strong discipline! Keep it up.\n");
  }

  if (profile.moodTrend < -1) {
    parts.push("\n⚠️ Your mood has been declining. Consider:\n");
    parts.push("• Reducing your habit load temporarily\n");
    parts.push("• Adding a daily gratitude or joy practice\n");
    parts.push("• Talking to someone you trust\n");
  }

  return parts.join("");
}

function handleHabitQuestion(question: string, profile: UserBehaviorProfile): string {
  const { habitProfiles } = profile;
  const parts: string[] = [];

  if (habitProfiles.length === 0) {
    return "You don't have any habits tracked yet! Head to the Monthly Tracker to add your first habits. Start with just 2-3 — you can always add more later.";
  }

  // Check if asking about a specific habit
  const specificHabit = habitProfiles.find(h =>
    question.includes(h.habitName.toLowerCase())
  );

  if (specificHabit) {
    parts.push(`**"${specificHabit.habitName}" Deep Dive:**\n`);
    parts.push(`Completion: ${specificHabit.completionRate}% | Streak: ${specificHabit.currentStreak}d | Best: ${specificHabit.longestStreak}d\n`);
    parts.push(`Trend: ${specificHabit.trend > 0 ? "📈 +" : specificHabit.trend < 0 ? "📉 " : "→ "}${specificHabit.trend}%\n`);
    parts.push(`Best day: ${WEEKDAY_NAMES[specificHabit.bestDayOfWeek]} | Worst: ${WEEKDAY_NAMES[specificHabit.worstDayOfWeek]}\n`);
    parts.push(`Consistency: ${specificHabit.consistencyScore}% | Risk: ${specificHabit.abandonmentRisk}%\n`);
    if (specificHabit.isAutomatic) {
      parts.push("\n✅ This habit is **automatic** — it requires minimal willpower. Consider leveling it up or adding a new challenge.\n");
    } else if (specificHabit.abandonmentRisk >= 60) {
      parts.push("\n⚠️ This habit is **at risk**. Try:\n• Reducing the difficulty (e.g., 5 min instead of 30)\n• Pairing it with a strong habit\n• Doing it at the same time every day\n");
    }
    return parts.join("");
  }

  // General habit overview
  const automatic = habitProfiles.filter(h => h.isAutomatic);
  const atRisk = habitProfiles.filter(h => h.abandonmentRisk >= 50);
  const improving = habitProfiles.filter(h => h.trend > 10);

  parts.push("**Habit Health Overview:**\n");
  parts.push(`Total habits: ${habitProfiles.length}\n`);
  if (automatic.length > 0) parts.push(`🤖 Automatic (85%+): ${automatic.map(h => h.habitName).join(", ")}\n`);
  if (improving.length > 0) parts.push(`📈 Improving: ${improving.map(h => h.habitName).join(", ")}\n`);
  if (atRisk.length > 0) parts.push(`⚠️ At risk: ${atRisk.map(h => h.habitName).join(", ")}\n`);

  const avgCompletion = Math.round(habitProfiles.reduce((s, h) => s + h.completionRate, 0) / habitProfiles.length);
  parts.push(`\nAverage completion: ${avgCompletion}%\n`);

  if (habitProfiles.length > 6) {
    parts.push("\n💡 You have quite a few habits. Research shows 3-5 is optimal. Consider archiving your automatic ones and focusing on the ones that need attention.");
  }

  return parts.join("");
}

function handleWeekendQuestion(profile: UserBehaviorProfile): string {
  const parts: string[] = [];
  const gap = profile.weekdayWeekendGap;

  parts.push("**Weekend Performance Analysis:**\n");
  parts.push(`Weekday vs weekend gap: **${Math.abs(gap)}%** ${gap > 0 ? "(weekdays stronger)" : "(weekends stronger)"}\n`);

  if (gap > 20) {
    parts.push("\nYour weekends are a significant weak spot. Here's why this happens:\n");
    parts.push("• **No external structure** — without work/school, routines dissolve\n");
    parts.push("• **\"I deserve a break\" mindset** — rest is good, but zero habits isn't rest\n");
    parts.push("• **Social pressure** — weekend plans disrupt routines\n");
    parts.push("\n**Fix it:**\n");
    parts.push("1. Pick just 2 non-negotiable weekend habits\n");
    parts.push("2. Anchor them to something you already do (coffee, waking up)\n");
    parts.push("3. Allow yourself to do the minimum version (1 pushup counts)\n");
  } else if (gap > 10) {
    parts.push("\nSlight weekend dip — this is normal. A minimal weekend routine would close the gap.");
  } else {
    parts.push("\n✅ Great weekend consistency! You maintain your routines regardless of the day. That's a sign of strong habit formation.");
  }

  return parts.join("");
}

function handlePriorityQuestion(profile: UserBehaviorProfile): string {
  const { habitProfiles, burnoutAnalysis, procrastinationAnalysis } = profile;
  const parts: string[] = [];

  parts.push("**Your Top Priorities Right Now:**\n");

  let priority = 1;

  // Burnout first
  if (burnoutAnalysis.stage === "warning" || burnoutAnalysis.stage === "burnout") {
    parts.push(`${priority}. 🛑 **Recovery** — Your burnout risk is ${burnoutAnalysis.riskLevel}%. Nothing else matters if you burn out. Reduce load and rest.\n`);
    priority++;
  }

  // At-risk habits
  const atRisk = habitProfiles.filter(h => h.abandonmentRisk >= 60);
  if (atRisk.length > 0) {
    parts.push(`${priority}. 🆘 **Rescue "${atRisk[0].habitName}"** — At ${atRisk[0].abandonmentRisk}% abandonment risk. Do the minimum version today.\n`);
    priority++;
  }

  // Procrastination trigger
  if (procrastinationAnalysis.triggers.length > 0) {
    const trigger = procrastinationAnalysis.triggers[0];
    parts.push(`${priority}. ⏰ **Address ${trigger.trigger}** — ${trigger.suggestion}\n`);
    priority++;
  }

  // Improving habits to maintain
  const improving = habitProfiles.filter(h => h.trend > 15);
  if (improving.length > 0) {
    parts.push(`${priority}. 📈 **Maintain momentum** on ${improving.map(h => `"${h.habitName}"`).join(", ")} — they're trending up!\n`);
    priority++;
  }

  if (priority === 1) {
    parts.push("You're in good shape! Focus on maintaining your current habits and consider adding a new challenge.");
  }

  return parts.join("");
}

function handleProgressQuestion(profile: UserBehaviorProfile): string {
  const parts: string[] = [];

  parts.push("**Your Progress Report:**\n");
  parts.push(`📊 Productivity score: **${profile.productivityScore}%**\n`);
  parts.push(`😊 Average mood: **${profile.avgMood}/10** (${profile.moodTrend > 0 ? "improving" : profile.moodTrend < -0.5 ? "declining" : "stable"})\n`);
  parts.push(`⚡ Motivation: **${profile.avgMotivation}/10**\n`);
  parts.push(`📋 Weekly task rate: **${profile.weeklyTaskRate}%**\n`);
  parts.push(`🏆 Perfect days this month: **${profile.perfectDaysThisMonth}**\n`);

  if (profile.peakDays.length > 0) {
    parts.push(`⭐ Peak days: ${profile.peakDays.map(d => WEEKDAY_NAMES[d]).join(", ")}\n`);
  }

  const avgCompletion = profile.habitProfiles.length > 0
    ? Math.round(profile.habitProfiles.reduce((s, h) => s + h.completionRate, 0) / profile.habitProfiles.length)
    : 0;

  if (avgCompletion >= 70) {
    parts.push("\n🌟 You're doing great! Your consistency is above average. Keep pushing toward making more habits automatic.");
  } else if (avgCompletion >= 40) {
    parts.push("\n👍 Solid progress. Focus on your weakest 1-2 habits to push your overall score higher.");
  } else {
    parts.push("\n💪 Room to grow! Start by nailing just 2-3 habits consistently before adding more.");
  }

  return parts.join("");
}

function handleRoutineQuestion(profile: UserBehaviorProfile): string {
  const { suggestedRoutines } = profile;
  const parts: string[] = [];

  if (suggestedRoutines.length === 0) {
    return "Based on your current data, I don't have enough information to suggest specific routines yet. Keep tracking for a few more days and I'll have personalized suggestions!";
  }

  parts.push("**AI-Suggested Routines:**\n");
  parts.push("Based on your behavior patterns, here are routines that could help:\n");

  suggestedRoutines.slice(0, 3).forEach((routine, i) => {
    parts.push(`\n${i + 1}. ${routine.emoji} **${routine.name}** (${routine.frequency}${routine.suggestedDay ? `, ${routine.suggestedDay}` : ""}${routine.suggestedTime ? ` at ${routine.suggestedTime}` : ""})\n`);
    parts.push(`   ${routine.description}\n`);
    parts.push(`   Tasks: ${routine.tasks.join(" → ")}\n`);
    parts.push(`   *${routine.rationale}*\n`);
  });

  return parts.join("");
}

function handleGeneralQuestion(profile: UserBehaviorProfile): string {
  const parts: string[] = [];

  parts.push("I'm your AI productivity coach! I analyze your habit data to give personalized advice. Try asking me:\n\n");
  parts.push("💬 **\"Why do I keep delaying admin tasks?\"** — I'll analyze your procrastination patterns\n");
  parts.push("📋 **\"How should I plan tomorrow?\"** — I'll create a personalized plan\n");
  parts.push("🔥 **\"Am I burning out?\"** — I'll assess your burnout risk\n");
  parts.push("⏰ **\"When am I most productive?\"** — I'll show your focus times\n");
  parts.push("😊 **\"How's my mood affecting me?\"** — I'll analyze mood-productivity links\n");
  parts.push("📊 **\"How am I doing?\"** — I'll give you a progress report\n");
  parts.push("🔄 **\"Suggest a routine\"** — I'll recommend routines based on your patterns\n");
  parts.push("📅 **\"Why are my weekends bad?\"** — I'll explain weekend patterns\n");
  parts.push("🎯 **\"What should I focus on?\"** — I'll prioritize for you\n");

  // Add a contextual nudge
  if (profile.burnoutAnalysis.stage === "warning" || profile.burnoutAnalysis.stage === "burnout") {
    parts.push(`\n⚠️ *I notice your burnout risk is elevated (${profile.burnoutAnalysis.riskLevel}%). Ask me about burnout for specific advice.*`);
  } else if (profile.procrastinationAnalysis.triggers.length > 0) {
    parts.push(`\n💡 *I've detected ${profile.procrastinationAnalysis.triggers.length} procrastination trigger(s). Ask me why you're delaying tasks for insights.*`);
  }

  return parts.join("");
}

// ---- Quick Question Chips ----

const QUICK_QUESTIONS = [
  { label: "Plan tomorrow", question: "How should I plan tomorrow?", emoji: "📋" },
  { label: "Why do I procrastinate?", question: "Why do I keep delaying tasks?", emoji: "⏳" },
  { label: "Am I burning out?", question: "Am I at risk of burnout?", emoji: "🔥" },
  { label: "Best focus time", question: "When am I most productive?", emoji: "⏰" },
  { label: "How am I doing?", question: "How am I doing overall?", emoji: "📊" },
  { label: "Suggest routines", question: "Suggest a routine for me", emoji: "🔄" },
];

// ---- Chat Component ----

export function AICoachChat({ profile }: AICoachChatProps) {
  const { enabled, reason } = useAIAccess();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!enabled) {
    return (
      <LockedFeature
        reason={reason === "upgrade" ? "needs_pro" : "needs_cloud"}
        featureLabel="AI coach chat"
      />
    );
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (text?: string) => {
    const question = (text || input).trim();
    if (!question) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate brief thinking delay for natural feel
    setTimeout(() => {
      const response = generateCoachResponse(question, profile);
      const coachMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "coach",
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, coachMsg]);
      setIsTyping(false);
    }, 400 + Math.random() * 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format markdown-like text
  const formatMessage = (text: string) => {
    return text.split("\n").map((line, i) => {
      // Bold
      let formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // Italic
      formatted = formatted.replace(/\*(.+?)\*/g, '<em class="text-gray-500 dark:text-gray-400">$1</em>');

      return (
        <span key={i} className="block" dangerouslySetInnerHTML={{ __html: formatted || "&nbsp;" }} />
      );
    });
  };

  return (
    <div className="bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-gray-800/80 dark:via-gray-800/60 dark:to-violet-900/20 rounded-2xl border border-violet-200/50 dark:border-violet-700/30 overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/30 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <span className="text-white text-lg">💬</span>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              AI Coach
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300 uppercase tracking-wider">
                Context-Aware
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ask me anything about your habits, productivity, or wellbeing
            </p>
          </div>
        </div>
        <span className={`text-sm transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>▾</span>
      </button>

      {isExpanded && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Quick Questions */}
          {messages.length === 0 && (
            <div className="px-4 pb-3">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-bold mb-2">Quick questions</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => handleSend(q.question)}
                    className="px-3 py-1.5 text-xs rounded-full bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-300 dark:hover:border-violet-600 transition-all duration-200"
                  >
                    {q.emoji} {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            className="px-4 space-y-3 max-h-[400px] overflow-y-auto"
            style={{ minHeight: messages.length > 0 ? "200px" : "0" }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-500 text-white rounded-br-md"
                      : "bg-white dark:bg-gray-700/50 border border-gray-200/60 dark:border-gray-600/40 text-gray-700 dark:text-gray-300 rounded-bl-md"
                  }`}
                >
                  {msg.role === "coach" ? formatMessage(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-700/50 border border-gray-200/60 dark:border-gray-600/40 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200/30 dark:border-gray-700/20">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your AI coach..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                disabled={isTyping}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className="px-4 py-2.5 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-violet-500/20 hover:shadow-violet-500/40 transition-all duration-200"
              >
                Send
              </button>
            </div>
            {messages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {QUICK_QUESTIONS.slice(0, 4).map((q) => (
                  <button
                    key={q.label}
                    onClick={() => handleSend(q.question)}
                    disabled={isTyping}
                    className="px-2 py-1 text-[10px] rounded-full bg-gray-100 dark:bg-gray-700/30 text-gray-500 dark:text-gray-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-40"
                  >
                    {q.emoji} {q.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
