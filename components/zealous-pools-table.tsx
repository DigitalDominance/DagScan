"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { ZealousAPI, type Pool } from "@/lib/zealous-api"

interface ZealousPoolsTableProps {
  limit?: number
  showPagination?: boolean
}

interface TokenInfo {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

export default function ZealousPoolsTable({ limit = 10, showPagination = true }: ZealousPoolsTableProps) {
  const [pools, setPools] = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<"tvl" | "volume" | "apr">("tvl")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({})

  const zealousAPI = new ZealousAPI()
  const poolsPerPage = limit

  const fetchAllTokens = async (): Promise<TokenInfo[]> => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/zealous/tokens?limit=1000&skip=0`,
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
    return `https://testnet.zealousswap.com/images/${logoURI}`
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
    return `${value.toFixed(2)}%`
  }

  useEffect(() => {
    const fetchPools = async () => {
      try {
        setLoading(true)
        setError(null)

        const offset = (currentPage - 1) * poolsPerPage
        const poolsData = await zealousAPI.getLatestPools(poolsPerPage, offset, sortBy, sortOrder)

        // Fetch all tokens to get logo information
        const allTokens = await fetchAllTokens()

        // Create a map of token addresses to logo URLs
        const logoMap: Record<string, string> = {}
        allTokens.forEach((token) => {
          const address = token.address.toLowerCase()
          logoMap[address] = token.logoURI ? getTokenLogoUrl(token.logoURI) : "/placeholder.svg?height=40&width=40"
        })

        setTokenLogos(logoMap)

        // Process pools with fetched logos
        const processedPools = poolsData.map((pool) => ({
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

        setPools(processedPools)
      } catch (err) {
        console.error("Failed to fetch pools:", err)
        setError("Failed to load pools data")
      } finally {
        setLoading(false)
      }
    }

    fetchPools()
  }, [currentPage, sortBy, sortOrder, poolsPerPage])

  const handleSort = (column: "tvl" | "volume" | "apr") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortOrder("desc")
    }
    setCurrentPage(1) // Reset to first page when sorting
  }

  const getSortIcon = (column: "tvl" | "volume" | "apr") => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-4 w-4" />
    }
    return sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  if (loading) {
    return (
      <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mr-3"></div>
            <span className="text-white/70 font-inter">Loading pools...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white font-orbitron">Liquidity Pools</CardTitle>
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
          <CardTitle className="text-white font-orbitron">Top Liquidity Pools</CardTitle>
          {showPagination && pools.length === poolsPerPage && (
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
                disabled={pools.length < poolsPerPage}
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
          {/* Header Row */}
          <div className="hidden md:grid md:grid-cols-12 gap-4 text-white/50 text-sm font-rajdhani border-b border-white/10 pb-2">
            <div className="col-span-4">Pool</div>
            <div className="col-span-2">
              <button
                onClick={() => handleSort("tvl")}
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                TVL {getSortIcon("tvl")}
              </button>
            </div>
            <div className="col-span-2">
              <button
                onClick={() => handleSort("volume")}
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                24h Volume {getSortIcon("volume")}
              </button>
            </div>
            <div className="col-span-2">
              <button
                onClick={() => handleSort("apr")}
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                APR {getSortIcon("apr")}
              </button>
            </div>
            <div className="col-span-2">Status</div>
          </div>

          {/* Pool Rows */}
          {pools.map((pool, index) => (
            <motion.div
              key={pool.address}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            >
              {/* Pool Info */}
              <div className="col-span-1 md:col-span-4 flex items-center gap-4">
                <div className="flex -space-x-2">
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
                <div>
                  <div className="text-white font-semibold font-orbitron">
                    {pool.token0.symbol}/{pool.token1.symbol}
                  </div>
                  <div className="text-white/50 text-sm font-rajdhani">
                    {pool.token0.name} / {pool.token1.name}
                  </div>
                </div>
              </div>

              {/* TVL */}
              <div className="col-span-1 md:col-span-2">
                <div className="md:hidden text-white/50 text-xs font-rajdhani mb-1">TVL</div>
                <div className="text-white font-orbitron">{formatCurrency(pool.tvl)}</div>
              </div>

              {/* Volume */}
              <div className="col-span-1 md:col-span-2">
                <div className="md:hidden text-white/50 text-xs font-rajdhani mb-1">24h Volume</div>
                <div className="text-white font-orbitron">{formatCurrency(pool.volumeUSD)}</div>
              </div>

              {/* apr */}
              <div className="col-span-1 md:col-span-2">
                <div className="md:hidden text-white/50 text-xs font-rajdhani mb-1">APR</div>
                <div className="text-purple-400 font-orbitron">{formatPercent(pool.apr)}</div>
              </div>

              {/* Status */}
              <div className="col-span-1 md:col-span-2">
                <div className="md:hidden text-white/50 text-xs font-rajdhani mb-1">Status</div>
                <div className="flex flex-wrap gap-1">
                  {pool.hasActiveFarm && (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">Farm</Badge>
                  )}
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">Active</Badge>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
