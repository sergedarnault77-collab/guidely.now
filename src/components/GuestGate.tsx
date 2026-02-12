import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCloudStatus } from "@/lib/cloud-status";

interface GuestGateModalProps {
  show: boolean;
  onClose: () => void;
}

export function GuestGateModal({ show, onClose }: GuestGateModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          ✕
        </button>

        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/25">
            <span className="text-3xl">✦</span>
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Create a free account to get started
          </h2>

          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            Sign up to start tracking your habits, planning your week, and building momentum. It only takes a moment.
          </p>

          <div className="pt-2 space-y-3">
            <Link
              to="/signup"
              className="block w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-center"
            >
              Get Started Free
            </Link>

            <Link
              to="/signin"
              className="block w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 text-center"
            >
              Already have an account? Sign in
            </Link>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 pt-2">
            Free forever for manual tracking. AI features available with Pro.
          </p>
        </div>
      </div>
    </div>
  );
}

export function useGuestGate(isAuthenticated: boolean) {
  const [showModal, setShowModal] = useState(false);
  const { syncMode } = useCloudStatus();

  const guard = (callback?: () => void) => {
    // In local mode, never gate — let the user through
    if (syncMode === "local") {
      callback?.();
      return;
    }
    // In cloud mode, require authentication
    if (!isAuthenticated) {
      setShowModal(true);
      return;
    }
    callback?.();
  };

  return {
    showModal,
    closeModal: () => setShowModal(false),
    guard,
  };
}
