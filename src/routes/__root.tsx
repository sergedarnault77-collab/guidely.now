import * as React from 'react'
import { Outlet, createRootRoute, Link, useLocation } from '@tanstack/react-router'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useCloudStatus } from '@/lib/cloud-status'
import { usePlan } from '@/lib/subscription'
import { useSession } from '@/lib/auth-client'
import { SyncStatusPill } from '@/components/SyncStatusPill'
import { FreePlanBanner } from '@/components/FreePlanBanner'
import { BottomNav } from '@/components/BottomNav'
import { GrainOverlay } from '@/components/cinematic/GrainOverlay'
import { PageTransition } from '@/components/cinematic/PageTransition'


export const Route = createRootRoute({
  component: () => <RootComponent />,
})

function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return document.documentElement.classList.contains('dark')
  })

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  return (
    <button
      onClick={() => setDark(!dark)}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="w-5 h-5 text-gray-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
    </button>
  )
}

function CloudSyncBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { syncMode, convexUrlPresent, convexReachable, checking } = useCloudStatus()

  // Banner is only relevant when user explicitly enabled cloud mode.
  if (syncMode !== "cloud") return null

  // Don't show while still checking, or if everything is fine
  if (checking || (convexUrlPresent && convexReachable) || dismissed) return null

  const message = !convexUrlPresent
    ? 'Cloud sync is not enabled — using local data.'
    : 'Cloud sync temporarily unavailable — using local data.'

  return (
    <div className="w-full bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-800/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0 text-amber-500">☁️</span>
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300 truncate">
            {message}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 p-1 rounded-md text-amber-400 dark:text-amber-500 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function RootComponent() {
  const location = useLocation()
  const { isPro } = usePlan()
  const { data: session } = useSession()
  const isAuthenticated = !!session
  const isAuthPage = location.pathname === '/signin' || location.pathname === '/signup'

  return (
    <React.Fragment>
        {/* Cloud Sync Banner */}
        <CloudSyncBanner />

        {/* Navigation */}
        <nav className="sticky top-0 z-40 border-b border-gray-200/60 dark:border-gray-800/40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity min-h-[44px]">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-900 dark:text-white">Guidely</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">AI Planning</span>
              </div>
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              {!isAuthPage && (
                <>
                  <Link
                    to="/"
                    className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:inline-block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] flex items-center"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/tracker"
                    search={{ month: undefined }}
                    className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:inline-block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] flex items-center"
                  >
                    Tracker
                  </Link>
                  <Link
                    to="/weekly"
                    className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:inline-block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] flex items-center"
                  >
                    Weekly
                  </Link>
                  <Link
                    to="/analytics"
                    className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:inline-block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] flex items-center"
                  >
                    Analytics
                  </Link>
                  <Link
                    to="/billing"
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 min-h-[44px]"
                  >
                    <span>⚡</span>
                    <span className="hidden sm:inline">Pro</span>
                  </Link>
                  {!isAuthenticated && (
                    <Link
                      to="/signin"
                      className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:inline-block px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] flex items-center"
                    >
                      Sign In
                    </Link>
                  )}
                </>
              )}
              <SyncStatusPill compact={true} />
              <ThemeToggle />
            </div>
          </div>
        </nav>

        {/* Free Plan Banner */}
        <FreePlanBanner />

        {/* Global cinematic grain */}
        <GrainOverlay />

        {/* Main Content */}
        <main className="min-h-screen pb-20">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>

        {/* Bottom Navigation */}
        <BottomNav isAuthenticated={isAuthenticated} />

        {/* Footer */}
        <footer className="border-t border-gray-200/60 dark:border-gray-800/40 bg-gray-50/50 dark:bg-gray-950/50" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)', paddingBottom: 'max(3rem, calc(3rem + env(safe-area-inset-bottom)))' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-8">
            <div className="grid md:grid-cols-4 gap-8">
              <div className="space-y-3">
                <h3 className="font-bold text-gray-900 dark:text-white">Guidely</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your AI-powered executive planning assistant ✦
                </p>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Product</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                  <Link to="/tracker" search={{ month: undefined }} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Tracker
                  </Link>
                  </li>
                  <li>
                    <Link to="/billing" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Pricing
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Legal</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Privacy
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Terms
                    </a>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Connect</h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Twitter
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Email
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-200/60 dark:border-gray-800/40 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-500 dark:text-gray-500">
                © 2024 Guidely. All rights reserved.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Built with care for focused execution
              </p>
            </div>
          </div>
        </footer>
      </React.Fragment>
  )
}
