"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart3, X } from "lucide-react"
import { ZealousAPI } from "@/lib/zealous-api"

interface VolumeData {
  timestamp: string
  volumeUSD: number
}

interface TooltipData {
  x: number
  y: number
  volume: number
  timestamp: string
  visible: boolean
}

export default function ZealousVolumeChart() {
  const [volumeData, setVolumeData] = useState<VolumeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<"24H" | "7D" | "30D">("24H")
  const [tooltip, setTooltip] = useState<TooltipData>({
    x: 0,
    y: 0,
    volume: 0,
    timestamp: "",
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

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  useEffect(() => {
    const fetchVolumeData = async () => {
      try {
        setLoading(true)
        setError(null)

        let hours: number
        switch (timeRange) {
          case "24H":
            hours = 24
            break
          case "7D":
            hours = 168 // 7 * 24
            break
          case "30D":
            hours = 720 // 30 * 24
            break
          default:
            hours = 24
        }

        const data = await zealousAPI.getVolumeHistory(hours)

        if (!data || data.length === 0) {
          setError("No volume data available")
          return
        }

        // Sort by timestamp and filter valid data
        const validData = data
          .filter((item) => item.volumeUSD && !isNaN(item.volumeUSD) && item.volumeUSD > 0)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

        if (validData.length === 0) {
          setError("No valid volume data available")
          return
        }

        setVolumeData(validData)
      } catch (err) {
        console.error("Failed to fetch volume data:", err)
        setError("Failed to load volume data")
      } finally {
        setLoading(false)
      }
    }

    fetchVolumeData()
  }, [timeRange])

  const closeTooltip = () => {
    setTooltip((prev) => ({ ...prev, visible: false }))
  }

  // Custom volume chart component
  const VolumeChart = ({ data }: { data: VolumeData[] }) => {
    if (data.length === 0) return null

    const maxVolume = Math.max(...data.map((d) => d.volumeUSD))
    const chartHeight = 300
    const chartWidth = 800
    const barWidth = Math.max(2, chartWidth / data.length - 2)

    const handleBarClick = (event: React.MouseEvent, volume: VolumeData, index: number) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      setTooltip({
        x,
        y,
        volume: volume.volumeUSD,
        timestamp: volume.timestamp,
        visible: true,
      })

      // Auto-close tooltip on mobile after 2 seconds
      if (window.innerWidth < 768) {
        setTimeout(() => {
          setTooltip((prev) => ({ ...prev, visible: false }))
        }, 2000)
      }
    }

    const handleBarTouch = (event: React.TouchEvent, volume: VolumeData, index: number) => {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      const touch = event.touches[0]
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top

      setTooltip({
        x,
        y,
        volume: volume.volumeUSD,
        timestamp: volume.timestamp,
        visible: true,
      })

      // Auto-close tooltip on mobile after 2 seconds
      setTimeout(() => {
        setTooltip((prev) => ({ ...prev, visible: false }))
      }, 2000)
    }

    return (
      <div className="w-full h-80 relative overflow-hidden">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="volumeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="33%" stopColor="#EC4899" />
              <stop offset="66%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#1E1B4B" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              y1={chartHeight * ratio}
              x2={chartWidth}
              y2={chartHeight * ratio}
              stroke="rgba(255,255,255,0.1)"
              strokeDasharray="2,2"
            />
          ))}

          {/* Volume bars */}
          {data.map((volume, index) => {
            const barHeight = (volume.volumeUSD / maxVolume) * chartHeight
            const x = (index / data.length) * chartWidth
            const y = chartHeight - barHeight

            return (
              <rect
                key={index}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="url(#volumeGradient)"
                className="hover:opacity-80 transition-opacity cursor-pointer"
                onClick={(e) => handleBarClick(e, volume, index)}
                onTouchStart={(e) => handleBarTouch(e, volume, index)}
                style={{ touchAction: "manipulation" }}
              />
            )
          })}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-white/50 font-rajdhani -ml-16 sm:-ml-20 pointer-events-none select-none">
          <span>{formatCurrency(maxVolume)}</span>
          <span>{formatCurrency(maxVolume * 0.75)}</span>
          <span>{formatCurrency(maxVolume * 0.5)}</span>
          <span>{formatCurrency(maxVolume * 0.25)}</span>
          <span>$0</span>
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-white/50 font-rajdhani mt-2 px-2 pointer-events-none select-none">
          {data.length > 0 && (
            <>
              <span className="truncate">
                {new Date(data[0].timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              {data.length > 2 && (
                <span className="truncate">
                  {new Date(data[Math.floor(data.length / 2)].timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
              <span className="truncate">
                {new Date(data[data.length - 1].timestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>

        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-50 bg-black/90 border border-white/20 rounded-lg p-3 text-white text-sm font-inter backdrop-blur-xl max-w-xs pointer-events-none select-none"
            style={{
              left: tooltip.x + 10,
              top: tooltip.y - 10,
              transform: tooltip.x > chartWidth / 2 ? "translateX(-100%)" : "none",
            }}
          >
            <button
              onClick={closeTooltip}
              className="absolute top-1 right-1 text-white/50 hover:text-white pointer-events-auto"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="space-y-1">
              <div className="font-orbitron text-purple-400">Volume: {formatCurrency(tooltip.volume)}</div>
              <div className="font-rajdhani text-white/70">{formatDate(tooltip.timestamp)}</div>
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

  const totalVolume = volumeData.reduce((sum, item) => sum + item.volumeUSD, 0)

  return (
    <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <CardTitle className="text-white font-orbitron flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-400" />
              Trading Volume
            </CardTitle>
            <div className="text-purple-400 font-orbitron">Total: {formatCurrency(totalVolume)}</div>
          </div>
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as typeof timeRange)}>
            <SelectTrigger className="w-20 bg-black/40 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-white/20 text-white">
              <SelectItem value="24H">24H</SelectItem>
              <SelectItem value="7D">7D</SelectItem>
              <SelectItem value="30D">30D</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="pl-16 sm:pl-20 pr-4">
          <VolumeChart data={volumeData} />
        </div>
      </CardContent>
    </Card>
  )
}
