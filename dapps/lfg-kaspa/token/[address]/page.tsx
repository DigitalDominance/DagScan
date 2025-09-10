"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react"
import BeamsBackground from "@/components/beams-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import TokenPriceChart from "@/components/token-price-chart"
import { LFGAPI, type LFGToken } from "@/lib/lfg-api"
import { useNetwork } from "@/context/NetworkContext"

export default function LFGTokenPage() {
  const params = useParams()
  const router = useRouter()
  const { currentNetwork, handleNetworkChange } = useNetwork();
  const [token, setToken] = useState<LFGToken | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tokenAddress = params.address as string
  const lfgAPI = new LFGAPI()

  useEffect(() => {
    const fetchTokenData = async () => {
      if (!tokenAddress) return

      try {
        setLoading(true)
        // Search for the specific token
        const response = await lfgAPI.searchTokens(tokenAddress, 1)
        const foundToken = response.result?.find((t) => t.tokenAddress.toLowerCase() === tokenAddress.toLowerCase())

        if (foundToken) {
          setToken(foundToken)
        } else {
          setError("Token not found")
        }
      } catch (err) {
        console.error("Failed to fetch token data:", err)
        setError("Failed to load token data")
      } finally {
        setLoading(false)
      }
    }

    fetchTokenData()
  }, [tokenAddress, currentNetwork])

  const handleSearch = (query: string) => {
    router.push(`/search/${encodeURIComponent(query)}`)
  }

  const formatCurrency = (value: number) => {
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

  const formatPrice = (value: number) => {
    if (value >= 1) {
      return `$${value.toFixed(4)}`
    }
    if (value >= 0.01) {
      return `$${value.toFixed(6)}`
    }
    if (value >= 0.0001) {
      return `$${value.toFixed(8)}`
    }
    return `$${value.toFixed(10)}`
  }

  if (loading) {
    return (
      <BeamsBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork={currentNetwork} onNetworkChange={handleNetworkChange} onSearch={handleSearch} />
          <main className="flex-1 mx-auto max-w-7xl px-4 py-8">
            <div className="text-center py-20">
              <div className="text-white/70 font-rajdhani text-xl">Loading token data...</div>
            </div>
          </main>
          <Footer />
        </div>
      </BeamsBackground>
    )
  }

  if (error || !token) {
    return (
      <BeamsBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork={currentNetwork} onNetworkChange={handleNetworkChange} onSearch={handleSearch} />
          <main className="flex-1 mx-auto max-w-7xl px-4 py-8">
            <div className="text-center py-20">
              <div className="text-red-400 font-rajdhani text-xl">{error || "Token not found"}</div>
              <Button
                onClick={() => router.push("/dapps/lfg-kaspa")}
                className="mt-4 bg-gradient-to-r from-green-500 to-blue-500 text-white font-rajdhani"
              >
                Back to LFG
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
      <div className="min-h-screen flex flex-col font-inter">
        <Navigation currentNetwork={currentNetwork} onNetworkChange={handleNetworkChange} onSearch={handleSearch} />
        <main className="flex-1 mx-auto max-w-7xl px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push("/dapps/lfg-kaspa")}
              className="relative text-white hover:bg-black/60 active:bg-black/80 mb-4 overflow-hidden before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-br before:from-green-500 before:via-teal-500 before:to-blue-500 after:absolute after:inset-[1px] after:bg-black/40 after:backdrop-blur-xl after:rounded-[calc(0.375rem-1px)] hover:after:bg-black/60 active:after:bg-black/80"
            >
              <span className="relative z-10 flex items-center">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to LFG
              </span>
            </Button>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <img
                  src={token.image || "/placeholder.svg?height=64&width=64"}
                  alt={token.name}
                  className="h-12 w-12 sm:h-16 sm:w-16 rounded-xl flex-shrink-0"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = "/placeholder.svg?height=64&width=64"
                  }}
                />
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white font-orbitron">
                    {token.ticker}
                  </h1>
                  <p className="text-white/70 font-rajdhani text-base sm:text-lg truncate">{token.name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge
                      className={`text-xs ${
                        token.state === "graduated"
                          ? "bg-green-500/20 text-green-300 border-green-500/30"
                          : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                      }`}
                    >
                      {token.state}
                    </Badge>
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">LFG Token</Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  className="relative text-white font-rajdhani hover:bg-black/60 active:bg-black/80 overflow-hidden before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-br before:from-green-500 before:to-blue-500 after:absolute after:inset-[1px] after:bg-black/40 after:backdrop-blur-xl after:rounded-[calc(0.375rem-1px)] hover:after:bg-black/60 active:after:bg-black/80"
                  onClick={() => window.open(`https://lfg.kaspa.com/token/${token.tokenAddress}`, "_blank")}
                >
                  <span className="relative z-10 flex items-center">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Trade on LFG
                  </span>
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Token Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-8"
          >
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs lg:text-sm font-medium text-white/70 font-rajdhani">Price</CardTitle>
                <DollarSign className="h-3 w-3 lg:h-4 lg:w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-sm lg:text-2xl font-bold text-white font-orbitron">{formatPrice(token.price)}</div>
                <div className="flex items-center gap-1 mt-1">
                  {token.priceChange["1d"] >= 0 ? (
                    <TrendingUp className="h-2 w-2 lg:h-3 lg:w-3 text-green-400" />
                  ) : (
                    <TrendingDown className="h-2 w-2 lg:h-3 lg:w-3 text-red-400" />
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
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs lg:text-sm font-medium text-white/70 font-rajdhani">Market Cap</CardTitle>
                <TrendingUp className="h-3 w-3 lg:h-4 lg:w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-sm lg:text-2xl font-bold text-white font-orbitron">
                  {formatCurrency(token.marketCap)}
                </div>
                <p className="text-xs text-blue-300 mt-1 font-inter">Total market value</p>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs lg:text-sm font-medium text-white/70 font-rajdhani">Volume 24h</CardTitle>
                <Activity className="h-3 w-3 lg:h-4 lg:w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-sm lg:text-2xl font-bold text-white font-orbitron">
                  {formatCurrency(token.volume["1d"])}
                </div>
                <p className="text-xs text-purple-300 mt-1 font-inter">24h trading volume</p>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs lg:text-sm font-medium text-white/70 font-rajdhani">Progress</CardTitle>
                <Activity className="h-3 w-3 lg:h-4 lg:w-4 text-orange-400" />
              </CardHeader>
              <CardContent>
                <div className="text-sm lg:text-2xl font-bold text-white font-orbitron">{token.progress}%</div>
                <p className="text-xs text-orange-300 mt-1 font-inter">Bonding curve progress</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Price Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <TokenPriceChart tokenAddress={token.tokenAddress} tokenSymbol={token.ticker} apiType="lfg" />
          </motion.div>

          {/* Token Details */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white font-orbitron">Token Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-white font-semibold font-rajdhani mb-2">Description</h3>
                  <p className="text-white/70 font-inter">{token.description}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-white/70 font-rajdhani text-sm">Contract Address</h4>
                    <p className="text-white font-mono text-sm break-all">{token.tokenAddress}</p>
                  </div>
                  <div>
                    <h4 className="text-white/70 font-rajdhani text-sm">Total Supply</h4>
                    <p className="text-white font-orbitron text-xs sm:text-sm lg:text-base">
                      {token.totalSupply.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-white/70 font-rajdhani text-sm">Decimals</h4>
                    <p className="text-white font-orbitron">{token.decimals}</p>
                  </div>
                  <div>
                    <h4 className="text-white/70 font-rajdhani text-sm">Created</h4>
                    <p className="text-white font-rajdhani">{new Date(token.createdAt).toLocaleDateString()}</p>
                  </div>
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
