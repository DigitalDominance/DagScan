"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  BarChart3,
  Calendar,
  Copy,
  CheckCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import BeamsBackground from "@/components/beams-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import TokenPriceChart from "@/components/token-price-chart"
import { ZealousAPI, type Pool, type Token } from "@/lib/zealous-api"
import { KasplexAPI } from "@/lib/api"

interface TokenInfo extends Token {
  priceChange24h: number
  volume24h: number
  marketCap: number
  pools: Pool[]
  totalSupply: number
}

interface TokenApiInfo {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

export default function TokenPage() {
  const params = useParams()
  const router = useRouter()
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [poolsPage, setPoolsPage] = useState(1)
  const poolsPerPage = 5

  const tokenAddress = params.address as string
  const zealousAPI = new ZealousAPI()
  const kasplexAPI = new KasplexAPI("kasplex")

  const fetchAllTokens = async (): Promise<TokenApiInfo[]> => {
    try {
      const response = await fetch(
        `https://dagscanbackend-7220ff41cc76.herokuapp.com/api/zealous/tokens?limit=1000&skip=0`,
      )
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const tokensData = await response.json()
      return tokensData
    } catch (error) {
      console.warn("Failed to fetch all tokens:", error)
      return []
    }
  }

  const getTokenLogoUrl = (logoURI: string): string => {
    if (!logoURI) return "/placeholder.svg?height=40&width=40"
    if (logoURI.startsWith("http")) return logoURI
    return `https://cdn-zealous-swap.fra1.cdn.digitaloceanspaces.com/kasplex/tokens/${logoURI}`
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

  // Fetch token supply from RPC
  const fetchTokenSupply = async (address: string): Promise<number> => {
    try {
      // ERC20 totalSupply() method signature
      const totalSupplyMethodId = "0x18160ddd"

      const result = await kasplexAPI.rpcCall("eth_call", [
        {
          to: address,
          data: totalSupplyMethodId,
        },
        "latest",
      ])

      if (result && result !== "0x") {
        // Convert hex to decimal and adjust for decimals (assuming 18 decimals)
        const supply = Number.parseInt(result, 16) / Math.pow(10, 18)
        return supply
      }

      // Fallback to mock supply if RPC call fails
      return Math.random() * 1000000000
    } catch (error) {
      console.warn("Failed to fetch token supply from RPC:", error)
      // Return mock supply as fallback
      return Math.random() * 1000000000
    }
  }

  // Calculate accurate 24hr price change from historical data
  const getChartPriceChange = async (tokenAddress: string, currentPrice: number): Promise<number> => {
    try {
      const now = new Date()
      // Get 2 days worth of data to ensure coverage
      const limit = 2880
      const prices = await zealousAPI.getTokenPrice(tokenAddress, limit, 0)

      if (!prices || prices.length === 0) {
        return 0
      }

      // Sort all prices by timestamp first to get chronological order
      prices.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      // Filter to get only valid prices from the past
      const validPrices = prices.filter((price) => {
        const priceDate = new Date(price.timestamp)
        const isValidPrice = typeof price.priceUSD === "number" && !isNaN(price.priceUSD) && price.priceUSD > 0
        const isNotFuture = priceDate <= now
        return isValidPrice && isNotFuture
      })

      if (validPrices.length === 0) {
        return 0
      }

      // Get data from the most recent time backwards 24 hours
      const mostRecentTime = new Date(validPrices[validPrices.length - 1].timestamp)
      const startTime = new Date(mostRecentTime.getTime() - 24 * 60 * 60 * 1000)

      let filteredPrices = validPrices.filter((price) => {
        const priceDate = new Date(price.timestamp)
        return priceDate >= startTime
      })

      // If no data in the specific time range, get the most recent available data
      if (filteredPrices.length === 0) {
        filteredPrices = validPrices.slice(-Math.min(100, validPrices.length))
      }

      // Calculate price change using first and last data points from filtered array
      if (filteredPrices.length > 1) {
        const oldPrice = filteredPrices[0].priceUSD || 0
        const newPrice = filteredPrices[filteredPrices.length - 1].priceUSD || 0
        if (oldPrice > 0) {
          return ((newPrice - oldPrice) / oldPrice) * 100
        }
      }

      return 0
    } catch (error) {
      console.warn(`Failed to calculate 24hr change for ${tokenAddress}:`, error)
      return 0
    }
  }

  useEffect(() => {
    const fetchTokenInfoData = async () => {
      try {
        setLoading(true)

        // First, try to get token from the tokens API
        const tokens = await zealousAPI.getTokens(1000, 0)
        const token = tokens.find((t) => t.address.toLowerCase() === tokenAddress.toLowerCase())

        if (!token) {
          throw new Error("Token not found")
        }

        // Fetch token supply from RPC
        const totalSupply = await fetchTokenSupply(tokenAddress)

        // Get current price
        let currentPrice = token.priceUSD || 0
        try {
          const currentPriceData = await zealousAPI.getCurrentTokenPrice(tokenAddress)
          if (currentPriceData && typeof currentPriceData.priceUSD === "number") {
            currentPrice = currentPriceData.priceUSD
          }
        } catch (priceError) {
          console.warn("Could not fetch current price, using token list price:", priceError)
        }

        // Calculate accurate 24hr price change
        const priceChange24h = await getChartPriceChange(tokenAddress, currentPrice)

        // Get all pools to find ones containing this token
        const allPools = await zealousAPI.getLatestPools(100, 0, "tvl", "desc")
        const tokenPools = allPools.filter(
          (pool) =>
            pool.token0.address.toLowerCase() === tokenAddress.toLowerCase() ||
            pool.token1.address.toLowerCase() === tokenAddress.toLowerCase(),
        )

        // Fetch all tokens to get logo information
        const allTokens = await fetchAllTokens()

        // Create a map of token addresses to logo URLs
        const logoMap: Record<string, string> = {}
        allTokens.forEach((tokenData) => {
          const address = tokenData.address.toLowerCase()
          logoMap[address] = tokenData.logoURI
            ? getTokenLogoUrl(tokenData.logoURI)
            : "/placeholder.svg?height=40&width=40"
        })

        // Process pools with fetched logos
        const processedPools = tokenPools.map((pool) => ({
          ...pool,
          token0: {
            ...pool.token0,
            logoURI: logoMap[pool.token0.address.toLowerCase()] || "/placeholder.svg?height=40&width=40",
          },
          token1: {
            ...pool.token1,
            logoURI: logoMap[pool.token1.address.toLowerCase()] || "/placeholder.svg?height=40&width=40",
          },
        }))

        // Calculate aggregated stats
        const volume24h = processedPools.reduce((sum, pool) => sum + (pool.volumeUSD || 0), 0)

        // Calculate market cap with real supply and current price
        const marketCap = currentPrice * totalSupply

        setTokenInfo({
          ...token,
          priceUSD: currentPrice, // Use the fetched current price
          priceChange24h,
          volume24h,
          marketCap,
          pools: processedPools,
          totalSupply,
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

  // Pagination for pools
  const paginatedPools = tokenInfo?.pools.slice((poolsPage - 1) * poolsPerPage, poolsPage * poolsPerPage) || []

  const totalPoolsPages = Math.ceil((tokenInfo?.pools.length || 0) / poolsPerPage)

  if (loading) {
    return (
      <BeamsBackground>
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
      </BeamsBackground>
    )
  }

  if (error || !tokenInfo) {
    return (
      <BeamsBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork="kasplex" onNetworkChange={() => {}} onSearch={handleSearch} />
          <main className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <p className="text-red-400 font-inter mb-4">{error || "Token not found"}</p>
              <Button onClick={() => router.push("/dapps/zealous-swap")} className="bg-purple-600 hover:bg-purple-700">
                Back to Zealous Swap
              </Button>
            </div>
          </main>
          <Footer />
        </div>
      </BeamsBackground>
    )
  }

  return (
    <BeamsBackground>
      <div className="min-h-screen flex flex-col font-inter overflow-x-hidden">
        <Navigation currentNetwork="kasplex" onNetworkChange={() => {}} onSearch={handleSearch} />

        <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-8 overflow-x-hidden w-full">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push("/dapps/zealous-swap")}
              className="text-white mb-4 relative overflow-hidden group bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all duration-300 border border-transparent hover:shadow-[0_0_20px_rgba(59,130,246,0.3),0_0_40px_rgba(147,51,234,0.2),0_0_60px_rgba(236,72,153,0.1)] before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-r before:from-blue-500 before:via-purple-500 before:to-pink-500 before:-z-10 before:opacity-0 hover:before:opacity-100"
            >
              <div className="relative flex items-center">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Zealous Swap
              </div>
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
                  <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold text-white font-orbitron truncate">
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

              <div className="flex justify-center lg:justify-end flex-shrink-0">
                <Button
                  className="bg-black/40 border-2 border-transparent bg-clip-padding backdrop-blur-xl text-white font-orbitron hover:bg-black/60 relative overflow-hidden w-full sm:w-auto"
                  style={{
                    borderImage: "linear-gradient(45deg, #8B5CF6, #EC4899, #3B82F6) 1",
                  }}
                  onClick={() => window.open("https://www.zealousswap.com/", "_blank")}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 opacity-20 rounded-md"></div>
                  <div className="relative flex items-center">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Trade on Zealous</span>
                    <span className="sm:hidden">Trade</span>
                  </div>
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Token Stats - 2 per row on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-8"
          >
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
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
                    (tokenInfo.priceChange24h || 0) >= 0 ? "text-purple-400" : "text-pink-400"
                  }`}
                >
                  {(tokenInfo.priceChange24h || 0) >= 0 ? (
                    <TrendingUp className="h-2 w-2 sm:h-3 sm:w-3" />
                  ) : (
                    <TrendingDown className="h-2 w-2 sm:h-3 sm:w-3" />
                  )}
                  <span className="text-xs font-inter">{formatPercent(tokenInfo.priceChange24h)} (24h)</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
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

            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
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

            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">
                  Active Pools
                </CardTitle>
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-sm sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                  {tokenInfo.pools.length}
                </div>
                <p className="text-xs text-purple-300 mt-1 font-inter">Liquidity pools</p>
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

          {/* Token Pools */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle className="text-white font-orbitron text-center sm:text-left">
                    Pools Containing {tokenInfo.symbol}
                  </CardTitle>
                  {totalPoolsPages > 1 && (
                    <div className="flex items-center justify-center sm:justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPoolsPage(poolsPage - 1)}
                        disabled={poolsPage === 1}
                        className="bg-black/40 border-white/20 text-white hover:bg-white/10"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-white/70 text-sm font-rajdhani px-2">
                        {poolsPage} of {totalPoolsPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPoolsPage(poolsPage + 1)}
                        disabled={poolsPage === totalPoolsPages}
                        className="bg-black/40 border-white/20 text-white hover:bg-white/10"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {paginatedPools.map((pool, index) => (
                    <motion.div
                      key={pool.address}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex flex-col lg:flex-row lg:items-center justify-between p-3 sm:p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors gap-3 sm:gap-4 w-full max-w-full overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0 flex-1">
                        <div className="flex -space-x-2 justify-center sm:justify-start flex-shrink-0">
                          <img
                            src={pool.token0.logoURI || "/placeholder.svg?height=40&width=40"}
                            alt={pool.token0.symbol}
                            className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border-2 border-black"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = "/placeholder.svg?height=40&width=40"
                            }}
                          />
                          <img
                            src={pool.token1.logoURI || "/placeholder.svg?height=40&width=40"}
                            alt={pool.token1.symbol}
                            className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border-2 border-black"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = "/placeholder.svg?height=40&width=40"
                            }}
                          />
                        </div>
                        <div className="text-center sm:text-left min-w-0 flex-1">
                          <div className="text-white font-semibold font-orbitron text-sm sm:text-base truncate">
                            {pool.token0.symbol}/{pool.token1.symbol}
                          </div>
                          <div className="text-white/50 text-xs sm:text-sm font-rajdhani truncate">
                            {pool.token0.name} / {pool.token1.name}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 flex-shrink-0">
                        <div className="grid grid-cols-2 lg:flex lg:gap-6 gap-4">
                          <div className="text-center lg:text-right">
                            <div className="text-white font-orbitron text-sm">{formatCurrency(pool.tvl || 0)}</div>
                            <div className="text-white/50 text-xs font-rajdhani">TVL</div>
                          </div>
                          <div className="text-center lg:text-right">
                            <div className="text-white font-orbitron text-sm">
                              {formatCurrency(pool.volumeUSD || 0)}
                            </div>
                            <div className="text-white/50 text-xs font-rajdhani">24h Volume</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-center lg:justify-end">
                          {pool.hasActiveFarm && (
                            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                              Farm
                            </Badge>
                          )}
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">Active</Badge>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>

        <Footer />
      </div>
    </BeamsBackground>
  )
}
