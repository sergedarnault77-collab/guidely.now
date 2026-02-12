/**
 * Dev-only deep link simulation for web preview testing.
 * Dispatches a custom event that mobile-app.ts listens for in DEV mode.
 */
export function simulateDeepLink(path: string) {
  window.dispatchEvent(new CustomEvent('dev:deeplink', { detail: path }));
}
