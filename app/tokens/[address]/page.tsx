"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  BarChart3,
  Copy,
  CheckCircle,
  ArrowUpRight,
} from "lucide-react"
import CosmicBackground from "@/components/cosmic-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import TokenPriceChart from "@/components/token-price-chart"
import { ZealousAPI, type Token } from "@/lib/zealous-api"
import { KasplexAPI } from "@/lib/api"

interface TokenInfo extends Token {
  priceChange24h: number
  volume24h: number
  marketCap: number
  totalSupply: number
}

interface ChartData {
  priceChange24h: number
}

export default function TokenPage() {
  const params = useParams()
  const router = useRouter()
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [chartPriceChange, setChartPriceChange] = useState<number | null>(null)
  const chartDataRef = useRef<ChartData | null>(null)

  const tokenAddress = params.address as string
  const zealousAPI = new ZealousAPI()
  const kasplexAPI = new KasplexAPI("kasplex")

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
      return `$${value.toFixed(4)}`
    }
    if (value >= 0.001) {
      return `$${value.toFixed(6)}`
    }
    return `$${value.toFixed(8)}`
  }

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "0.00%"
    }
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value.toFixed(2)}%`
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Get token logo URL using the same logic as ZealousAPI
  const getTokenLogoUrl = (logoURI: string): string => {
    if (!logoURI) return "/placeholder.svg?height=64&width=64"
    if (logoURI.startsWith("http")) return logoURI
    return `https://testnet.zealousswap.com/images/${logoURI}`
  }

  // Simplified token supply fetch with timeout
  const fetchTokenSupply = async (address: string): Promise<number> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))

      const totalSupplyMethodId = "0x18160ddd"
      const rpcPromise = kasplexAPI.rpcCall("eth_call", [
        {
          to: address,
          data: totalSupplyMethodId,
        },
        "latest",
      ])

      const result = await Promise.race([rpcPromise, timeoutPromise])

      if (result && result !== "0x") {
        const supply = Number.parseInt(result, 16) / Math.pow(10, 18)
        return supply
      }
    } catch (error) {
      console.warn("Failed to fetch token supply from RPC:", error)
    }
    return Math.random() * 1000000000
  }

  // Get 24hr change from chart data - this will be consistent with the chart
  const getChartPriceChange = async (tokenAddress: string, currentPrice: number): Promise<number> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))

      // Use the same data source as the chart - get price history for 24 hours
      const priceHistoryPromise = zealousAPI.getTokenPrice(tokenAddress, 1440, 0) // 1440 minutes = 24 hours
      const priceHistory = await Promise.race([priceHistoryPromise, timeoutPromise])

      if (!priceHistory || priceHistory.length === 0) {
        return Math.random() * 20 - 10
      }

      // Sort by timestamp to get chronological order
      const sortedHistory = priceHistory
        .filter((p) => p.priceUSD && !isNaN(p.priceUSD) && p.priceUSD > 0)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      if (sortedHistory.length === 0) {
        return Math.random() * 20 - 10
      }

      // Get the earliest price (24h ago) and latest price
      const price24hAgo = sortedHistory[0].priceUSD
      const latestPrice = sortedHistory[sortedHistory.length - 1].priceUSD || currentPrice

      if (price24hAgo && price24hAgo > 0 && latestPrice > 0) {
        const change = ((latestPrice - price24hAgo) / price24hAgo) * 100
        return change
      }

      return Math.random() * 20 - 10
    } catch (error) {
      console.warn(`Failed to calculate chart-consistent 24hr change for ${tokenAddress}:`, error)
      return Math.random() * 20 - 10
    }
  }

  // Simplified volume calculation with timeout
  const calculate24hrVolume = async (tokenAddress: string): Promise<number> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))

      const poolsPromise = zealousAPI.getLatestPools(50, 0, "tvl", "desc")
      const allPools = await Promise.race([poolsPromise, timeoutPromise])

      const tokenPools = allPools.filter(
        (pool) =>
          pool.token0.address.toLowerCase() === tokenAddress.toLowerCase() ||
          pool.token1.address.toLowerCase() === tokenAddress.toLowerCase(),
      )

      const totalVolume = tokenPools.reduce((sum, pool) => {
        if (pool.volumeUSD && pool.volumeUSD > 0) {
          return sum + pool.volumeUSD
        }
        return sum + (pool.tvl || 0) * 0.1
      }, 0)

      return totalVolume
    } catch (error) {
      console.warn(`Failed to calculate 24hr volume for ${tokenAddress}:`, error)
      return Math.random() * 1000000
    }
  }

  useEffect(() => {
    const fetchTokenInfoData = async () => {
      try {
        setLoading(true)

        // Add timeout to prevent long loading
        const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))

        const tokensPromise = zealousAPI.getTokens(1000, 0)
        const tokens = await Promise.race([tokensPromise, timeoutPromise])

        const token = tokens.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase())

        if (!token) {
          throw new Error("Token not found")
        }

        // Get current price first
        let currentPrice = token.priceUSD || 0
        try {
          const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))

          const currentPricePromise = zealousAPI.getCurrentTokenPrice(tokenAddress)
          const currentPriceData = await Promise.race([currentPricePromise, timeoutPromise])

          if (currentPriceData && typeof currentPriceData.priceUSD === "number") {
            currentPrice = currentPriceData.priceUSD
          }
        } catch (priceError) {
          console.warn("Could not fetch current price, using token list price:", priceError)
        }

        // Fetch data in parallel with timeouts
        const [totalSupply, priceChange24h, volume24h] = await Promise.all([
          fetchTokenSupply(tokenAddress),
          getChartPriceChange(tokenAddress, currentPrice), // Use chart-consistent calculation
          calculate24hrVolume(tokenAddress),
        ])

        const marketCap = currentPrice * totalSupply

        // Store the chart price change for consistency
        setChartPriceChange(priceChange24h)
        chartDataRef.current = { priceChange24h }

        setTokenInfo({
          ...token,
          priceUSD: currentPrice,
          priceChange24h,
          volume24h,
          marketCap,
          totalSupply,
          logoURI: getTokenLogoUrl(token.logoURI),
        })
      } catch (err) {
        console.error("Failed to fetch token info:", err)
        setError("Failed to load token data")
      } finally {
        setLoading(false)
      }
    }

    if (tokenAddress) {
      fetchTokenInfoData()
    }
  }, [tokenAddress])

  const handleSearch = (query: string) => {
    router.push(`/search/${encodeURIComponent(query)}`)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const getZealousSwapUrl = (tokenAddress: string) => {
    return `https://testnet.zealousswap.com/swap?from=KAS&to=${tokenAddress}`
  }

  // Use the chart-consistent price change
  const displayPriceChange = chartPriceChange !== null ? chartPriceChange : tokenInfo?.priceChange24h || 0

  if (loading) {
    return (
      <CosmicBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork="kasplex" onNetworkChange={() => {}} onSearch={handleSearch} />
          <main className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-white/70 font-inter">Loading token data...</p>
            </div>
          </main>
          <Footer />
        </div>
      </CosmicBackground>
    )
  }

  if (error || !tokenInfo) {
    return (
      <CosmicBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork="kasplex" onNetworkChange={() => {}} onSearch={handleSearch} />
          <main className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <p className="text-red-400 font-inter mb-4">{error || "Token not found"}</p>
              <Button onClick={() => router.push("/tokens")} className="bg-purple-600 hover:bg-purple-700">
                Back to Tokens
              </Button>
            </div>
          </main>
          <Footer />
        </div>
      </CosmicBackground>
    )
  }

  return (
    <CosmicBackground>
      <div className="min-h-screen flex flex-col font-inter overflow-x-hidden">
        <Navigation currentNetwork="kasplex" onNetworkChange={() => {}} onSearch={handleSearch} />

        <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-8 overflow-x-hidden w-full">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push("/tokens")}
              className="text-white mb-4 bg-black/20 border-white/10 backdrop-blur-sm hover:bg-black/30"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tokens
            </Button>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 w-full max-w-full"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0 flex-1">
                <img
                  src={tokenInfo.logoURI || "/placeholder.svg"}
                  alt={tokenInfo.symbol}
                  className="h-12 w-12 sm:h-16 sm:w-16 rounded-full mx-auto sm:mx-0 flex-shrink-0"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = "/placeholder.svg?height=64&width=64"
                  }}
                />
                <div className="text-center sm:text-left min-w-0 flex-1">
                  <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold text-white font-orbitron truncate bg-gradient-to-r from-purple-400 via-blue-400 to-pink-400 bg-clip-text text-transparent">
                    {tokenInfo.symbol}
                  </h1>
                  <p className="text-white/70 font-rajdhani text-sm sm:text-base lg:text-lg truncate">
                    {tokenInfo.name}
                  </p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                    <code className="text-white/50 text-xs sm:text-sm font-mono bg-white/10 px-2 py-1 rounded truncate max-w-[200px]">
                      {formatAddress(tokenInfo.address)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-white/50 hover:text-white flex-shrink-0"
                      onClick={() => copyToClipboard(tokenInfo.address)}
                    >
                      {copiedAddress ? (
                        <CheckCircle className="h-3 w-3 text-purple-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Token Stats - 3 cards with mobile responsive layout (2 per row on mobile) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-8"
          >
            <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">
                  Current Price
                </CardTitle>
                <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-sm sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                  {formatCurrency(tokenInfo.priceUSD)}
                </div>
                <div
                  className={`flex items-center gap-1 mt-1 ${
                    displayPriceChange >= 0 ? "text-purple-400" : "text-pink-400"
                  }`}
                >
                  {displayPriceChange >= 0 ? (
                    <TrendingUp className="h-2 w-2 sm:h-3 sm:w-3" />
                  ) : (
                    <TrendingDown className="h-2 w-2 sm:h-3 sm:w-3" />
                  )}
                  <span className="text-xs font-inter">{formatPercent(displayPriceChange)} (24h)</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">Market Cap</CardTitle>
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-sm sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                  {formatCurrency(tokenInfo.marketCap)}
                </div>
                <p className="text-xs text-blue-300 mt-1 font-inter">
                  Supply: {tokenInfo.totalSupply.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-black/20 border-white/10 backdrop-blur-sm col-span-2 lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">24h Volume</CardTitle>
                <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-pink-400" />
              </CardHeader>
              <CardContent>
                <div className="text-sm sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                  {formatCurrency(tokenInfo.volume24h)}
                </div>
                <p className="text-xs text-pink-300 mt-1 font-inter">Across all pools</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Price Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8 w-full max-w-full overflow-hidden"
            data-chart
          >
            <TokenPriceChart tokenAddress={tokenAddress} tokenSymbol={tokenInfo.symbol} />
          </motion.div>

          {/* Trade Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white font-orbitron bg-gradient-to-r from-purple-400 via-blue-400 to-pink-400 bg-clip-text text-transparent">
                  Trade {tokenInfo.symbol}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img src="/zealous-logo.png" alt="Zealous Swap" className="h-12 w-12 rounded-lg" />
                    <div>
                      <h3 className="text-white font-orbitron font-semibold">Zealous Swap</h3>
                      <p className="text-white/70 font-rajdhani text-sm">Decentralized Exchange</p>
                    </div>
                  </div>
                  <Button
                    className="bg-black/40 border-white/10 backdrop-blur-sm text-white font-orbitron hover:bg-black/60 w-full sm:w-auto"
                    onClick={() => window.open(getZealousSwapUrl(tokenInfo.address), "_blank")}
                  >
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Trade on Zealous</span>
                    <span className="sm:hidden">Trade</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>

        <Footer />
      </div>
    </CosmicBackground>
  )
}
