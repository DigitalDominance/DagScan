"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

interface CosmicBackgroundProps {
  className?: string
  children?: React.ReactNode
  intensity?: "subtle" | "medium" | "strong"
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  hue: number
  pulse: number
  pulseSpeed: number
  trail: { x: number; y: number; opacity: number }[]
}

function createParticle(width: number, height: number): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 2, // Increased from 0.5 to 2
    vy: (Math.random() - 0.5) * 2, // Increased from 0.5 to 2
    size: 1 + Math.random() * 3,
    opacity: 0.3 + Math.random() * 0.7,
    hue: 220 + Math.random() * 100, // Blue to purple range
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.04, // Increased from 0.01-0.02 to 0.02-0.04
    trail: [],
  }
}

export default function CosmicBackground({ className, children, intensity = "strong" }: CosmicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationFrameRef = useRef<number>(0)
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const opacityMap = {
    subtle: 0.6,
    medium: 0.8,
    strong: 1,
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)

      // Create particles
      const particleCount = Math.min(200, Math.floor((canvas.width * canvas.height) / 12000)) // Increased particle count
      particlesRef.current = Array.from({ length: particleCount }, () =>
        createParticle(canvas.width / dpr, canvas.height / dpr),
      )
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    updateCanvasSize()
    window.addEventListener("resize", updateCanvasSize)
    window.addEventListener("mousemove", handleMouseMove)

    function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
      // Update trail
      particle.trail.unshift({ x: particle.x, y: particle.y, opacity: particle.opacity })
      if (particle.trail.length > 12) {
        // Increased trail length from 8 to 12
        particle.trail.pop()
      }

      // Draw trail
      particle.trail.forEach((point, index) => {
        const trailOpacity = point.opacity * (1 - index / particle.trail.length) * opacityMap[intensity]
        const trailSize = particle.size * (1 - (index / particle.trail.length) * 0.5)
        ctx.save()
        ctx.globalAlpha = trailOpacity * 0.6
        ctx.beginPath()
        ctx.arc(point.x, point.y, trailSize, 0, Math.PI * 2)
        ctx.fillStyle = `hsl(${particle.hue}, 70%, 60%)`
        ctx.fill()
        ctx.restore()
      })

      // Draw main particle with pulsing effect
      const pulsingOpacity = particle.opacity * (0.7 + Math.sin(particle.pulse) * 0.3) * opacityMap[intensity]
      const pulsingSize = particle.size * (0.8 + Math.sin(particle.pulse) * 0.2)

      ctx.save()
      ctx.globalAlpha = pulsingOpacity

      // Create radial gradient for glow effect
      const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, pulsingSize * 3)
      gradient.addColorStop(0, `hsl(${particle.hue}, 80%, 70%)`)
      gradient.addColorStop(0.3, `hsl(${particle.hue}, 70%, 50%)`)
      gradient.addColorStop(1, `hsla(${particle.hue}, 60%, 30%, 0)`)

      ctx.beginPath()
      ctx.arc(particle.x, particle.y, pulsingSize * 3, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Draw core particle
      ctx.globalAlpha = pulsingOpacity * 1.5
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, pulsingSize, 0, Math.PI * 2)
      ctx.fillStyle = `hsl(${particle.hue}, 90%, 80%)`
      ctx.fill()

      ctx.restore()
    }

    function drawConnections(ctx: CanvasRenderingContext2D, particles: Particle[]) {
      particles.forEach((particle, i) => {
        particles.slice(i + 1).forEach((otherParticle) => {
          const dx = particle.x - otherParticle.x
          const dy = particle.y - otherParticle.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 150) {
            // Increased connection distance from 120 to 150
            const opacity = (1 - distance / 150) * 0.2 * opacityMap[intensity] // Increased opacity
            ctx.save()
            ctx.globalAlpha = opacity
            ctx.strokeStyle = `hsl(${(particle.hue + otherParticle.hue) / 2}, 60%, 60%)`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(otherParticle.x, otherParticle.y)
            ctx.stroke()
            ctx.restore()
          }
        })
      })
    }

    function animate() {
      if (!canvas || !ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const particles = particlesRef.current
      const mouse = mouseRef.current

      particles.forEach((particle) => {
        // Mouse interaction - stronger effect
        const dx = mouse.x - particle.x
        const dy = mouse.y - particle.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < 200) {
          // Increased interaction distance from 150 to 200
          const force = ((200 - distance) / 200) * 0.05 // Increased force from 0.02 to 0.05
          particle.vx += dx * force * 0.002 // Increased from 0.001 to 0.002
          particle.vy += dy * force * 0.002
        }

        // Add some random movement for more dynamic motion
        particle.vx += (Math.random() - 0.5) * 0.02
        particle.vy += (Math.random() - 0.5) * 0.02

        // Update position
        particle.x += particle.vx
        particle.y += particle.vy
        particle.pulse += particle.pulseSpeed

        // Boundary wrapping
        if (particle.x < 0) particle.x = canvas.width / (window.devicePixelRatio || 1)
        if (particle.x > canvas.width / (window.devicePixelRatio || 1)) particle.x = 0
        if (particle.y < 0) particle.y = canvas.height / (window.devicePixelRatio || 1)
        if (particle.y > canvas.height / (window.devicePixelRatio || 1)) particle.y = 0

        // Add some drift back to center with less damping for more movement
        particle.vx *= 0.995 // Reduced damping from 0.99 to 0.995
        particle.vy *= 0.995

        drawParticle(ctx, particle)
      })

      // Draw connections between nearby particles
      drawConnections(ctx, particles)

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", updateCanvasSize)
      window.removeEventListener("mousemove", handleMouseMove)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [intensity])

  return (
    <div className={cn("relative min-h-screen w-full overflow-hidden bg-neutral-950", className)}>
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Cosmic overlay gradients */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-purple-950/30 via-blue-950/20 to-pink-950/30"
        animate={{
          opacity: [0.1, 0.3, 0.1],
        }}
        transition={{
          duration: 8,
          ease: "easeInOut",
          repeat: Number.POSITIVE_INFINITY,
        }}
      />

      <motion.div
        className="absolute inset-0 bg-gradient-to-tr from-cyan-950/20 via-transparent to-violet-950/20"
        animate={{
          opacity: [0.05, 0.2, 0.05],
        }}
        transition={{
          duration: 12,
          ease: "easeInOut",
          repeat: Number.POSITIVE_INFINITY,
          delay: 2,
        }}
      />

      <div className="relative z-10 w-full">{children}</div>
    </div>
  )
}
