import { Link } from "@tanstack/react-router";
import { usePlan } from "@/lib/subscription";

export function FreePlanBanner() {
  const { isPro } = usePlan();
  if (isPro) return null;

  return (
    <div className="border-b border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <span>
          <strong className="text-white">Free version</strong>
          {" · "}Upgrade to Pro to unlock the full AI Executive Assistant
        </span>
        <Link
          to="/billing"
          className="whitespace-nowrap text-emerald-400 hover:underline"
        >
          Upgrade →
        </Link>
      </div>
    </div>
  );
}
