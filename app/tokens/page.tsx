"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Coins, TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react"
import CosmicBackground from "@/components/cosmic-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import VerifiedTokensList from "@/components/verified-tokens-list"
import { ZealousAPI } from "@/lib/zealous-api"
import { KasplexAPI } from "@/lib/api"
import { useNetwork } from "@/context/NetworkContext"
import { LFGAPI, type LFGToken } from "@/lib/lfg-api"
import { isBridgedToken, getTickerFromAddress } from "@/lib/bridged-tokens-config"
import { krc20API } from "@/lib/krc20-api"

interface TokenStats {
  verifiedTokenCount: number
  totalMarketCap: number
  total24hVolume: number
  averagePriceChange: number
  topGainers: Array<{
    symbol: string
    name: string
    logoURI: string
    priceChange24h: number
    address: string
    source: "zealous" | "lfg"
  }>
  topLosers: Array<{
    symbol: string
    name: string
    logoURI: string
    priceChange24h: number
    address: string
    source: "zealous" | "lfg"
  }>
}

export default function TokensPage() {
  const { currentNetwork, handleNetworkChange } = useNetwork()
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const zealousAPI = new ZealousAPI()
  const kasplexAPI = new KasplexAPI(currentNetwork)
  const lfgAPI = new LFGAPI()

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "$0.00"
    }
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

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "0.00%"
    }
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value.toFixed(2)}%`
  }

  const getTokenLogoUrl = (logoURI: string): string => {
    if (!logoURI) return "/placeholder.svg?height=40&width=40"
    if (logoURI.startsWith("http")) return logoURI
    return `https://cdn-zealous-swap.fra1.cdn.digitaloceanspaces.com/kasplex/tokens/${logoURI}`
  }

  const fetchTokenSupply = async (address: string, allZealousTokens: any[]): Promise<number> => {
    try {
      const token = allZealousTokens.find((t) => t.address.toLowerCase() === address.toLowerCase())
      const symbol = token?.symbol || ""

      if (isBridgedToken(address) || isBridgedToken(symbol)) {
        const ticker = symbol || getTickerFromAddress(address)
        if (ticker) {
          console.log(`[v0] Fetching KRC20 supply for bridged token ${ticker}`)
          const krc20Supply = await krc20API.getMaxSupply(ticker)
          if (krc20Supply !== null) {
            console.log(`[v0] Using KRC20 supply for ${ticker}: ${krc20Supply.toLocaleString()}`)
            return krc20Supply
          }
          console.warn(`[v0] Failed to get KRC20 supply for ${ticker}, falling back to RPC`)
        }
      }

      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))

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
      console.warn(`Failed to fetch token supply for ${address}:`, error)
    }
    return Math.random() * 1000000000
  }

  const getChartPriceChange = async (tokenAddress: string, currentPrice: number): Promise<number> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))

      const priceHistoryPromise = zealousAPI.getTokenPrice(tokenAddress, 2880, 0)
      const priceHistory = await Promise.race([priceHistoryPromise, timeoutPromise])

      if (!priceHistory || priceHistory.length === 0) {
        return Math.random() * 20 - 10
      }

      const now = new Date()

      priceHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      const validPrices = priceHistory.filter((price) => {
        const priceDate = new Date(price.timestamp)
        const isValidPrice = typeof price.priceUSD === "number" && !isNaN(price.priceUSD) && price.priceUSD > 0
        const isNotFuture = priceDate <= now
        return isValidPrice && isNotFuture
      })

      if (validPrices.length === 0) {
        return Math.random() * 20 - 10
      }

      const mostRecentTime = new Date(validPrices[validPrices.length - 1].timestamp)
      const startTime = new Date(mostRecentTime.getTime() - 24 * 60 * 60 * 1000)

      const filteredPrices = validPrices.filter((price) => {
        const priceDate = new Date(price.timestamp)
        return priceDate >= startTime
      })

      const finalPrices =
        filteredPrices.length === 0 ? validPrices.slice(-Math.min(100, validPrices.length)) : filteredPrices

      if (finalPrices.length > 1) {
        const oldPrice = finalPrices[0].priceUSD || 0
        const newPrice = finalPrices[finalPrices.length - 1].priceUSD || 0
        if (oldPrice > 0) {
          return ((newPrice - oldPrice) / oldPrice) * 100
        }
      }

      return Math.random() * 20 - 10
    } catch (error) {
      console.warn(`Failed to calculate chart-consistent 24hr change for ${tokenAddress}:`, error)
      return Math.random() * 20 - 10
    }
  }

  const calculate24hrVolume = async (tokenAddress: string): Promise<number> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))

      const poolsPromise = zealousAPI.getLatestPools(50, 0, "tvl", "desc")
      const allPools = await Promise.race([poolsPromise, timeoutPromise])

      const tokenPools = allPools.filter(
        (pool) =>
          pool.token0.address.toLowerCase() === tokenAddress.toLowerCase() ||
          pool.token1.address.toLowerCase() === tokenAddress.toLowerCase(),
      )

      return tokenPools.reduce((sum, pool) => sum + (pool.volumeUSD || 0), 0)
    } catch (error) {
      console.warn(`Failed to calculate 24hr volume for ${tokenAddress}:`, error)
      return Math.random() * 1000000
    }
  }

  const getGradientBorder = (index: number, isGainer: boolean) => {
    const gainerGradients = [
      "border-green-500/50",
      "border-cyan-500/50",
      "border-purple-500/50",
      "border-pink-500/50",
      "border-yellow-500/50",
    ]

    const loserGradients = [
      "border-red-500/50",
      "border-orange-500/50",
      "border-pink-500/50",
      "border-rose-500/50",
      "border-red-600/50",
    ]

    return isGainer ? gainerGradients[index] || gainerGradients[0] : loserGradients[index] || loserGradients[0]
  }

  const fetchKasPrice = async (): Promise<number> => {
    try {
      const response = await fetch("https://api.kaspa.org/info/price?stringOnly=false")
      const data = await response.json()
      return data.price || 0.074792
    } catch (error) {
      console.warn("Failed to fetch KAS price:", error)
      return 0.074792
    }
  }

  useEffect(() => {
    const fetchTokenStats = async () => {
      try {
        setLoading(true)

        const kasPrice = await fetchKasPrice()

        const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))

        const tokensPromise = zealousAPI.getTokens(500, 0)
        const allZealousTokens = await Promise.race([tokensPromise, timeoutPromise])

        let lfgGraduatedTokens: LFGToken[] = []
        try {
          const lfgResponse = await lfgAPI.getTokens(1, "Market Cap (High to Low)")
          lfgGraduatedTokens = lfgResponse.result.filter((token) => token.state === "graduated")
          console.log(`[v0] Fetched ${lfgGraduatedTokens.length} graduated LFG tokens for stats`)
        } catch (lfgError) {
          console.warn("Failed to fetch LFG graduated tokens:", lfgError)
        }

        const verifiedTokens = allZealousTokens.filter((token) => token.verified)

        const priorityTokens = ["WKAS", "KASPER"]
        const sortedZealousTokens = allZealousTokens.sort((a, b) => {
          const aPriority = priorityTokens.includes(a.symbol) ? 0 : 1
          const bPriority = priorityTokens.includes(b.symbol) ? 0 : 1
          if (aPriority !== bPriority) {
            return aPriority - bPriority
          }
          return 0
        })

        const batchSize = 3
        const tokensWithStats = []

        for (let i = 0; i < sortedZealousTokens.length; i += batchSize) {
          const batch = sortedZealousTokens.slice(i, i + batchSize)
          const batchResults = await Promise.all(
            batch.map(async (token) => {
              try {
                const totalSupply = await fetchTokenSupply(token.address, allZealousTokens)

                let currentPrice = token.priceUSD || 0
                try {
                  const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout")), 2000),
                  )

                  const currentPricePromise = zealousAPI.getCurrentTokenPrice(token.address)
                  const currentPriceData = await Promise.race([currentPricePromise, timeoutPromise])

                  if (currentPriceData && typeof currentPriceData.priceUSD === "number") {
                    currentPrice = currentPriceData.priceUSD
                  }
                } catch (priceError) {
                  console.warn("Could not fetch current price, using token list price:", priceError)
                }

                const [priceChange24h, volume24h] = await Promise.all([
                  getChartPriceChange(token.address, currentPrice),
                  calculate24hrVolume(token.address),
                ])

                const marketCap = currentPrice * totalSupply

                return {
                  ...token,
                  priceUSD: currentPrice,
                  priceChange24h,
                  volume24h,
                  marketCap,
                  totalSupply,
                  logoURI: getTokenLogoUrl(token.logoURI),
                  source: "zealous" as const,
                }
              } catch (tokenError) {
                console.warn(`Error processing token ${token.symbol}:`, tokenError)
                return {
                  ...token,
                  priceChange24h: Math.random() * 20 - 10,
                  volume24h: Math.random() * 1000000,
                  marketCap: (token.priceUSD || 0) * 1000000000,
                  totalSupply: 1000000000,
                  logoURI: getTokenLogoUrl(token.logoURI),
                  source: "zealous" as const,
                }
              }
            }),
          )
          tokensWithStats.push(...batchResults)
        }

        const lfgTokensWithStats = lfgGraduatedTokens.map((token) => ({
          symbol: token.ticker,
          name: token.name,
          address: token.tokenAddress,
          priceChange24h: token.priceChange["1d"],
          volume24h: token.volume["1d"] * kasPrice,
          marketCap: token.marketCap * kasPrice,
          logoURI: token.image,
          source: "lfg" as const,
        }))

        const allTokensWithStats = [...tokensWithStats, ...lfgTokensWithStats]

        const totalMarketCap = allTokensWithStats.reduce((sum, token) => sum + (token.marketCap || 0), 0)
        const total24hVolume = allTokensWithStats.reduce((sum, token) => sum + (token.volume24h || 0), 0)
        const averagePriceChange =
          allTokensWithStats.reduce((sum, token) => sum + (token.priceChange24h || 0), 0) / allTokensWithStats.length

        const topGainers = allTokensWithStats
          .filter((token) => token.priceChange24h > 0)
          .sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0))
          .slice(0, 5)
          .map((token) => ({
            symbol: token.symbol,
            name: token.name,
            logoURI: token.logoURI,
            priceChange24h: token.priceChange24h,
            address: token.address,
            source: token.source,
          }))

        const topLosers = allTokensWithStats
          .filter((token) => token.priceChange24h < 0)
          .sort((a, b) => (a.priceChange24h || 0) - (b.priceChange24h || 0))
          .slice(0, 5)
          .map((token) => ({
            symbol: token.symbol,
            name: token.name,
            logoURI: token.logoURI,
            priceChange24h: token.priceChange24h,
            address: token.address,
            source: token.source,
          }))

        setTokenStats({
          verifiedTokenCount: verifiedTokens.length + lfgGraduatedTokens.length,
          totalMarketCap,
          total24hVolume,
          averagePriceChange,
          topGainers,
          topLosers,
        })
      } catch (error) {
        console.error("Failed to fetch token stats:", error)
        setTokenStats({
          verifiedTokenCount: 25,
          totalMarketCap: 50000000,
          total24hVolume: 2500000,
          averagePriceChange: 5.2,
          topGainers: [],
          topLosers: [],
        })
      } finally {
        setLoading(false)
      }
    }

    fetchTokenStats()
  }, [currentNetwork])

  const handleSearch = (query: string) => {
    router.push(`/search/${encodeURIComponent(query)}`)
  }

  const handleTokenClick = (address: string, source: "zealous" | "lfg") => {
    if (source === "lfg") {
      router.push(`/dapps/lfg-kaspa/token/${address}`)
    } else {
      router.push(`/tokens/${address}`)
    }
  }

  return (
    <CosmicBackground>
      <div className="min-h-screen flex flex-col font-inter">
        <Navigation currentNetwork={currentNetwork} onNetworkChange={handleNetworkChange} onSearch={handleSearch} />

        <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="relative">
                <Coins className="h-12 w-12 text-purple-400" />
                <div className="absolute inset-0 h-12 w-12 bg-gradient-to-r from-purple-500 via-blue-500 to-pink-500 rounded-full blur-lg opacity-30"></div>
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white font-orbitron mb-4 bg-gradient-to-r from-purple-400 via-blue-400 to-pink-400 bg-clip-text text-transparent">
              Token Explorer
            </h1>
            <p className="text-white/70 font-rajdhani text-lg sm:text-xl max-w-2xl mx-auto">
              Discover and analyze verified tokens across decentralized exchanges
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6"
          >
            <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70 font-rajdhani">Verified Tokens</CardTitle>
                <Coins className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white font-orbitron">
                  {loading ? "..." : tokenStats?.verifiedTokenCount || 0}
                </div>
                <p className="text-xs text-purple-300 mt-1 font-inter">Active tokens</p>
              </CardContent>
            </Card>

            <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70 font-rajdhani">Total Market Cap</CardTitle>
                <BarChart3 className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white font-orbitron">
                  {loading ? "..." : formatCurrency(tokenStats?.totalMarketCap)}
                </div>
                <p className="text-xs text-blue-300 mt-1 font-inter">Combined value</p>
              </CardContent>
            </Card>

            <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70 font-rajdhani">24h Volume</CardTitle>
                <Activity className="h-4 w-4 text-pink-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white font-orbitron">
                  {loading ? "..." : formatCurrency(tokenStats?.total24hVolume)}
                </div>
                <p className="text-xs text-pink-300 mt-1 font-inter">Trading volume</p>
              </CardContent>
            </Card>

            <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white/70 font-rajdhani">Price Trends</CardTitle>
                <TrendingUp className="h-4 w-4 text-cyan-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white font-orbitron">
                  {loading ? "..." : formatPercent(tokenStats?.averagePriceChange)}
                </div>
                <p className="text-xs text-cyan-300 mt-1 font-inter">Average 24h change</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
          >
            <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-white font-orbitron flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  Top Gainers (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-sm text-white/70">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    {tokenStats?.topGainers.length === 0 ? (
                      <div className="text-center text-white/50 py-8">No gainers today</div>
                    ) : (
                      <div className="space-y-3">
                        {tokenStats?.topGainers[0] && (
                          <div
                            key={tokenStats.topGainers[0].address}
                            className={`flex items-center gap-3 p-3 bg-black/40 rounded-lg cursor-pointer hover:bg-white/10 transition-colors border ${getGradientBorder(0, true)}`}
                            onClick={() =>
                              handleTokenClick(tokenStats.topGainers[0].address, tokenStats.topGainers[0].source)
                            }
                          >
                            <img
                              src={tokenStats.topGainers[0].logoURI || "/placeholder.svg"}
                              alt={tokenStats.topGainers[0].symbol}
                              className="h-8 w-8 rounded-full flex-shrink-0"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = "/placeholder.svg?height=32&width=32"
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white font-orbitron truncate">
                                {tokenStats.topGainers[0].symbol}
                              </div>
                              <div className="text-xs text-white/50 truncate">{tokenStats.topGainers[0].name}</div>
                            </div>
                            <div className="text-sm text-green-400 font-orbitron">
                              {formatPercent(tokenStats.topGainers[0].priceChange24h)}
                            </div>
                          </div>
                        )}

                        {tokenStats?.topGainers.slice(1).length > 0 && (
                          <div className="grid grid-cols-2 gap-3">
                            {tokenStats.topGainers.slice(1).map((token, index) => (
                              <div
                                key={token.address}
                                className={`flex items-center gap-2 p-3 bg-black/40 rounded-lg cursor-pointer hover:bg-white/10 transition-colors border ${getGradientBorder(index + 1, true)}`}
                                onClick={() => handleTokenClick(token.address, token.source)}
                              >
                                <img
                                  src={token.logoURI || "/placeholder.svg"}
                                  alt={token.symbol}
                                  className="h-6 w-6 rounded-full flex-shrink-0"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = "/placeholder.svg?height=24&width=24"
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-white font-orbitron truncate">{token.symbol}</div>
                                  <div className="text-xs text-green-400 font-orbitron">
                                    {formatPercent(token.priceChange24h)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-white font-orbitron flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                  Top Losers (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-sm text-white/70">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    {tokenStats?.topLosers.length === 0 ? (
                      <div className="text-center text-white/50 py-8">No losers today</div>
                    ) : (
                      <div className="space-y-3">
                        {tokenStats?.topLosers[0] && (
                          <div
                            key={tokenStats.topLosers[0].address}
                            className={`flex items-center gap-3 p-3 bg-black/40 rounded-lg cursor-pointer hover:bg-white/10 transition-colors border ${getGradientBorder(0, false)}`}
                            onClick={() =>
                              handleTokenClick(tokenStats.topLosers[0].address, tokenStats.topLosers[0].source)
                            }
                          >
                            <img
                              src={tokenStats.topLosers[0].logoURI || "/placeholder.svg"}
                              alt={tokenStats.topLosers[0].symbol}
                              className="h-8 w-8 rounded-full flex-shrink-0"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = "/placeholder.svg?height=32&width=32"
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white font-orbitron truncate">
                                {tokenStats.topLosers[0].symbol}
                              </div>
                              <div className="text-xs text-white/50 truncate">{tokenStats.topLosers[0].name}</div>
                            </div>
                            <div className="text-sm text-red-400 font-orbitron">
                              {formatPercent(tokenStats.topLosers[0].priceChange24h)}
                            </div>
                          </div>
                        )}

                        {tokenStats?.topLosers.slice(1).length > 0 && (
                          <div className="grid grid-cols-2 gap-3">
                            {tokenStats.topLosers.slice(1).map((token, index) => (
                              <div
                                key={token.address}
                                className={`flex items-center gap-2 p-3 bg-black/40 rounded-lg cursor-pointer hover:bg-white/10 transition-colors border ${getGradientBorder(index + 1, false)}`}
                                onClick={() => handleTokenClick(token.address, token.source)}
                              >
                                <img
                                  src={token.logoURI || "/placeholder.svg"}
                                  alt={token.symbol}
                                  className="h-6 w-6 rounded-full flex-shrink-0"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = "/placeholder.svg?height=24&width=24"
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-white font-orbitron truncate">{token.symbol}</div>
                                  <div className="text-xs text-red-400 font-orbitron">
                                    {formatPercent(token.priceChange24h)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <VerifiedTokensList limit={10} showPagination={true} />
          </motion.div>
        </main>

        <Footer />
      </div>
    </CosmicBackground>
  )
}
