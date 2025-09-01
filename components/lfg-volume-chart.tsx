"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { LFGAPI, type LFGStats } from "@/lib/lfg-api"

interface VolumeData {
  time: string
  volume: number
  timestamp: number
}

export default function LFGVolumeChart() {
  const [volumeData, setVolumeData] = useState<VolumeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<LFGStats | null>(null)

  const lfgAPI = new LFGAPI()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch current stats
        const currentStats = await lfgAPI.getStats()
        setStats(currentStats)

        // Generate mock volume data for the chart since we don't have historical volume endpoint
        // In a real implementation, you'd fetch this from a historical volume API
        const mockData: VolumeData[] = []
        const now = new Date()
        const volume24h = currentStats.data.tradeVolumes.combined["1d"]

        // Generate 24 hours of mock data
        for (let i = 23; i >= 0; i--) {
          const time = new Date(now.getTime() - i * 60 * 60 * 1000)
          const randomVariation = 0.7 + Math.random() * 0.6 // 70% to 130% of average
          const hourlyVolume = (volume24h / 24) * randomVariation

          mockData.push({
            time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
            volume: hourlyVolume,
            timestamp: time.getTime(),
          })
        }

        setVolumeData(mockData)
      } catch (err) {
        console.error("Failed to fetch LFG volume data:", err)
        setError("Failed to load volume data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatCurrency = (value: number) => {
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`
    }
    return `$${value.toFixed(2)}`
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/80 border border-white/20 rounded-lg p-3 backdrop-blur-xl">
          <p className="text-white/70 text-sm font-rajdhani">{`Time: ${label}`}</p>
          <p className="text-green-400 font-semibold font-orbitron">{`Volume: ${formatCurrency(payload[0].value)}`}</p>
        </div>
      )
    }
    return null
  }

  if (error) {
    return (
      <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
        <CardContent className="p-8 text-center">
          <p className="text-red-400 font-rajdhani">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white font-orbitron">Platform Volume (24h)</CardTitle>
          <div className="flex gap-2">
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
              24h: {stats ? formatCurrency(stats.data.tradeVolumes.combined["1d"]) : "$0"}
            </Badge>
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              7d: {stats ? formatCurrency(stats.data.tradeVolumes.combined["7d"]) : "$0"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-white/70 font-rajdhani">Loading volume data...</div>
          </div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" fontSize={12} fontFamily="Rajdhani" />
                <YAxis
                  stroke="rgba(255,255,255,0.5)"
                  fontSize={12}
                  fontFamily="Rajdhani"
                  tickFormatter={formatCurrency}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
