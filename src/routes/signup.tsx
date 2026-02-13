import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useSession, authClient, isCloudAuthConfigured } from "../lib/auth-client";

function SignUpPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      navigate({ to: "/" });
    }
  }, [session, navigate]);

  if (session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCloudAuthConfigured) return;
    setError("");
    setLoading(true);
    try {
      const result = await authClient.signUp.email({ email, password, name });
      if (result.error) {
        const msg = result.error.message || "Could not create account";
        const code = (result.error as { code?: string }).code;
        console.error("[signup] Auth error:", { message: msg, code, raw: result.error });
        setError(msg);
      } else {
        navigate({ to: "/" });
      }
    } catch (err) {
      console.error("[signup] Unexpected error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mx-auto mb-4">
            <span className="text-white text-2xl">✦</span>
          </div>
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Sync your assistant across all your devices</p>
        </div>

        {/* Cloud sync not configured banner */}
        {!isCloudAuthConfigured && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
              Cloud sync isn't enabled on this deployment.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
              You can still use 10minutes.ai without an account — data saves locally.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              Go to Dashboard →
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700/40 shadow-sm space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={!isCloudAuthConfigured}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!isCloudAuthConfigured}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={!isCloudAuthConfigured}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Min 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isCloudAuthConfigured}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{" "}
            <Link to="/signin" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          You can also use the app without an account — data saves locally.
        </p>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
          Create an account to unlock AI insights and sync across devices.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/signup")({
  component: SignUpPage,
});
