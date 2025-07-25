"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"

interface AnimatedCounterProps {
  value: number
  duration?: number
  className?: string
  suffix?: string
  decimals?: number
}

export default function AnimatedCounter({
  value,
  duration = 1000,
  className = "",
  suffix = "",
  decimals = 0,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [prevValue, setPrevValue] = useState(value)

  useEffect(() => {
    if (value !== prevValue) {
      const startValue = prevValue
      const endValue = value
      const startTime = Date.now()

      const animate = () => {
        const now = Date.now()
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3)

        const currentValue = startValue + (endValue - startValue) * easeOutCubic
        setDisplayValue(currentValue)

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setDisplayValue(endValue)
          setPrevValue(endValue)
        }
      }

      requestAnimationFrame(animate)
    }
  }, [value, prevValue, duration])

  const formatValue = (val: number) => {
    if (decimals > 0) {
      return val.toFixed(decimals)
    }
    return Math.floor(val).toLocaleString()
  }

  return (
    <motion.span
      className={className}
      key={value} // This will trigger re-render when value changes
    >
      {formatValue(displayValue)}
      {suffix}
    </motion.span>
  )
}
