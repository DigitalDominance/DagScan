"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, DollarSign, ExternalLink, Coins, TrendingUp, Layers } from "lucide-react"
import BeamsBackground from "@/components/beams-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import LFGTokensList from "@/components/lfg-tokens-list"
import LFGVolumeChart from "@/components/lfg-volume-chart"
import LFGStakingPools from "@/components/lfg-staking-pools"
import { LFGAPI, type LFGStats } from "@/lib/lfg-api"
import { useRouter } from "next/navigation"
import { useNetwork } from "@/context/NetworkContext"

export default function LFGKaspaPage() {
  const { currentNetwork, handleNetworkChange } = useNetwork();
  const [lfgStats, setLfgStats] = useState<LFGStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const lfgAPI = new LFGAPI()

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const stats = await lfgAPI.getStats()
        setLfgStats(stats)
      } catch (err) {
        console.error("Failed to fetch LFG stats:", err)
        setError("Failed to load LFG statistics")
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const handleSearch = (query: string) => {
    router.push(`/search/${encodeURIComponent(query)}`)
  }

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "$0.00"
    }
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`
    }
    if (value >= 1) {
      return `$${value.toFixed(6)}`
    }
    if (value >= 0.001) {
      return `$${value.toFixed(8)}`
    }
    return `$${value.toFixed(12)}`
  }

  const formatNumber = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "0"
    }
    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(1)}M`
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(1)}K`
    }
    return value.toString()
  }

  return (
    <BeamsBackground>
      <div className="min-h-screen flex flex-col font-inter">
        <Navigation currentNetwork={currentNetwork} onNetworkChange={handleNetworkChange} onSearch={handleSearch} />
        <main className="flex-1 mx-auto max-w-7xl px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push("/dapps")}
              className="relative text-white hover:bg-black/60 active:bg-black/80 mb-4 overflow-hidden before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-br before:from-green-500 before:via-teal-500 before:to-blue-500 after:absolute after:inset-[1px] after:bg-black/40 after:backdrop-blur-xl after:rounded-[calc(0.375rem-1px)] hover:after:bg-black/60 active:after:bg-black/80"
            >
              <span className="relative z-10 flex items-center">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to DApps
              </span>
            </Button>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <img src="/lfg-logo.png" alt="LFG.kaspa" className="h-12 w-12 sm:h-16 sm:w-16 rounded-xl" />
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white font-orbitron">LFG.kaspa</h1>
                  <p className="text-white/70 font-rajdhani text-base sm:text-lg">Meme Token Launchpad & DEX</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">Active</Badge>
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">DEX</Badge>
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">Launchpad</Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  className="relative text-white font-rajdhani hover:bg-black/60 active:bg-black/80 overflow-hidden before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-br before:from-green-500 before:to-blue-500 after:absolute after:inset-[1px] after:bg-black/40 after:backdrop-blur-xl after:rounded-[calc(0.375rem-1px)] hover:after:bg-black/60 active:after:bg-black/80"
                  onClick={() => window.open("https://lfg.kaspa.com/", "_blank")}
                >
                  <span className="relative z-10 flex items-center">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Launch App
                  </span>
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Protocol Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8"
          >
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70 font-rajdhani">Platform Volume 24h</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-white font-orbitron">
                  {loading
                    ? "Loading..."
                    : error
                      ? "Error"
                      : formatCurrency(lfgStats?.data.tradeVolumes.combined["1d"] || 0)}
                </div>
                <p className="text-xs text-blue-300 mt-1 font-inter">24h trading volume</p>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70 font-rajdhani">Total TVL</CardTitle>
                <DollarSign className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-white font-orbitron">
                  {loading ? "Loading..." : error ? "Error" : formatCurrency(lfgStats?.data.tvl.total || 0)}
                </div>
                <p className="text-xs text-green-300 mt-1 font-inter">Total Value Locked</p>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/20 backdrop-blur-xl sm:col-span-2 lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70 font-rajdhani">Total Tokens</CardTitle>
                <Coins className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-white font-orbitron">
                  {loading
                    ? "Loading..."
                    : error
                      ? "Error"
                      : formatNumber((lfgStats?.data.dexTokensCount || 0) + (lfgStats?.data.launchpadTokensCount || 0))}
                </div>
                <p className="text-xs text-purple-300 mt-1 font-inter">
                  DEX: {lfgStats?.data.dexTokensCount || 0} | Launchpad: {lfgStats?.data.launchpadTokensCount || 0}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Volume Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <LFGVolumeChart />
          </motion.div>

          {/* Tokens List */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Tabs defaultValue="tokens" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-black/40 border-white/20">
                <TabsTrigger
                  value="tokens"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-blue-500 data-[state=active]:text-white text-white/70 font-rajdhani text-sm"
                >
                  <Coins className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">All Tokens</span>
                  <span className="sm:hidden">Tokens</span>
                </TabsTrigger>
                <TabsTrigger
                  value="staking"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white text-white/70 font-rajdhani text-sm"
                >
                  <Layers className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Staking Pools</span>
                  <span className="sm:hidden">Staking</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tokens">
                <LFGTokensList />
              </TabsContent>
              <TabsContent value="staking">
                <LFGStakingPools />
              </TabsContent>
            </Tabs>
          </motion.div>
        </main>
        <Footer />
      </div>
    </BeamsBackground>
  )
}
