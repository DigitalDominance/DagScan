"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, TrendingUp, DollarSign, Activity, Zap, Shield, Database } from "lucide-react"
import BeamsBackground from "@/components/beams-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { ZealousAPI, type ProtocolStats } from "@/lib/zealous-api"
import { LFGAPI } from "@/lib/lfg-api"

interface DApp {
  id: string
  name: string
  description: string
  category: string
  tvl: string
  volume24h: string
  pools: string
  status: "live" | "beta" | "coming-soon"
  logo: string
  gradient: string
  features: string[]
}

const categories = ["All", "DEX", "Lending", "NFT", "Bridge", "Gaming", "DeFi"]

export default function DAppsPage() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [protocolStats, setProtocolStats] = useState<ProtocolStats | null>(null)
  const [lfgStats, setLfgStats] = useState<{ totalTVL: number; totalVolume24h: number; totalTokens: number } | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const zealousAPI = new ZealousAPI()
  const lfgAPI = new LFGAPI()

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [zealousStats, lfgCombinedStats] = await Promise.all([
          zealousAPI.getProtocolStats(),
          lfgAPI.getCombinedStats(),
        ])
        setProtocolStats(zealousStats)
        setLfgStats(lfgCombinedStats)
      } catch (error) {
        console.error("Failed to fetch protocol stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const handleSearch = (query: string) => {
    router.push(`/search/${encodeURIComponent(query)}`)
  }

  const handleDAppClick = (dappId: string) => {
    router.push(`/dapps/${dappId}`)
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
    return `$${value.toFixed(2)}`
  }

  const dapps: DApp[] = [
    {
      id: "zealous-swap",
      name: "Zealous Swap",
      description:
        "The premier decentralized exchange on Kaspa EVM with advanced trading features and deep liquidity pools.",
      category: "DEX",
      tvl: protocolStats ? formatCurrency(protocolStats.totalTVL) : "$0",
      volume24h: protocolStats ? formatCurrency(protocolStats.totalVolumeUSD) : "$0",
      pools: protocolStats ? protocolStats.poolCount.toString() : "0",
      status: "live",
      logo: "/zealous-logo.png",
      gradient: "from-blue-500 via-purple-500 to-pink-500",
      features: ["Automated Market Making", "Yield Farming", "Liquidity Mining", "Advanced Charts"],
    },
    {
      id: "lfg-kaspa",
      name: "LFG.kaspa",
      description:
        "Fully decentralized meme token launchpad and DEX with anti-bot protection and fair launch mechanisms.",
      category: "DEX",
      tvl: lfgStats ? formatCurrency(lfgStats.totalTVL) : "$0",
      volume24h: lfgStats ? formatCurrency(lfgStats.totalVolume24h) : "$0",
      pools: lfgStats ? lfgStats.totalTokens.toString() : "0",
      status: "live",
      logo: "/lfg-logo.png",
      gradient: "from-green-500 via-teal-500 to-blue-500",
      features: ["Launchpad", "DEX", "Anti-Bot Protection", "Fair Launch"],
    },
  ]

  const filteredDApps = selectedCategory === "All" ? dapps : dapps.filter((dapp) => dapp.category === selectedCategory)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live":
        return "bg-green-500/20 text-green-300 border-green-500/30"
      case "beta":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      case "coming-soon":
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "live":
        return <Activity className="h-3 w-3" />
      case "beta":
        return <Zap className="h-3 w-3" />
      case "coming-soon":
        return <Shield className="h-3 w-3" />
      default:
        return <Activity className="h-3 w-3" />
    }
  }

  const combinedTVL = (protocolStats?.totalTVL || 0) + (lfgStats?.totalTVL || 0)
  const combinedVolume = (protocolStats?.totalVolumeUSD || 0) + (lfgStats?.totalVolume24h || 0)
  const combinedPools = (protocolStats?.poolCount || 0) + (lfgStats?.totalTokens || 0)

  return (
    <BeamsBackground>
      <div className="min-h-screen flex flex-col font-inter">
        <Navigation currentNetwork="kasplex" onNetworkChange={() => {}} onSearch={handleSearch} />

        <main className="flex-1 mx-auto max-w-7xl px-4 py-8">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 font-orbitron">
              Kaspa EVM
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                {" "}
                DApps
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-3xl mx-auto font-rajdhani">
              Discover the growing ecosystem of decentralized applications built on Kaspa EVM. From DeFi protocols to
              NFT marketplaces, explore the future of finance.
            </p>
          </motion.div>

          {/* Stats Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-white font-orbitron">2</div>
                <div className="text-sm text-white/70 font-rajdhani">Total DApps</div>
              </CardContent>
            </Card>
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-white font-orbitron">
                  {loading ? "..." : formatCurrency(combinedTVL)}
                </div>
                <div className="text-sm text-white/70 font-rajdhani">Total TVL</div>
              </CardContent>
            </Card>
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-white font-orbitron">
                  {loading ? "..." : formatCurrency(combinedVolume)}
                </div>
                <div className="text-sm text-white/70 font-rajdhani">Total Volume</div>
              </CardContent>
            </Card>
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-white font-orbitron">{loading ? "..." : combinedPools}</div>
                <div className="text-sm text-white/70 font-rajdhani">Active Pools</div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Category Filter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-2 mb-8 justify-center"
          >
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "ghost"}
                onClick={() => setSelectedCategory(category)}
                className={`font-rajdhani ${
                  selectedCategory === category
                    ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {category}
              </Button>
            ))}
          </motion.div>

          {/* DApps Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredDApps.map((dapp, index) => (
              <motion.div
                key={dapp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                whileHover={{ y: -5 }}
                className="group cursor-pointer"
                onClick={() => handleDAppClick(dapp.id)}
              >
                <Card className="bg-black/40 border-white/20 backdrop-blur-xl hover:border-white/40 transition-all duration-300 h-full">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${dapp.gradient} p-0.5`}>
                          <div className="h-full w-full rounded-xl bg-black/50 flex items-center justify-center">
                            <img src={dapp.logo || "/placeholder.svg"} alt={dapp.name} className="h-8 w-8 rounded-lg" />
                          </div>
                        </div>
                        <div>
                          <CardTitle className="text-white font-orbitron text-lg">{dapp.name}</CardTitle>
                          <Badge variant="secondary" className="text-xs mt-1">
                            {dapp.category}
                          </Badge>
                        </div>
                      </div>
                      <Badge className={`${getStatusColor(dapp.status)} border text-xs`}>
                        {getStatusIcon(dapp.status)}
                        <span className="ml-1 capitalize">{dapp.status.replace("-", " ")}</span>
                      </Badge>
                    </div>
                    <p className="text-white/70 text-sm font-rajdhani leading-relaxed">{dapp.description}</p>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <DollarSign className="h-4 w-4 text-green-400 mr-1" />
                        </div>
                        <div className="text-sm font-bold text-white font-orbitron">{dapp.tvl}</div>
                        <div className="text-xs text-white/50 font-rajdhani">TVL</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <TrendingUp className="h-4 w-4 text-blue-400 mr-1" />
                        </div>
                        <div className="text-sm font-bold text-white font-orbitron">{dapp.volume24h}</div>
                        <div className="text-xs text-white/50 font-rajdhani">Volume</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Database className="h-4 w-4 text-purple-400 mr-1" />
                        </div>
                        <div className="text-sm font-bold text-white font-orbitron">{dapp.pools}</div>
                        <div className="text-xs text-white/50 font-rajdhani">
                          {dapp.id === "lfg-kaspa" ? "Tokens" : "Pools"}
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="mb-4">
                      <div className="text-xs text-white/50 font-rajdhani mb-2">Key Features:</div>
                      <div className="flex flex-wrap gap-1">
                        {dapp.features.slice(0, 3).map((feature, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs text-white/60 border-white/20">
                            {feature}
                          </Badge>
                        ))}
                        {dapp.features.length > 3 && (
                          <Badge variant="outline" className="text-xs text-white/60 border-white/20">
                            +{dapp.features.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button
                      className={`w-full bg-gradient-to-r ${dapp.gradient} text-white font-rajdhani font-semibold group-hover:shadow-lg transition-all duration-300`}
                      disabled={dapp.status === "coming-soon"}
                    >
                      {dapp.status === "coming-soon" ? "Coming Soon" : "Explore DApp"}
                      {dapp.status !== "coming-soon" && (
                        <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </main>

        <Footer />
      </div>
    </BeamsBackground>
  )
}
