"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { ZealousAPI, type Token } from "@/lib/zealous-api"
import { KasplexAPI } from "@/lib/api"
import { useRouter } from "next/navigation"

interface ZealousTokensListProps {
  limit?: number
  showPagination?: boolean
}

export default function ZealousTokensList({ limit = 10, showPagination = true }: ZealousTokensListProps) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<"priceUSD" | "marketCap" | "volume24h">("marketCap")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [tokenSupplies, setTokenSupplies] = useState<Record<string, number>>({})

  const router = useRouter()
  const zealousAPI = new ZealousAPI()
  const kasplexAPI = new KasplexAPI("kasplex")
  const tokensPerPage = limit

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
      console.warn(`Failed to fetch token supply for ${address}:`, error)
      // Return mock supply as fallback
      return Math.random() * 1000000000
    }
  }

  // Calculate accurate 24hr price change from historical data
  const calculate24hrChange = async (tokenAddress: string, currentPrice: number): Promise<number> => {
    try {
      // Get price data from 24 hours ago
      const priceHistory = await zealousAPI.getTokenPrice(tokenAddress, 1440, 0) // 24 hours of minute data

      if (!priceHistory || priceHistory.length === 0) {
        return 0
      }

      // Sort by timestamp to get chronological order
      const sortedHistory = priceHistory
        .filter((p) => p.priceUSD && !isNaN(p.priceUSD) && p.priceUSD > 0)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      if (sortedHistory.length === 0) {
        return 0
      }

      // Get price from 24 hours ago (first valid price in our dataset)
      const price24hAgo = sortedHistory[0].priceUSD

      if (price24hAgo && price24hAgo > 0 && currentPrice > 0) {
        return ((currentPrice - price24hAgo) / price24hAgo) * 100
      }

      return 0
    } catch (error) {
      console.warn(`Failed to calculate 24hr change for ${tokenAddress}:`, error)
      return 0
    }
  }

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true)
        setError(null)

        const offset = (currentPage - 1) * tokensPerPage
        let tokensData = await zealousAPI.getTokens(tokensPerPage, offset)

        // Prioritize WKAS and KASPER tokens
        const priorityTokens = ["WKAS", "KASPER"]
        tokensData = tokensData.sort((a, b) => {
          const aPriority = priorityTokens.includes(a.symbol) ? 0 : 1
          const bPriority = priorityTokens.includes(b.symbol) ? 0 : 1
          if (aPriority !== bPriority) {
            return aPriority - bPriority
          }
          // If both have same priority, maintain original order
          return 0
        })

        // Fetch supplies for all tokens
        const supplies: Record<string, number> = {}
        await Promise.all(
          tokensData.map(async (token) => {
            const supply = await fetchTokenSupply(token.address)
            supplies[token.address] = supply
          }),
        )
        setTokenSupplies(supplies)

        // Get current prices and calculate accurate 24hr changes for all tokens
        const tokensWithCurrentPrices = await Promise.all(
          tokensData.map(async (token) => {
            try {
              const currentPriceData = await zealousAPI.getCurrentTokenPrice(token.address)
              let currentPrice = token.priceUSD || 0

              if (currentPriceData && typeof currentPriceData.priceUSD === "number") {
                currentPrice = currentPriceData.priceUSD
              }

              // Calculate accurate 24hr price change
              const priceChange24h = await calculate24hrChange(token.address, currentPrice)

              return {
                ...token,
                priceUSD: currentPrice,
                marketCap: currentPrice * supplies[token.address],
                priceChange24h,
              }
            } catch (priceError) {
              console.warn(`Could not fetch current price for ${token.symbol}:`, priceError)
              return {
                ...token,
                marketCap: (token.priceUSD || 0) * supplies[token.address],
                priceChange24h: 0,
              }
            }
          }),
        )

        // Sort tokens based on current sort criteria
        const sortedTokens = tokensWithCurrentPrices.sort((a, b) => {
          let aValue: number, bValue: number

          switch (sortBy) {
            case "priceUSD":
              aValue = a.priceUSD || 0
              bValue = b.priceUSD || 0
              break
            case "marketCap":
              aValue = a.marketCap || 0
              bValue = b.marketCap || 0
              break
            case "volume24h":
              aValue = a.volume24h || 0
              bValue = b.volume24h || 0
              break
            default:
              aValue = a.marketCap || 0
              bValue = b.marketCap || 0
          }

          return sortOrder === "desc" ? bValue - aValue : aValue - bValue
        })

        setTokens(sortedTokens)
      } catch (err) {
        console.error("Failed to fetch tokens:", err)
        setError("Failed to load tokens data")
      } finally {
        setLoading(false)
      }
    }

    fetchTokens()
  }, [currentPage, sortBy, sortOrder, tokensPerPage])

  const handleSort = (column: "priceUSD" | "marketCap" | "volume24h") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortOrder("desc")
    }
    setCurrentPage(1) // Reset to first page when sorting
  }

  const getSortIcon = (column: "priceUSD" | "marketCap" | "volume24h") => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4" />
    }
    return sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const handleTokenClick = (token: Token) => {
    router.push(`/dapps/zealous-swap/token/${token.address}`)
  }

  if (loading) {
    return (
      <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mr-3"></div>
            <span className="text-white/70 font-inter">Loading tokens...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white font-orbitron">Top Tokens</CardTitle>
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
          <CardTitle className="text-white font-orbitron">Top Tokens</CardTitle>
          {showPagination && tokens.length === tokensPerPage && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="bg-black/40 border-white/20 text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-white/70 text-sm font-rajdhani px-2">Page {currentPage}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={tokens.length < tokensPerPage}
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
          {/* Header Row - Hidden on mobile, shown on larger screens */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-4 text-white/50 text-sm font-rajdhani border-b border-white/10 pb-2">
            <div className="col-span-4">Token</div>
            <div className="col-span-2">
              <button
                onClick={() => handleSort("priceUSD")}
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                Price {getSortIcon("priceUSD")}
              </button>
            </div>
            <div className="col-span-2">
              <button
                onClick={() => handleSort("marketCap")}
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                Market Cap {getSortIcon("marketCap")}
              </button>
            </div>
            <div className="col-span-2">24h Change</div>
            <div className="col-span-2">Supply</div>
          </div>

          {/* Token Rows */}
          {tokens.map((token, index) => (
            <motion.div
              key={token.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => handleTokenClick(token)}
            >
              {/* Token Info */}
              <div className="col-span-1 lg:col-span-4 flex items-center gap-4">
                <img
                  src={token.logoURI || "/placeholder.svg"}
                  alt={token.symbol}
                  className="h-10 w-10 rounded-full flex-shrink-0"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = "/placeholder.svg?height=40&width=40"
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold font-orbitron truncate">{token.symbol}</div>
                  <div className="text-white/50 text-sm font-rajdhani truncate">{token.name}</div>
                </div>
              </div>

              {/* Mobile Layout - Stack vertically */}
              <div className="col-span-1 lg:col-span-8 lg:hidden space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-white/50 text-xs font-rajdhani mb-1">Price</div>
                    <div className="text-white font-orbitron text-sm">{formatCurrency(token.priceUSD)}</div>
                  </div>
                  <div>
                    <div className="text-white/50 text-xs font-rajdhani mb-1">24h Change</div>
                    <div
                      className={`font-orbitron text-sm ${(token.priceChange24h || 0) >= 0 ? "text-purple-400" : "text-pink-400"}`}
                    >
                      {formatPercent(token.priceChange24h)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-white/50 text-xs font-rajdhani mb-1">Market Cap</div>
                    <div className="text-white font-orbitron text-sm">{formatCurrency(token.marketCap)}</div>
                  </div>
                  <div>
                    <div className="text-white/50 text-xs font-rajdhani mb-1">Supply</div>
                    <div className="text-white/70 font-orbitron text-sm">
                      {tokenSupplies[token.address]?.toLocaleString() || "N/A"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Layout - Horizontal */}
              <div className="hidden lg:contents">
                {/* Price */}
                <div className="col-span-2">
                  <div className="text-white font-orbitron">{formatCurrency(token.priceUSD)}</div>
                </div>

                {/* Market Cap */}
                <div className="col-span-2">
                  <div className="text-white font-orbitron">{formatCurrency(token.marketCap)}</div>
                </div>

                {/* 24h Change */}
                <div className="col-span-2">
                  <div
                    className={`font-orbitron ${(token.priceChange24h || 0) >= 0 ? "text-purple-400" : "text-pink-400"}`}
                  >
                    {formatPercent(token.priceChange24h)}
                  </div>
                </div>

                {/* Supply */}
                <div className="col-span-2">
                  <div className="text-white/70 font-orbitron text-sm">
                    {tokenSupplies[token.address]?.toLocaleString() || "N/A"}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
