"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, TrendingUp, TrendingDown, ExternalLink } from "lucide-react"
import { LFGAPI, type LFGToken } from "@/lib/lfg-api"
import { useRouter } from "next/navigation"

export default function LFGTokensList() {
  const [tokens, setTokens] = useState<LFGToken[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const router = useRouter()

  const lfgAPI = new LFGAPI()

  useEffect(() => {
    fetchTokens()
  }, [currentPage])

  const fetchTokens = async (reset = false) => {
    try {
      setLoading(true)
      const page = reset ? 1 : currentPage
      const response = await lfgAPI.getTokens(page)

      if (reset) {
        setTokens(response.result || [])
        setCurrentPage(1)
      } else {
        setTokens((prev) => [...prev, ...(response.result || [])])
      }

      setHasMore(response.hasMore || false)
    } catch (err) {
      console.error("Failed to fetch LFG tokens:", err)
      setError("Failed to load tokens")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchTokens(true)
      return
    }

    try {
      setLoading(true)
      const response = await lfgAPI.searchTokens(searchQuery, 1)
      setTokens(response.result || [])
      setHasMore(response.hasMore || false)
      setCurrentPage(1)
    } catch (err) {
      console.error("Failed to search tokens:", err)
      setError("Failed to search tokens")
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      setCurrentPage((prev) => prev + 1)
    }
  }

  const formatCurrency = (value: number) => {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(2)}B`
    }
    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M`
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K`
    }
    if (value >= 1) {
      return `${value.toFixed(2)}`
    }
    // For small numbers, find first non-zero digit and show 2 more digits after it
    const str = value.toString()
    const match = str.match(/[1-9]/)
    if (match) {
      const firstNonZeroIndex = match.index!
      const decimalIndex = str.indexOf(".")
      if (decimalIndex !== -1 && firstNonZeroIndex > decimalIndex) {
        const digitsAfterDecimal = firstNonZeroIndex - decimalIndex + 1
        return value.toFixed(digitsAfterDecimal)
      }
    }
    return value.toFixed(2)
  }

  const formatPrice = (value: number) => {
    if (value >= 1) {
      return `${value.toFixed(2)}`
    }
    // For small numbers, find first non-zero digit and show 2 more digits after it
    const str = value.toString()
    const match = str.match(/[1-9]/)
    if (match) {
      const firstNonZeroIndex = match.index!
      const decimalIndex = str.indexOf(".")
      if (decimalIndex !== -1 && firstNonZeroIndex > decimalIndex) {
        const digitsAfterDecimal = firstNonZeroIndex - decimalIndex + 1
        return value.toFixed(digitsAfterDecimal)
      }
    }
    return value.toFixed(2)
  }

  const handleTokenClick = (tokenAddress: string) => {
    router.push(`/dapps/lfg-kaspa/token/${tokenAddress}`)
  }

  if (error) {
    return (
      <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
        <CardContent className="p-8 text-center">
          <p className="text-red-400 font-rajdhani">{error}</p>
          <Button
            onClick={() => fetchTokens(true)}
            className="mt-4 bg-gradient-to-r from-green-500 to-blue-500 text-white font-rajdhani"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <CardTitle className="text-white font-orbitron">LFG Tokens</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 h-4 w-4" />
              <Input
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-black/40 border-white/20 text-white placeholder:text-white/50 font-rajdhani w-full sm:w-64"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="bg-gradient-to-r from-green-500 to-blue-500 text-white font-rajdhani"
            >
              Search
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && tokens.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-white/70 font-rajdhani">Loading tokens...</div>
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {tokens.map((token, index) => (
                <motion.div
                  key={token.tokenAddress}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex flex-col lg:flex-row lg:items-center justify-between p-4 bg-black/20 rounded-lg border border-white/10 hover:border-white/20 transition-all cursor-pointer gap-4"
                  onClick={() => handleTokenClick(token.tokenAddress)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <img
                      src={token.image || "/placeholder.svg?height=40&width=40"}
                      alt={token.name}
                      className="h-10 w-10 rounded-full flex-shrink-0"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = "/placeholder.svg?height=40&width=40"
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold font-orbitron">{token.ticker}</h3>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            token.state === "graduated"
                              ? "text-green-300 border-green-500/30"
                              : "text-yellow-300 border-yellow-500/30"
                          }`}
                        >
                          {token.state}
                        </Badge>
                      </div>
                      <p className="text-white/70 text-sm font-rajdhani truncate">{token.name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:flex lg:items-center gap-4 lg:gap-6">
                    <div className="text-left lg:text-right">
                      <div className="flex items-center justify-start lg:justify-end gap-1">
                        <img src="/kaspa-logo.png" alt="KAS" className="h-4 w-4" />
                        <div className="text-white font-semibold font-orbitron text-sm lg:text-base">
                          {formatPrice(token.price)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {token.priceChange["1d"] >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-400" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-400" />
                        )}
                        <span
                          className={`text-xs font-rajdhani ${
                            token.priceChange["1d"] >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {token.priceChange["1d"] >= 0 ? "+" : ""}
                          {token.priceChange["1d"].toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-left lg:text-right">
                      <div className="flex items-center justify-start lg:justify-end gap-1">
                        <img src="/kaspa-logo.png" alt="KAS" className="h-4 w-4" />
                        <div className="text-white font-semibold font-orbitron text-sm lg:text-base">
                          {formatCurrency(token.marketCap)}
                        </div>
                      </div>
                      <div className="text-white/50 text-xs font-rajdhani">Market Cap</div>
                    </div>

                    <div className="text-left lg:text-right">
                      <div className="flex items-center justify-start lg:justify-end gap-1">
                        <img src="/kaspa-logo.png" alt="KAS" className="h-4 w-4" />
                        <div className="text-white font-semibold font-orbitron text-sm lg:text-base">
                          {formatCurrency(token.volume["1d"])}
                        </div>
                      </div>
                      <div className="text-white/50 text-xs font-rajdhani">Volume 24h</div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/70 hover:text-white hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`https://lfg.kaspa.com/token/${token.tokenAddress}`, "_blank")
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {hasMore && (
              <div className="text-center mt-6">
                <Button
                  onClick={loadMore}
                  disabled={loading}
                  className="bg-gradient-to-r from-green-500 to-blue-500 text-white font-rajdhani"
                >
                  {loading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
