"use client"

import { useState, useEffect, useCallback } from "react"
import axios from 'axios'
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CuboidIcon as Cube,
  Activity,
  TrendingUp,
  Clock,
  ArrowRight,
  Wifi,
  WifiOff,
  RefreshCw,
  BarChart3,
  Wallet,
} from "lucide-react"
import { KasplexAPI } from "@/lib/api"
import ClickableAddress from "./clickable-address"
import PaginatedBlocks from "./paginated-blocks"
import PaginatedTransactions from "./paginated-transactions"
import { useRouter } from "next/navigation"
import AnimatedCounter from "./animated-counter"
import { useNetwork } from "@/context/NetworkContext"

interface DashboardProps {
  network: "kasplex" | "igra"
  searchQuery?: string
  onSearchResult?: (result: any) => void
}

interface Block {
  number: number
  hash: string
  timestamp: number
  transactions: number
  gasUsed: string
  gasLimit: string
  miner: string
}

interface Transaction {
  hash: string
  from: string
  to: string
  toInfo?: any
  value: string
  gasPrice: string
  timestamp: number
  status: "success" | "failed"
  type: string
}

interface KasplexStats {
  average_block_time: number
  coin_price: string
  coin_price_change_percentage: number
  market_cap: string
  gas_prices: {
    slow: number
    average: number
    fast: number
  }
  transactions_today: string
  total_transactions: string
  total_blocks: string
  total_addresses: string
}

interface TransactionChartData {
  date: string
  transaction_count: number
}

export default function Dashboard({ network, searchQuery, onSearchResult }: DashboardProps) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const { currentNetwork } = useNetwork();
  const [stats, setStats] = useState({
    latestBlock: 0,
    totalTransactions: 0,
    avgBlockTime: 0,
    gasPrice: "0",
  })
  const [kasplexStats, setKasplexStats] = useState<KasplexStats | null>(null)
  const [transactionChartData, setTransactionChartData] = useState<TransactionChartData[]>([])
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<"24H" | "7D" | "30D" | "ALL">("24H")
  const [transactionLoading, setTransactionLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUsingMockData, setIsUsingMockData] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [showAllBlocks, setShowAllBlocks] = useState(false)
  const [showAllTransactions, setShowAllTransactions] = useState(false)

  const api = new KasplexAPI(network)
  const router = useRouter()

  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const isValidTxHash = (hash: string): boolean => {
    return /^0x[a-fA-F0-9]{64}$/.test(hash)
  }

  // Fetch Kasplex stats from the new API
  const fetchKasplexStats = useCallback(async () => {
    try {
      const [statsResponse, chartResponse, priceResponse, marketCapResponse] = await Promise.all([
        axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/stats`, { network }),
        axios.post(`${process.env.NEXT_PUBLIC_BACKEND_NETWORK_URL}/stats/charts/transactions`, { network }),
        axios.get("https://api.kaspa.org/info/price?stringOnly=false"), // Fetch coin price
        axios.get("https://api.kaspa.org/info/marketcap?stringOnly=false"), // Fetch coin marketcap
      ]);

      if (statsResponse.status === 200) {
        const statsData = statsResponse.data.stats;
        const coinPrice = priceResponse.data.price; // Extract coin price from the response
        const marketCap = marketCapResponse.data.marketcap;
        setKasplexStats({
          ...statsData,
          coin_price: coinPrice, // Add the fetched coin price to the stats
          market_cap: marketCap
        });
      }

      if (chartResponse.status === 200) {
        const chartData = chartResponse.data.transactions
        setTransactionChartData(chartData.chart_data || [])
      }
    } catch (error) {
      console.error("Failed to fetch Kasplex stats:", error)
      // Set fallback values
      setKasplexStats({
        average_block_time: 1747,
        coin_price: "0.1057",
        coin_price_change_percentage: 5.67,
        market_cap: "2787234502.64645427516",
        gas_prices: {
          slow: 1785.92,
          average: 1833.22,
          fast: 2163.5,
        },
        transactions_today: "348333",
        total_transactions: "10798008",
        total_blocks: "2057730",
        total_addresses: "259035",
      })
    }
  }, [network])

  const fetchData = useCallback(
    async (showError = true) => {
      try {
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Request timeout")), 30000), // 30 second timeout
        )

        const dataPromise = Promise.all([api.getNetworkStats(), api.getLatestBlocks(10), api.getLatestTransactions(15)])

        const [networkStats, latestBlocks, latestTransactions] = (await Promise.race([
          dataPromise,
          timeoutPromise,
        ])) as any

        setStats(networkStats)
        setBlocks(latestBlocks)
        setTransactions(latestTransactions)
        setError(null)
        setIsUsingMockData(api.isUsingMockData())
      } catch (err) {
        console.error("Failed to fetch blockchain data:", err)
        setIsUsingMockData(api.isUsingMockData())
        if (showError) {
          setError("Failed to connect to the network. Using demo data.")
        }
      }
    },
    [network],
  )

  // Calculate transactions for selected time period
  const getTransactionsForPeriod = useCallback(() => {
    if (selectedTimePeriod === "ALL") {
      return kasplexStats ? Number.parseInt(kasplexStats.total_transactions) : 0
    }

    if (!transactionChartData.length) return 0

    const now = new Date()
    let daysBack = 1

    switch (selectedTimePeriod) {
      case "7D":
        daysBack = 7
        break
      case "30D":
        daysBack = 30
        break
      default:
        return kasplexStats ? Number.parseInt(kasplexStats.transactions_today) : 0
    }

    const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    return transactionChartData
      .filter((item) => new Date(item.date) >= cutoffDate)
      .reduce((sum, item) => sum + item.transaction_count, 0)
  }, [transactionChartData, selectedTimePeriod, kasplexStats])

  // Handle time period change with smooth loading
  const handleTimePeriodChange = async (period: typeof selectedTimePeriod) => {
    if (period === selectedTimePeriod) return

    setTransactionLoading(true)
    setSelectedTimePeriod(period)

    // Add a small delay for smooth transition
    await new Promise((resolve) => setTimeout(resolve, 300))
    setTransactionLoading(false)
  }

  // Initial load
  useEffect(() => {
    const initialLoad = async () => {
      setInitialLoading(true)
      await Promise.all([fetchData(), fetchKasplexStats()])
      setInitialLoading(false)
    }
    initialLoad()
  }, [network, fetchData, fetchKasplexStats])

  // Background updates every 3 seconds for Kasplex stats
  useEffect(() => {
    const interval = setInterval(() => {
      fetchKasplexStats()
    }, 3000)

    return () => clearInterval(interval)
  }, [fetchKasplexStats])

  // Background updates every 3 seconds for blockchain data (latest block, avg block time)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(false) // Don't show errors on background updates
    }, 3000)

    return () => clearInterval(interval)
  }, [fetchData])

  // Handle search
  useEffect(() => {
    if (searchQuery && searchQuery.trim()) {
      handleSearch(searchQuery.trim())
    }
  }, [searchQuery])

  const handleReconnect = async () => {
    setIsReconnecting(true)
    try {
      await api.resetConnection()
      await fetchData()
    } catch (error) {
      console.error("Reconnection failed:", error)
    } finally {
      setIsReconnecting(false)
    }
  }

  const handleBlockClick = (blockNumber: number) => {
    router.push(`/block/${blockNumber}`)
  }

  const handleTransactionClick = (txHash: string) => {
    if (!isValidTxHash(txHash)) {
      console.error("Invalid transaction hash:", txHash)
      return
    }
    router.push(`/tx/${txHash}`)
  }

  const handleAddressClick = (address: string) => {
    if (!isValidAddress(address)) {
      console.error("Invalid address format:", address)
      return
    }
    router.push(`/address/${address}`)
  }

  const handleSearch = (query: string) => {
    router.push(`/search/${encodeURIComponent(query)}`)
  }

  const formatHash = (hash: string) => `${hash.slice(0, 8)}...${hash.slice(-6)}`
  const formatTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
    if (seconds < 0) {
      const futureSeconds = Math.abs(seconds);
      if (futureSeconds < 60) return `in ${futureSeconds}s`;
      if (futureSeconds < 3600) return `in ${Math.floor(futureSeconds / 60)}m`;
      return `in ${Math.floor(futureSeconds / 3600)}h`;
    }
  
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const formatPrice = (price: string) => {
    return `$${Number.parseFloat(price).toFixed(4)}`
  }

  const formatLargeNumber = (value: string | number) => {
    const num = typeof value === "string" ? Number.parseFloat(value) : value
    if (num >= 1e9) {
      return `$${(num / 1e9).toFixed(2)}B`
    } else if (num >= 1e6) {
      return `$${(num / 1e6).toFixed(2)}M`
    } else if (num >= 1e3) {
      return `$${(num / 1e3).toFixed(2)}K`
    }
    return `$${num.toFixed(2)}`
  }

  const formatPriceChange = (changePercentage: number) => {
    const isPositive = changePercentage >= 0
    const sign = isPositive ? "+" : ""
    const color = isPositive ? "text-green-400" : "text-red-400"
    return (
      <span className={`${color} text-[10px] sm:text-xs font-inter font-bold ml-1`}>
        {sign}
        {changePercentage.toFixed(2)}% <span className="opacity-70 font-normal">(24 Hours)</span>
      </span>
    )
  }

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case "Token Transfer":
      case "Token Transfer From":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30"
      case "Token Approval":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      case "Contract Creation":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30"
      case "Contract Call":
        return "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
      case "KAS Transfer":
        return "bg-green-500/20 text-green-300 border-green-500/30"
      case "NFT Transfer":
      case "NFT Transfer From":
        return "bg-pink-500/20 text-pink-300 border-pink-500/30"
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
    }
  }

  const getShortMethodName = (type: string) => {
    const shortNames: Record<string, string> = {
      "Swap KAS→Tokens": "Swap KAS→Tokens",
      "Swap Tokens→KAS": "Swap Tokens→KAS",
      "Swap Tokens": "Swap Tokens",
      "Token Transfer From": "Transfer From",
      "NFT Transfer From": "NFT Transfer",
      "KAS Transfer": "KAS Transfer",
    }
    return shortNames[type] || type
  }

  const timePeriods = [
    { key: "24H" as const, label: "24H" },
    { key: "7D" as const, label: "7D" },
    { key: "30D" as const, label: "30D" },
    { key: "ALL" as const, label: "All" },
  ]

  if (initialLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-white/70 font-rajdhani">Loading BlockDAG data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Network Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {isUsingMockData ? (
              <>
                <div className="h-3 w-3 rounded-full bg-yellow-400 animate-pulse"></div>
                <span className="text-white/70 font-rajdhani text-sm sm:text-base">
                  Demo Mode - {network === "kasplex" ? "Kasplex Testnet" : "Igra Network"} (RPC Unavailable)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="text-yellow-400 hover:text-yellow-300 font-rajdhani text-xs"
                >
                  {isReconnecting ? (
                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Wifi className="h-3 w-3 mr-1" />
                  )}
                  {isReconnecting ? "Reconnecting..." : "Try Reconnect"}
                </Button>
              </>
            ) : (
              <>
                <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-white/70 font-rajdhani text-sm sm:text-base">
                  Connected to {network === "kasplex" ? "Kasplex Testnet" : "Igra Network"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Demo Mode Warning */}
        {isUsingMockData && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6"
          >
            <div className="flex items-start gap-3">
              <WifiOff className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-yellow-300 font-rajdhani font-semibold">Demo Mode Active</h3>
                <p className="text-yellow-200/80 font-inter text-sm">
                  Unable to connect to the live network. Showing demo data for exploration purposes.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Kaspa Market Stats - Now at the top */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
            <CardHeader className="pb-3">
              {
              currentNetwork === 'kasplex' ? <CardTitle className="text-white flex items-center gap-2 font-rajdhani">
                <img src="/kaspa-logo.png" alt="Kaspa" className="h-5 w-5" />
                Kaspa Market Data
              </CardTitle> :
              <CardTitle className="text-white flex items-center gap-2 font-rajdhani">
                <img src="/igra_logo.png" alt="Kaspa" className="h-5 w-5" />
                Igra Market Data
              </CardTitle>              
              }
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main Market Cards - Mobile: 2 cards on first row, 1 full-width on second row */}
              <div className="space-y-3 sm:space-y-0">
                {/* First row: KAS Price and Market Cap */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-4 lg:gap-6">
                  {/* KAS Price Card */}
                  <Card className="bg-slate-900/50 backdrop-blur-sm shadow-lg border-2 border-green-500/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-2 sm:px-6 pt-2 sm:pt-6">
                      <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani truncate">
                        {/* {currentNetwork === 'kasplex' ? 'KAS Price' : 'Igra Price'} */}
                        iKAS Price
                      </CardTitle>
                      { currentNetwork === 'kasplex' ? <img src="/kaspa-logo.png" alt="Kaspa" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      :
                      <img src="/igra_logo.png" alt="Igra" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      }
                    </CardHeader>
                    <CardContent className="px-2 sm:px-6 pb-2 sm:pb-6">
                      <div className="flex flex-col">
                        <div className="text-sm sm:text-2xl font-bold text-white font-orbitron">
                          {kasplexStats ? formatPrice(kasplexStats.coin_price || '0.0000') : "$0.0000"}
                        </div>
                        {kasplexStats && (
                          <div className="flex items-center">
                            {formatPriceChange(kasplexStats.coin_price_change_percentage || 0)}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Market Cap Card */}
                  <Card className="bg-slate-900/50 backdrop-blur-sm shadow-lg border-2 border-purple-500/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-2 sm:px-6 pt-2 sm:pt-6">
                      <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani truncate">
                        Market Cap
                      </CardTitle>
                      <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400 flex-shrink-0" />
                    </CardHeader>
                    <CardContent className="px-2 sm:px-6 pb-2 sm:pb-6">
                      <div className="text-sm sm:text-2xl font-bold text-white font-orbitron">
                        {kasplexStats ? formatLargeNumber(kasplexStats.market_cap) : "$0.00B"}
                      </div>
                      <p className="text-[9px] sm:text-xs text-purple-300 mt-0.5 sm:mt-1 font-inter">
                        Total Market Value
                      </p>
                    </CardContent>
                  </Card>

                  {/* L2 Transactions Card - Hidden on mobile, shown on desktop */}
                  <Card className="hidden sm:block bg-slate-900/50 backdrop-blur-sm shadow-lg border-2 border-blue-500/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-2 sm:px-6 pt-2 sm:pt-6">
                      <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani truncate">
                        L2 Transactions
                      </CardTitle>
                      <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400 flex-shrink-0" />
                    </CardHeader>
                    <CardContent className="px-2 sm:px-6 pb-2 sm:pb-6">
                      <div className="text-sm sm:text-2xl font-bold text-white font-orbitron mb-1 sm:mb-3">
                        {transactionLoading ? (
                          <div className="animate-pulse text-xs sm:text-base">Loading...</div>
                        ) : (
                          <AnimatedCounter value={getTransactionsForPeriod()} />
                        )}
                      </div>

                      {/* Desktop: Button Grid */}
                      <div className="flex flex-wrap gap-1">
                        {timePeriods.map((period) => (
                          <Button
                            key={period.key}
                            variant={selectedTimePeriod === period.key ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleTimePeriodChange(period.key)}
                            disabled={transactionLoading}
                            className={`text-xs px-2 py-1 h-6 font-rajdhani ${
                              selectedTimePeriod === period.key
                                ? "bg-slate-900/80 border-2 border-transparent bg-clip-padding before:absolute before:inset-0 before:-z-10 before:rounded-md before:bg-gradient-to-br before:from-blue-500/40 before:via-purple-500/40 before:to-pink-500/40 before:p-[2px] text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] relative"
                                : "text-blue-300 hover:text-white hover:bg-blue-600/20"
                            }`}
                          >
                            {period.label}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Second row: L2 Transactions Card - Full width on mobile only */}
                <Card className="sm:hidden bg-slate-900/50 backdrop-blur-sm shadow-lg border-2 border-blue-500/30">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 px-2 pt-2">
                    <CardTitle className="text-xs font-medium text-white/70 font-rajdhani truncate">
                      L2 Transactions
                    </CardTitle>
                    <Activity className="h-3 w-3 text-blue-400 flex-shrink-0" />
                  </CardHeader>
                  <CardContent className="px-2 pb-2">
                    <div className="text-sm font-bold text-white font-orbitron mb-2">
                      {transactionLoading ? (
                        <div className="animate-pulse text-xs">Loading...</div>
                      ) : (
                        <AnimatedCounter value={getTransactionsForPeriod()} />
                      )}
                    </div>

                    {/* Mobile: Dropdown */}
                    <div>
                      <Select value={selectedTimePeriod} onValueChange={handleTimePeriodChange}>
                        <SelectTrigger className="w-full h-5 text-[10px] bg-slate-900/80 border-2 border-transparent bg-clip-padding before:absolute before:inset-0 before:-z-10 before:rounded-md before:bg-gradient-to-br before:from-blue-500/40 before:via-purple-500/40 before:to-pink-500/40 before:p-[2px] text-white font-medium shadow-[0_0_12px_rgba(59,130,246,0.3)] relative">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900/95 border-2 border-blue-500/30 backdrop-blur-sm shadow-2xl">
                          {timePeriods.map((period) => (
                            <SelectItem
                              key={period.key}
                              value={period.key}
                              className="text-xs text-white hover:bg-white/20 focus:bg-white/30 font-medium"
                            >
                              {period.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Network Stats - Now inside the market data container */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                <Card className="bg-slate-900/50 backdrop-blur-sm shadow-lg border-2 border-purple-500/30">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">
                      Latest Block
                    </CardTitle>
                    <Cube className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                      <AnimatedCounter value={stats.latestBlock} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 backdrop-blur-sm shadow-lg border-2 border-blue-500/30">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">
                      Total Addresses
                    </CardTitle>
                    <Wallet className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                      <AnimatedCounter value={kasplexStats ? Number.parseInt(kasplexStats.total_addresses) : 0} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 backdrop-blur-sm shadow-lg border-2 border-pink-500/30">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">
                      Avg Block Time
                    </CardTitle>
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-pink-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                      <AnimatedCounter value={stats.avgBlockTime} decimals={1} suffix="s" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 backdrop-blur-sm shadow-lg border-2 border-indigo-500/30">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">
                      Gas Price
                    </CardTitle>
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                      <AnimatedCounter
                        value={kasplexStats ? Math.round(kasplexStats.gas_prices.average) : 0}
                        suffix=" Gwei"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          {/* Latest Blocks */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 font-rajdhani">
                  <Cube className="h-5 w-5 text-purple-400" />
                  Latest Blocks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs sm:text-sm text-white/70 font-inter">Showing latest 8 blocks</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllBlocks(true)}
                    className="text-purple-400 hover:text-purple-300 font-rajdhani text-xs sm:text-sm"
                  >
                    View All
                  </Button>
                </div>

                {blocks.length === 0 ? (
                  <div className="text-center py-8 text-white/50 font-inter">No blocks available</div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {blocks.slice(0, 8).map((block, index) => (
                        <motion.div
                          key={block.hash}
                          initial={{ opacity: 0, y: -30 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            transition: {
                              duration: 0.5,
                              delay: index * 0.05,
                              ease: [0.25, 0.46, 0.45, 0.94],
                            },
                          }}
                          exit={{
                            opacity: 0,
                            y: 30,
                            transition: {
                              duration: 0.3,
                              ease: [0.55, 0.06, 0.68, 0.19],
                            },
                          }}
                          layout
                          transition={{
                            layout: {
                              duration: 0.5,
                              ease: [0.25, 0.46, 0.45, 0.94],
                            },
                          }}
                          className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                          onClick={() => handleBlockClick(block.number)}
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg border-2 border-purple-400/50 bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                              <Cube className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium font-orbitron text-sm sm:text-base truncate">
                                  #{block.number}
                                </span>
                              </div>
                              <div className="text-xs sm:text-sm text-white/70 font-inter">
                                {formatTime(block.timestamp)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <div className="text-xs sm:text-sm text-white font-rajdhani mb-1">
                              {block.transactions} txns
                            </div>
                            <div className="text-xs">
                              <ClickableAddress
                                address={block.miner}
                                onAddressClick={handleAddressClick}
                                className="text-xs"
                              />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Latest Transactions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 font-rajdhani">
                  <Activity className="h-5 w-5 text-blue-400" />
                  Latest Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs sm:text-sm text-white/70 font-inter">Showing latest 8 transactions</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllTransactions(true)}
                    className="text-blue-400 hover:text-blue-300 font-rajdhani text-xs sm:text-sm"
                  >
                    View All
                  </Button>
                </div>

                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-white/50 font-inter">No transactions available</div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {transactions.slice(0, 8).map((tx, index) => (
                        <motion.div
                          key={tx.hash}
                          initial={{ opacity: 0, y: -30 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            transition: {
                              duration: 0.5,
                              delay: index * 0.05,
                              ease: [0.25, 0.46, 0.45, 0.94],
                            },
                          }}
                          exit={{
                            opacity: 0,
                            y: 30,
                            transition: {
                              duration: 0.3,
                              ease: [0.55, 0.06, 0.68, 0.19],
                            },
                          }}
                          layout
                          transition={{
                            layout: {
                              duration: 0.5,
                              ease: [0.25, 0.46, 0.45, 0.94],
                            },
                          }}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer gap-2 sm:gap-4"
                          onClick={() => handleTransactionClick(tx.hash)}
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                              <div
                                className={`h-2 w-2 rounded-full ${
                                  tx.status === "success" ? "bg-green-400" : "bg-red-400"
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-white font-mono text-xs sm:text-sm truncate">
                                  {formatHash(tx.hash)}
                                </span>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-white/70 font-inter">
                                <div className="flex items-center gap-1 min-w-0">
                                  <ClickableAddress address={tx.from} onAddressClick={handleAddressClick} />
                                  <ArrowRight className="h-3 w-3 flex-shrink-0" />
                                  {tx.to === "Contract Creation" ? (
                                    <span className="text-purple-400 truncate">Contract Creation</span>
                                  ) : (
                                    <ClickableAddress
                                      address={tx.to}
                                      contractInfo={tx.toInfo}
                                      onAddressClick={handleAddressClick}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1 flex-shrink-0">
                            <div className="text-xs sm:text-sm text-white font-rajdhani">{tx.value} KAS</div>
                            <div className="flex items-center gap-1">
                              <Badge className={`text-xs ${getTransactionTypeColor(tx.type)} border`}>
                                {getShortMethodName(tx.type)}
                              </Badge>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <PaginatedBlocks
        isOpen={showAllBlocks}
        onClose={() => setShowAllBlocks(false)}
        network={network}
        onBlockClick={handleBlockClick}
        onAddressClick={handleAddressClick}
      />

      <PaginatedTransactions
        isOpen={showAllTransactions}
        onClose={() => setShowAllTransactions(false)}
        network={network}
        onTransactionClick={handleTransactionClick}
        onAddressClick={handleAddressClick}
      />
    </>
  )
}
