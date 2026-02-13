import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from '@tanstack/react-router'
import { useCinematic } from './CinematicProvider'
import type { ReactNode } from 'react'

const variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

const transition = { duration: 0.26, ease: [0.25, 0.1, 0.25, 1] as const }

/**
 * Wraps page content with a subtle fade+slide transition.
 * When cinematic mode is off, renders children directly (zero overhead).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { cinematic } = useCinematic()
  const location = useLocation()

  if (!cinematic) return <>{children}</>

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
