"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, X } from "lucide-react"
import { ZealousAPI, type ProtocolStats } from "@/lib/zealous-api"

interface TooltipData {
  x: number
  y: number
  volume: number
  visible: boolean
}

export default function ZealousVolumeChart() {
  const [totalVolume, setTotalVolume] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipData>({
    x: 0,
    y: 0,
    volume: 0,
    visible: false,
  })

  const zealousAPI = new ZealousAPI()

  const formatCurrency = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`
    }
    return `$${value.toFixed(2)}`
  }

  useEffect(() => {
    const fetchVolumeData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Use the same method as the main page to get protocol stats
        const protocolStats: ProtocolStats = await zealousAPI.getProtocolStats()

        if (!protocolStats) {
          setError("No protocol data available")
          return
        }

        // Just use the totalVolumeUSD directly
        setTotalVolume(protocolStats.totalVolumeUSD || 0)
      } catch (err) {
        console.error("Failed to fetch volume data:", err)
        setError("Failed to load volume data")
      } finally {
        setLoading(false)
      }
    }

    fetchVolumeData()
  }, [])

  const closeTooltip = () => {
    setTooltip((prev) => ({ ...prev, visible: false }))
  }

  // Enhanced volume chart component with proper axes
  const VolumeChart = ({ volume }: { volume: number }) => {
    if (volume === 0) return null

    const chartHeight = 280
    const chartWidth = 700
    const marginLeft = 80
    const marginBottom = 40
    const marginTop = 20
    const marginRight = 20

    const plotWidth = chartWidth - marginLeft - marginRight
    const plotHeight = chartHeight - marginTop - marginBottom

    const barWidth = 120
    const barX = marginLeft + (plotWidth - barWidth) / 2

    // Y-axis values
    const yAxisValues = [volume, volume * 0.8, volume * 0.6, volume * 0.4, volume * 0.2, 0]

    const handleBarClick = (event: React.MouseEvent) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      setTooltip({
        x,
        y,
        volume: volume,
        visible: true,
      })

      // Auto-close tooltip on mobile after 2 seconds
      if (window.innerWidth < 768) {
        setTimeout(() => {
          setTooltip((prev) => ({ ...prev, visible: false }))
        }, 2000)
      }
    }

    const handleBarTouch = (event: React.TouchEvent) => {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      const touch = event.touches[0]
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top

      setTooltip({
        x,
        y,
        volume: volume,
        visible: true,
      })

      // Auto-close tooltip on mobile after 2 seconds
      setTimeout(() => {
        setTooltip((prev) => ({ ...prev, visible: false }))
      }, 2000)
    }

    return (
      <div className="w-full relative" style={{ height: `${chartHeight + 60}px` }}>
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="volumeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="33%" stopColor="#EC4899" />
              <stop offset="66%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#1E1B4B" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Chart background */}
          <rect
            x={marginLeft}
            y={marginTop}
            width={plotWidth}
            height={plotHeight}
            fill="rgba(0,0,0,0.2)"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />

          {/* Horizontal grid lines */}
          {yAxisValues.slice(0, -1).map((value, index) => {
            const y = marginTop + (index / (yAxisValues.length - 1)) * plotHeight
            return (
              <line
                key={index}
                x1={marginLeft}
                y1={y}
                x2={marginLeft + plotWidth}
                y2={y}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="2,2"
              />
            )
          })}

          {/* Y-axis line */}
          <line
            x1={marginLeft}
            y1={marginTop}
            x2={marginLeft}
            y2={marginTop + plotHeight}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="2"
          />

          {/* X-axis line */}
          <line
            x1={marginLeft}
            y1={marginTop + plotHeight}
            x2={marginLeft + plotWidth}
            y2={marginTop + plotHeight}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="2"
          />

          {/* Volume bar with glow effect */}
          <rect
            x={barX}
            y={marginTop}
            width={barWidth}
            height={plotHeight}
            fill="url(#volumeGradient)"
            filter="url(#glow)"
            className="hover:opacity-80 transition-opacity cursor-pointer"
            onClick={handleBarClick}
            onTouchStart={handleBarTouch}
            style={{ touchAction: "manipulation" }}
            rx="4"
          />

          {/* Y-axis labels */}
          {yAxisValues.map((value, index) => {
            const y = marginTop + (index / (yAxisValues.length - 1)) * plotHeight
            return (
              <text
                key={index}
                x={marginLeft - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-white text-xs font-rajdhani"
                style={{ fontSize: "12px" }}
              >
                {formatCurrency(value)}
              </text>
            )
          })}

          {/* X-axis label */}
          <text
            x={marginLeft + plotWidth / 2}
            y={marginTop + plotHeight + 30}
            textAnchor="middle"
            className="fill-white/70 text-sm font-rajdhani"
            style={{ fontSize: "14px" }}
          >
            Total Trading Volume
          </text>

          {/* Y-axis title */}
          <text
            x={20}
            y={marginTop + plotHeight / 2}
            textAnchor="middle"
            className="fill-white/70 text-sm font-rajdhani"
            style={{ fontSize: "14px" }}
            transform={`rotate(-90, 20, ${marginTop + plotHeight / 2})`}
          >
            Volume (USD)
          </text>
        </svg>

        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-50 bg-black/95 border border-white/30 rounded-lg p-4 text-white text-sm font-inter backdrop-blur-xl shadow-2xl"
            style={{
              left: Math.min(tooltip.x + 10, chartWidth - 200),
              top: Math.max(tooltip.y - 80, 10),
              transform: tooltip.x > chartWidth / 2 ? "translateX(-100%)" : "none",
            }}
          >
            <button
              onClick={closeTooltip}
              className="absolute top-2 right-2 text-white/50 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-2">
              <div className="font-orbitron text-purple-400 text-base font-bold">{formatCurrency(tooltip.volume)}</div>
              <div className="font-rajdhani text-white/80 text-sm">Total Trading Volume</div>
              <div className="font-rajdhani text-white/60 text-xs">All-time cumulative volume</div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mr-3"></div>
            <span className="text-white/70 font-inter">Loading volume chart...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white font-orbitron flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            Trading Volume
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-400 font-inter py-8">{error}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-white font-orbitron flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            Trading Volume
          </CardTitle>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="text-purple-400 font-orbitron text-lg font-bold">{formatCurrency(totalVolume)}</div>
            <div className="text-white/60 font-rajdhani text-sm">Total Volume</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <VolumeChart volume={totalVolume} />
      </CardContent>
    </Card>
  )
}
