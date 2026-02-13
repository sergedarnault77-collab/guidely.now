import { useCinematic } from './CinematicProvider'

/**
 * Full-screen film-grain texture overlay.
 * Only renders when cinematic mode is active.
 * Uses an inline SVG noise filter — zero external assets.
 */
export function GrainOverlay() {
  const { cinematic } = useCinematic()
  if (!cinematic) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{
        opacity: 0.04,
        mixBlendMode: 'overlay',
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '128px 128px',
      }}
    />
  )
}
