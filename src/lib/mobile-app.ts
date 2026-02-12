/**
 * Mobile app utilities for iOS/Android builds via Capacitor.
 * Handles deep linking, app lifecycle, and purchase restoration.
 */

import { App } from '@capacitor/app'
import { AppLauncher } from '@capacitor/app-launcher'
import { simulateDeepLink } from './deep-link-test'

/**
 * Initialize mobile app listeners (deep linking, app state).
 * Call this once in main.tsx or root component.
 * 
 * Handles:
 * - Cold start deep links (e.g., clicking a link from notification)
 * - App-already-running deep links (e.g., clicking a link while app is open)
 * - Android back button
 */
export async function initializeMobileApp(onDeepLink?: (url: string) => void) {
  try {
    // DEV-only: Listen for simulated deep links from web preview
    if (import.meta.env.DEV) {
      window.addEventListener('dev:deeplink', (e: any) => {
        console.log('[Dev] Simulated deep link:', e.detail)
        onDeepLink?.(e.detail)
      })
    }

    // Listen for app resume (cold start or background)
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        // App came to foreground
        console.log('[Mobile] App resumed')
      }
    })

    // Listen for deep links (both cold start and app-already-running)
    // This fires when:
    // 1. App is launched from a deep link (cold start)
    // 2. App is already running and receives a deep link (app-already-running)
    App.addListener('appUrlOpen', (event) => {
      console.log('[Mobile] appUrlOpen event:', event.url)
      const url = event.url
      
      let pathname = '/'
      
      try {
        // Try standard URL parsing first (handles https://guidely.app/billing?x=1)
        const u = new URL(url)
        pathname = u.pathname || '/'
      } catch {
        // Fallback for custom schemes (guidely://billing or guidely://app/billing)
        const afterScheme = url.split('://')[1]
        if (afterScheme) {
          // Remove leading host segment (e.g., "app" in guidely://app/billing)
          const parts = afterScheme.split('/')
          const pathParts = parts.slice(1) // Skip domain/app segment
          pathname = '/' + pathParts.join('/')
        }
      }
      
      // Normalize: collapse multiple slashes, strip trailing slash (except "/")
      pathname = pathname.replace(/\/+/g, '/') // Collapse multiple slashes
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1) // Strip trailing slash
      }
      
      console.log('[Mobile] Routing to:', pathname)
      onDeepLink?.(pathname)
    })

    // Handle back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp()
      }
    })
  } catch (error) {
    // Not running in Capacitor environment (web/dev)
    console.log('[Mobile] Not in Capacitor environment')
  }
}

/**
 * Restore purchases from App Store / Play Store.
 * Currently a no-op placeholder — will integrate with real IAP later.
 */
export async function restorePurchases(): Promise<boolean> {
  try {
    console.log('[Mobile] Restoring purchases...')
    // TODO: Integrate with App Store / Play Store receipt validation
    // For now, just return false (no purchases to restore)
    return false
  } catch (error) {
    console.error('[Mobile] Restore purchases failed:', error)
    return false
  }
}

/**
 * Open a URL in the system browser (e.g., for privacy policy, terms).
 */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    await AppLauncher.openUrl({ url })
  } catch (error) {
    console.error('[Mobile] Failed to open URL:', error)
    // Fallback to window.open on web
    window.open(url, '_blank')
  }
}

/**
 * Check if running in a native mobile app (iOS/Android).
 */
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).capacitor
}

/**
 * Get the current platform (ios, android, web).
 */
export async function getPlatform(): Promise<'ios' | 'android' | 'web'> {
  try {
    const info = await App.getInfo()
    const platform = (info as any).platform as string
    if (platform === 'ios' || platform === 'android') {
      return platform
    }
    return 'web'
  } catch {
    return 'web'
  }
}
