"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, DollarSign, ExternalLink, Droplets, Coins } from "lucide-react"
import BeamsBackground from "@/components/beams-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import ZealousVolumeChart from "@/components/zealous-volume-chart"
import ZealousPoolsTable from "@/components/zealous-pools-table"
import ZealousTokensList from "@/components/zealous-tokens-list"
import { ZealousAPI, type ProtocolStats } from "@/lib/zealous-api"
import { useRouter } from "next/navigation"
import { KasplexAPI } from "@/lib/kasplex-api"
import { isBridgedToken, getTickerFromAddress } from "@/lib/token-utils"

export default function ZealousSwapPage() {
  const [protocolStats, setProtocolStats] = useState<ProtocolStats | null>(null)
  const [tokenCount, setTokenCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const zealousAPI = new ZealousAPI()

  useEffect(() => {
    const fetchProtocolStats = async () => {
      try {
        setLoading(true)
        const stats = await zealousAPI.getProtocolStats()
        setProtocolStats(stats)

        // Get token count for the verified tokens card
        try {
          const tokens = await zealousAPI.getTokens(1, 0) // Just get first page to get total count
          // This is a simple way to get count - in real implementation you'd want a dedicated endpoint
          const allTokens = await zealousAPI.getTokens(1000, 0) // Get a large number to count
          setTokenCount(allTokens.length)

          // Calculate accurate total market cap
          let totalMarketCap = 0
          const batchSize = 5

          for (let i = 0; i < Math.min(allTokens.length, 50); i += batchSize) {
            const batch = allTokens.slice(i, i + batchSize)
            const batchMarketCaps = await Promise.all(
              batch.map(async (token) => {
                try {
                  // Fetch supply with KRC20 resolution
                  const kasplexAPI = new KasplexAPI("kasplex")
                  let supply = 0

                  // Check if this is a bridged token
                  if (isBridgedToken(token.address) || isBridgedToken(token.symbol)) {
                    const ticker = token.symbol || getTickerFromAddress(token.address)
                    if (ticker) {
                      const krc20Supply = await kasplexAPI.getMaxSupply(ticker)
                      if (krc20Supply !== null) {
                        supply = krc20Supply
                      }
                    }
                  }

                  // Fall back to RPC if not bridged or KRC20 fetch failed
                  if (supply === 0) {
                    try {
                      const totalSupplyMethodId = "0x18160ddd"
                      const result = await kasplexAPI.rpcCall("eth_call", [
                        { to: token.address, data: totalSupplyMethodId },
                        "latest",
                      ])
                      if (result && result !== "0x") {
                        supply = Number.parseInt(result, 16) / Math.pow(10, 18)
                      }
                    } catch (rpcError) {
                      console.warn(`Failed to fetch supply for ${token.symbol}:`, rpcError)
                    }
                  }

                  // Get current price
                  let currentPrice = token.priceUSD || 0
                  try {
                    const currentPriceData = await zealousAPI.getCurrentTokenPrice(token.address)
                    if (currentPriceData && typeof currentPriceData.priceUSD === "number") {
                      currentPrice = currentPriceData.priceUSD
                    }
                  } catch (priceError) {
                    console.warn(`Could not fetch current price for ${token.symbol}:`, priceError)
                  }

                  return currentPrice * supply
                } catch (error) {
                  console.warn(`Error calculating market cap for ${token.symbol}:`, error)
                  return 0
                }
              }),
            )
            totalMarketCap += batchMarketCaps.reduce((sum, mc) => sum + mc, 0)
          }

          // Update protocol stats with corrected market cap
          setProtocolStats((prev) => (prev ? { ...prev, totalMarketCap } : null))
        } catch (tokenError) {
          console.warn("Could not calculate accurate market cap:", tokenError)
          setTokenCount(0)
        }
      } catch (err) {
        console.error("Failed to fetch protocol stats:", err)
        setError("Failed to load protocol statistics")
      } finally {
        setLoading(false)
      }
    }

    fetchProtocolStats()
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

  return (
    <BeamsBackground>
      <div className="min-h-screen flex flex-col font-inter">
        <Navigation currentNetwork="kasplex" onNetworkChange={() => {}} onSearch={handleSearch} />
        <main className="flex-1 mx-auto max-w-7xl px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push("/dapps")}
              className="relative text-white hover:bg-black/60 active:bg-black/80 mb-4 overflow-hidden before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-br before:from-blue-500 before:via-purple-500 before:to-pink-500 after:absolute after:inset-[1px] after:bg-black/40 after:backdrop-blur-xl after:rounded-[calc(0.375rem-1px)] hover:after:bg-black/60 active:after:bg-black/80"
            >
              <span className="relative z-10 flex items-center">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to DApps
              </span>
            </Button>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
            >
              <div className="flex items-center gap-4">
                <img src="/zealous-logo.png" alt="Zealous Swap" className="h-16 w-16 rounded-xl" />
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white font-orbitron">Zealous Swap</h1>
                  <p className="text-white/70 font-rajdhani text-lg">Decentralized Exchange on Kasplex</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Active</Badge>
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">DEX</Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  className="relative text-white font-rajdhani hover:bg-black/60 active:bg-black/80 overflow-hidden before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-br before:from-green-500 before:to-blue-500 after:absolute after:inset-[1px] after:bg-black/40 after:backdrop-blur-xl after:rounded-[calc(0.375rem-1px)] hover:after:bg-black/60 active:after:bg-black/80"
                  onClick={() => window.open("https://www.zealousswap.com/", "_blank")}
                >
                  <span className="relative z-10 flex items-center">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Launch App
                  </span>
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Protocol Stats - 2 on top row, 1 on bottom for mobile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8"
          >
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70 font-rajdhani">Total TVL</CardTitle>
                <DollarSign className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white font-orbitron">
                  {loading ? "Loading..." : error ? "Error" : formatCurrency(protocolStats?.totalTVL || 0)}
                </div>
                <p className="text-xs text-green-300 mt-1 font-inter">Total Value Locked</p>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70 font-rajdhani">Verified Tokens</CardTitle>
                <Coins className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white font-orbitron">
                  {loading ? "Loading..." : error ? "Error" : tokenCount}
                </div>
                <p className="text-xs text-purple-300 mt-1 font-inter">Available tokens</p>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/20 backdrop-blur-xl col-span-2 md:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70 font-rajdhani">Active Pools</CardTitle>
                <Droplets className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white font-orbitron">
                  {loading ? "Loading..." : error ? "Error" : protocolStats?.poolCount || 0}
                </div>
                <p className="text-xs text-blue-300 mt-1 font-inter">Liquidity pools</p>
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
            <ZealousVolumeChart />
          </motion.div>

          {/* Pools and Tokens Tabs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Tabs defaultValue="tokens" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 bg-black/40 border-white/20">
                <TabsTrigger
                  value="tokens"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-white text-white/70 font-rajdhani"
                >
                  <Coins className="h-4 w-4 mr-2" />
                  Tokens
                </TabsTrigger>
                <TabsTrigger
                  value="pools"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-500 data-[state=active]:text-white text-white/70 font-rajdhani"
                >
                  <Droplets className="h-4 w-4 mr-2" />
                  Pools
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tokens">
                <ZealousTokensList />
              </TabsContent>
              <TabsContent value="pools">
                <ZealousPoolsTable />
              </TabsContent>
            </Tabs>
          </motion.div>
        </main>
        <Footer />
      </div>
    </BeamsBackground>
  )
}
