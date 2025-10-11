"use client"

import { motion, type Variants } from "framer-motion"

const transition = { duration: 0.4, ease: "easeOut" as const }
const fastTransition = { duration: 0.2, ease: "easeOut" as const }

export const MotionDiv = motion.div
export const MotionSection = motion.section
export const MotionArticle = motion.article
export const MotionButton = motion.button
export const MotionSpan = motion.span

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition },
}

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition },
}

export const fadeInDown: Variants = {
  initial: { opacity: 0, y: -24 },
  animate: { opacity: 1, y: 0, transition },
}

export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0, transition },
}

export const slideInRight: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition },
}

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition },
}

export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
}

export const staggerFast: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
}

// Loading animations
export const pulse = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
}

export const spin = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear" as const,
    },
  },
}

export const bounce = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
}

// Page transition variants
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: fastTransition },
  exit: { opacity: 0, y: -20, transition: fastTransition },
}

// Card hover animations
export const cardHover = {
  whileHover: {
    y: -4,
    transition: { duration: 0.2 },
  },
  whileTap: {
    scale: 0.98,
  },
}

// Button animations
export const buttonHover = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: fastTransition,
}
