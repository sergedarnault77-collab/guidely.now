import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { usePlan, LockedFeature } from '@/lib/subscription'
// import { restorePurchases } from '@/lib/mobile-app'
import { simulateDeepLink } from '@/lib/deep-link-test'
import { toast } from 'sonner'

export const Route = createFileRoute('/billing')({
  component: BillingPage,
})

function BillingPage() {
  const { isPro, setEntitlement } = usePlan()
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false)

  const handleTogglePro = () => {
    setEntitlement(isPro ? { isPro: false, source: 'dev_toggle', expiresAt: null } : { isPro: true, source: 'dev_toggle', expiresAt: null })
    toast.success(isPro ? 'Downgraded to Free' : 'Upgraded to Pro')
  }

  const handleRestorePurchases = async () => {
    setIsRestoringPurchases(true)
    try {
      toast.info('Restore purchases not available in web mode')
    } finally {
      setIsRestoringPurchases(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Choose the plan that works for you
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Free Plan */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Free</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Perfect for getting started</p>
            </div>

            <div className="mb-8">
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                $0
                <span className="text-lg text-gray-600 dark:text-gray-400 font-normal">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Habit tracking</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Weekly planning</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Basic analytics</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-gray-400 dark:text-gray-600 mt-1">✗</span>
                <span className="text-gray-500 dark:text-gray-500">AI insights</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-gray-400 dark:text-gray-600 mt-1">✗</span>
                <span className="text-gray-500 dark:text-gray-500">Smart routines</span>
              </li>
            </ul>

            <button
              disabled
              className="w-full px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-semibold opacity-50 cursor-not-allowed min-h-[44px]"
            >
              Current Plan
            </button>
          </div>

          {/* Pro Plan */}
          <div className="rounded-2xl border-2 border-indigo-600 dark:border-indigo-500 bg-white dark:bg-gray-900 p-8 shadow-lg hover:shadow-xl transition-shadow relative">
            <div className="absolute -top-4 left-6 bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
              Most Popular
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Pro</h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">For serious planners</p>
            </div>

            <div className="mb-8">
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                $9.99
                <span className="text-lg text-gray-600 dark:text-gray-400 font-normal">/month</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">or $99/year (save 17%)</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Everything in Free</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span className="text-gray-700 dark:text-gray-300">AI-powered insights</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Smart routine builder</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Advanced analytics</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                <span className="text-gray-700 dark:text-gray-300">Priority support</span>
              </li>
            </ul>

            <button
              onClick={handleTogglePro}
              className="w-full px-6 py-3 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-md hover:shadow-lg min-h-[44px]"
            >
              {isPro ? 'Downgrade' : 'Upgrade to Pro'}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 max-w-md mx-auto">
          {/* Restore Purchases Button */}
          <button
            onClick={handleRestorePurchases}
            disabled={isRestoringPurchases}
            className="w-full px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isRestoringPurchases ? 'Restoring...' : 'Restore Purchases'}
          </button>

          {/* Dev: Deep Link Test Button */}
          {import.meta.env.DEV && (
            <button
              onClick={() => simulateDeepLink('/tracker')}
              className="w-full px-6 py-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors font-medium min-h-[44px] text-sm"
            >
              Dev: Deep link to /tracker
            </button>
          )}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Frequently Asked Questions
          </h3>

          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Can I cancel anytime?</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Yes, you can cancel your subscription at any time. No questions asked.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Is there a free trial?</h4>
              <p className="text-gray-600 dark:text-gray-400">
                The Free plan gives you full access to core features. Upgrade to Pro anytime.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">What payment methods do you accept?</h4>
              <p className="text-gray-600 dark:text-gray-400">
                We accept all major credit cards, Apple Pay, and Google Pay.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Do you offer refunds?</h4>
              <p className="text-gray-600 dark:text-gray-400">
                We offer a 30-day money-back guarantee if you're not satisfied.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
