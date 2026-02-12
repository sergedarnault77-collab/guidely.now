import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useCloudStatus } from "./cloud-status";
import type { Entitlement, EntitlementSource } from "./types";
import { FREE_ENTITLEMENT } from "./types";

// ---- Plan Definitions ----

export type PlanTier = "free" | "pro";

export interface PlanFeatures {
  aiTaskInput: boolean;
  aiDailyAgenda: boolean;
  aiInsights: boolean;
  aiWeeklyPlanning: boolean;
  aiPredictions: boolean;
  aiBanner: boolean;
  aiNotifications: boolean;
  aiBehaviorInsights: boolean;
  aiCoachChat: boolean;
}

const FREE_FEATURES: PlanFeatures = {
  aiTaskInput: false,
  aiDailyAgenda: false,
  aiInsights: false,
  aiWeeklyPlanning: false,
  aiPredictions: false,
  aiBanner: false,
  aiNotifications: false,
  aiBehaviorInsights: false,
  aiCoachChat: false,
};

const PRO_FEATURES: PlanFeatures = {
  aiTaskInput: true,
  aiDailyAgenda: true,
  aiInsights: true,
  aiWeeklyPlanning: true,
  aiPredictions: true,
  aiBanner: true,
  aiNotifications: true,
  aiBehaviorInsights: true,
  aiCoachChat: true,
};

export const PLAN_DETAILS = {
  free: {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Manual tracking with full control",
    features: FREE_FEATURES,
    highlights: [
      "Create and manage tasks & habits",
      "Daily, weekly, and monthly views",
      "Basic stats, streaks & progress",
      "Local data storage",
    ],
  },
  pro: {
    name: "Pro",
    price: "$9",
    period: "/month",
    description: "AI-powered executive planning",
    features: PRO_FEATURES,
    highlights: [
      "Everything in Free",
      "AI smart task input with scheduling",
      "AI-prioritised daily agenda",
      "AI insights, explanations & recommendations",
      "Weekly AI planning & rebalancing",
      "Predictive completion & confidence scores",
      "AI behavioral analytics",
      "AI coach chat",
      "Cloud sync across devices",
    ],
  },
} as const;

// ---- Entitlement Helpers ----

const ENTITLEMENT_STORAGE_KEY = "guidely-entitlement";

function loadEntitlement(): Entitlement {
  try {
    const raw = localStorage.getItem(ENTITLEMENT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Entitlement;
      // Auto-expire if expiresAt is in the past
      if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
        return FREE_ENTITLEMENT;
      }
      return parsed;
    }
    // Migrate from old "guidely-plan-tier" key
    const legacyPlan = localStorage.getItem("guidely-plan-tier");
    if (legacyPlan === "pro") {
      const migrated: Entitlement = { isPro: true, source: "dev_toggle", expiresAt: null };
      localStorage.setItem(ENTITLEMENT_STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem("guidely-plan-tier");
      return migrated;
    }
  } catch {}
  return FREE_ENTITLEMENT;
}

function saveEntitlement(ent: Entitlement) {
  try {
    localStorage.setItem(ENTITLEMENT_STORAGE_KEY, JSON.stringify(ent));
  } catch {}
}

/** Check if an entitlement is currently valid (not expired) */
function isEntitlementActive(ent: Entitlement): boolean {
  if (!ent.isPro) return false;
  if (ent.expiresAt && new Date(ent.expiresAt).getTime() < Date.now()) return false;
  return true;
}

// ---- Context ----

interface SubscriptionContextValue {
  /** Current entitlement object — single source of truth */
  entitlement: Entitlement;
  /** Update entitlement (from any source: dev toggle, Stripe, App Store, etc.) */
  setEntitlement: (ent: Entitlement) => void;
  /** Derived: current plan tier */
  plan: PlanTier;
  /** Derived: feature flags for current plan */
  features: PlanFeatures;
  /** Derived: whether user has active Pro access */
  isPro: boolean;
  /** Check if a specific feature is available */
  canUse: (feature: keyof PlanFeatures) => boolean;
  /**
   * @deprecated Use setEntitlement() instead. Kept for backward compatibility.
   * Maps "pro" → setEntitlement({ isPro: true, source: "dev_toggle", expiresAt: null })
   * Maps "free" → setEntitlement(FREE_ENTITLEMENT)
   */
  setPlan: (plan: PlanTier) => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [entitlement, setEntitlementState] = useState<Entitlement>(() => loadEntitlement());

  // Auto-expire check: runs once per minute
  useEffect(() => {
    if (!entitlement.expiresAt) return;
    const expiresMs = new Date(entitlement.expiresAt).getTime();
    const remaining = expiresMs - Date.now();
    if (remaining <= 0) {
      // Already expired
      setEntitlementState(FREE_ENTITLEMENT);
      saveEntitlement(FREE_ENTITLEMENT);
      return;
    }
    // Set a timer to auto-revoke when it expires (cap at 60s for polling)
    const timeout = setTimeout(() => {
      setEntitlementState(FREE_ENTITLEMENT);
      saveEntitlement(FREE_ENTITLEMENT);
    }, Math.min(remaining, 60_000));
    return () => clearTimeout(timeout);
  }, [entitlement.expiresAt]);

  const setEntitlement = useCallback((ent: Entitlement) => {
    setEntitlementState(ent);
    saveEntitlement(ent);
  }, []);

  // Backward-compatible setPlan
  const setPlan = useCallback((tier: PlanTier) => {
    if (tier === "pro") {
      setEntitlement({ isPro: true, source: "dev_toggle", expiresAt: null });
    } else {
      setEntitlement(FREE_ENTITLEMENT);
    }
  }, [setEntitlement]);

  const isPro = isEntitlementActive(entitlement);
  const plan: PlanTier = isPro ? "pro" : "free";
  const features = isPro ? PRO_FEATURES : FREE_FEATURES;

  const canUse = useCallback(
    (feature: keyof PlanFeatures) => features[feature],
    [features]
  );

  return (
    <SubscriptionContext.Provider
      value={{ entitlement, setEntitlement, plan, features, isPro, canUse, setPlan }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function usePlan(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("usePlan must be used within SubscriptionProvider");
  return ctx;
}

// Re-export types for convenience
export type { Entitlement, EntitlementSource };

// ---- Feature Access Hook (3-tier gating) ----

export type FeatureGateReason = "allowed" | "needs_cloud" | "needs_pro";

export interface FeatureAccess {
  /** Whether the feature is fully unlocked */
  allowed: boolean;
  /** Why the feature is locked */
  reason: FeatureGateReason;
  /** Whether cloud sync is active */
  isCloud: boolean;
  /** Whether user has Pro plan */
  isPro: boolean;
  /** Human-readable message for the lock reason */
  message: string;
}

/**
 * Single hook for 3-tier feature gating:
 *   1. syncMode !== "cloud" → "needs_cloud" → "Enable Cloud Sync"
 *   2. syncMode === "cloud" && !isPro → "needs_pro" → "Upgrade to Pro"
 *   3. syncMode === "cloud" && isPro → "allowed"
 */
export function useFeatureAccess(feature?: keyof PlanFeatures): FeatureAccess {
  const { isPro, canUse } = usePlan();
  const { syncMode } = useCloudStatus();

  return useMemo(() => {
    const isCloud = syncMode === "cloud";

    // Gate 1: Must be in cloud mode
    if (!isCloud) {
      return {
        allowed: false,
        reason: "needs_cloud" as const,
        isCloud: false,
        isPro,
        message: "Enable Cloud Sync to unlock AI features",
      };
    }

    // Gate 2: Must be Pro
    if (!isPro || (feature && !canUse(feature))) {
      return {
        allowed: false,
        reason: "needs_pro" as const,
        isCloud: true,
        isPro: false,
        message: "Upgrade to Pro to unlock this feature",
      };
    }

    // Gate 3: Fully unlocked
    return {
      allowed: true,
      reason: "allowed" as const,
      isCloud: true,
      isPro: true,
      message: "",
    };
  }, [syncMode, isPro, feature, canUse]);
}

// ---- Upgrade Gate Component ----

interface UpgradeGateProps {
  feature: keyof PlanFeatures;
  children: ReactNode;
  fallback?: ReactNode;
  inline?: boolean;
  featureLabel?: string;
}

export function UpgradeGate({ feature, children, fallback, inline = false, featureLabel }: UpgradeGateProps) {
  const access = useFeatureAccess(feature);

  if (access.allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (access.reason === "needs_cloud") {
    if (inline) {
      return <InlineCloudPrompt />;
    }
    return <CloudSyncPrompt featureLabel={featureLabel} />;
  }

  if (inline) {
    return <InlineUpgradePrompt featureLabel={featureLabel} />;
  }

  return <UpgradePrompt featureLabel={featureLabel} />;
}

// ---- Cloud Sync Prompt (Card) ----

function CloudSyncPrompt({ featureLabel }: { featureLabel?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-200/60 dark:border-blue-800/40 bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-800/80 dark:via-gray-800/60 dark:to-blue-900/20 p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
          <span className="text-white text-xl">☁️</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">
            {featureLabel ? `${featureLabel} requires Cloud Sync` : "Enable Cloud Sync"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
            AI features require Cloud Sync to be enabled. Sign in and enable cloud sync to unlock AI-powered planning, insights, and more.
          </p>
        </div>
      </div>
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-blue-400/10 dark:bg-blue-400/5 blur-xl" />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-cyan-400/10 dark:bg-cyan-400/5 blur-xl" />
    </div>
  );
}

// ---- Inline Cloud Prompt (Small) ----

function InlineCloudPrompt() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40">
      <span className="text-sm">☁️</span>
      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
        Enable Cloud Sync to unlock AI features
      </span>
    </div>
  );
}

// ---- Upgrade Prompt (Card) ----

function UpgradePrompt({ featureLabel }: { featureLabel?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-800/80 dark:via-gray-800/60 dark:to-indigo-900/20 p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 flex-shrink-0">
          <span className="text-white text-xl">✨</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">
            {featureLabel ? `Unlock ${featureLabel}` : "Unlock AI Features"}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
            Upgrade to Pro to get AI-powered planning, smart prioritisation, predictive insights, and automated recommendations.
          </p>
          <Link
            to="/billing"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/40 hover:scale-105 transition-all duration-200"
          >
            <span>⚡</span>
            <span>Upgrade to Pro</span>
          </Link>
        </div>
      </div>
      {/* Decorative */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-indigo-400/10 dark:bg-indigo-400/5 blur-xl" />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-purple-400/10 dark:bg-purple-400/5 blur-xl" />
    </div>
  );
}

// ---- Inline Upgrade Prompt (Small) ----

function InlineUpgradePrompt({ featureLabel }: { featureLabel?: string }) {
  return (
    <Link
      to="/billing"
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition-all duration-200 group"
    >
      <span className="text-sm">✨</span>
      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
        {featureLabel ? `Upgrade to unlock ${featureLabel}` : "Upgrade to Pro for AI features"}
      </span>
      <span className="ml-auto text-indigo-400 dark:text-indigo-500 text-xs group-hover:translate-x-0.5 transition-transform">→</span>
    </Link>
  );
}

// ---- Locked Feature Overlay ----

interface LockedFeatureProps {
  reason: FeatureGateReason;
  featureLabel?: string;
  compact?: boolean;
}

/**
 * A reusable locked-state overlay/card for any AI feature section.
 * Shows the appropriate CTA based on whether user needs cloud or Pro.
 */
export function LockedFeature({ reason, featureLabel, compact = false }: LockedFeatureProps) {
  if (reason === "needs_cloud") {
    if (compact) return <InlineCloudPrompt />;
    return <CloudSyncPrompt featureLabel={featureLabel} />;
  }
  if (reason === "needs_pro") {
    if (compact) return <InlineUpgradePrompt featureLabel={featureLabel} />;
    return <UpgradePrompt featureLabel={featureLabel} />;
  }
  return null;
}

// ---- Pro Badge ----

export function ProBadge({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white uppercase tracking-wider ${
        small ? "px-1.5 py-0.5 text-[7px]" : "px-2 py-0.5 text-[9px]"
      }`}
    >
      ⚡ PRO
    </span>
  );
}
