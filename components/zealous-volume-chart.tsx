"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart3, X } from "lucide-react"
import { ZealousAPI } from "@/lib/zealous-api"

interface VolumeData {
  date: string
  volume: number
  tvl: number
}

interface TooltipData {
  x: number
  y: number
  volume: number
  date: string
  visible: boolean
}

export default function ZealousVolumeChart() {
  const [volumeData, setVolumeData] = useState<VolumeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D">("7D")
  const [tooltip, setTooltip] = useState<TooltipData>({
    x: 0,
    y: 0,
    volume: 0,
    date: "",
    visible: false,
  })
  const chartRef = useRef<HTMLDivElement>(null)

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  useEffect(() => {
    const fetchVolumeData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch real daily volume data from API
        const dailyVolumeData = await zealousAPI.getDailyVolume()

        if (!dailyVolumeData || dailyVolumeData.length === 0) {
          setError("No volume data available")
          return
        }

        // Filter data based on time range
        const now = new Date()
        let filteredData = dailyVolumeData

        if (timeRange !== "90D") {
          const days = timeRange === "7D" ? 7 : 30
          const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

          filteredData = dailyVolumeData.filter((item) => {
            const itemDate = new Date(item.date)
            return itemDate >= cutoffDate
          })
        }

        // Sort by date to ensure chronological order
        filteredData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        // Transform to the format expected by the chart
        const chartData: VolumeData[] = filteredData.map((item) => ({
          date: item.date,
          volume: item.volumeUSD || 0,
          tvl: 2000000 + Math.random() * 1000000, // Mock TVL for now since it's not in the API
        }))

        setVolumeData(chartData)
      } catch (err) {
        console.error("Failed to fetch volume data:", err)
        setError("Failed to load volume data")
      } finally {
        setLoading(false)
      }
    }

    fetchVolumeData()
  }, [timeRange])

  const handleBarHover = (event: React.MouseEvent, point: VolumeData, barX: number) => {
    const rect = chartRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    setTooltip({
      x,
      y,
      volume: point.volume,
      date: point.date,
      visible: true,
    })
  }

  const closeTooltip = () => {
    setTooltip((prev) => ({ ...prev, visible: false }))
  }

  // Custom chart component
  const VolumeChart = ({ data }: { data: VolumeData[] }) => {
    if (data.length === 0) return null

    const maxVolume = Math.max(...data.map((d) => d.volume))
    const chartHeight = 200
    const chartWidth = 600

    return (
      <div className="w-full h-64 relative" ref={chartRef}>
        <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
          <defs>
            <linearGradient id="volumeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="50%" stopColor="#EC4899" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
            <linearGradient id="volumeAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
              <stop offset="33%" stopColor="#EC4899" stopOpacity="0.2" />
              <stop offset="66%" stopColor="#3B82F6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#1E1B4B" stopOpacity="0.1" />
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
          {data.map((point, index) => {
            const barWidth = (chartWidth / data.length) * 0.8
            const barHeight = maxVolume > 0 ? (point.volume / maxVolume) * chartHeight : 0
            const x = (index / data.length) * chartWidth + (chartWidth / data.length - barWidth) / 2
            const y = chartHeight - barHeight

            return (
              <rect
                key={index}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="url(#volumeAreaGradient)"
                stroke="url(#volumeGradient)"
                strokeWidth="1"
                className="hover:opacity-80 transition-opacity cursor-pointer"
                onMouseEnter={(e) => handleBarHover(e, point, x)}
                onMouseLeave={closeTooltip}
              />
            )
          })}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-white/50 font-rajdhani -ml-16">
          <span>{formatCurrency(maxVolume)}</span>
          <span>{formatCurrency(maxVolume * 0.75)}</span>
          <span>{formatCurrency(maxVolume * 0.5)}</span>
          <span>{formatCurrency(maxVolume * 0.25)}</span>
          <span>$0</span>
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-white/50 font-rajdhani mt-2">
          {data.length > 0 && (
            <>
              <span>{new Date(data[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              {data.length > 2 && (
                <span>
                  {new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
              <span>
                {new Date(data[data.length - 1].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </>
          )}
        </div>

        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-50 bg-black/90 border border-white/20 rounded-lg p-3 text-white text-sm font-inter backdrop-blur-xl max-w-xs"
            style={{
              left: tooltip.x + 10,
              top: tooltip.y - 10,
              transform: tooltip.x > chartWidth / 2 ? "translateX(-100%)" : "none",
            }}
          >
            <button onClick={closeTooltip} className="absolute top-1 right-1 text-white/50 hover:text-white">
              <X className="h-3 w-3" />
            </button>
            <div className="space-y-1">
              <div className="font-orbitron text-purple-400">Volume: {formatCurrency(tooltip.volume)}</div>
              <div className="font-rajdhani text-white/70">{formatDate(tooltip.date)}</div>
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
            Volume Chart
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="text-white font-orbitron flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            Trading Volume
          </CardTitle>
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as typeof timeRange)}>
            <SelectTrigger className="w-32 bg-black/40 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-white/20 text-white">
              <SelectItem value="7D">7 Days</SelectItem>
              <SelectItem value="30D">30 Days</SelectItem>
              <SelectItem value="90D">90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="pl-16 pr-4">
          <VolumeChart data={volumeData} />
        </div>
      </CardContent>
    </Card>
  )
}
