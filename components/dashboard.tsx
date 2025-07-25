"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CuboidIcon as Cube, Activity, TrendingUp, Clock, ArrowRight, Wifi, WifiOff, RefreshCw } from "lucide-react"
import { KasplexAPI } from "@/lib/api"
import ClickableAddress from "./clickable-address"
import PaginatedBlocks from "./paginated-blocks"
import PaginatedTransactions from "./paginated-transactions"
import { useRouter } from "next/navigation"
import AnimatedCounter from "./animated-counter"

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

export default function Dashboard({ network, searchQuery, onSearchResult }: DashboardProps) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState({
    latestBlock: 0,
    totalTransactions: 0,
    avgBlockTime: 0,
    gasPrice: "0",
  })
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

  // Initial load
  useEffect(() => {
    const initialLoad = async () => {
      setInitialLoading(true)
      await fetchData()
      setInitialLoading(false)
    }
    initialLoad()
  }, [network, fetchData])

  // Background updates every 5 seconds (less frequent to avoid overwhelming failed endpoints)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(false) // Don't show errors on background updates
    }, 5000)

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
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
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
          <div className="text-xs sm:text-sm text-white/50 font-inter">
            Last updated: {new Date().toLocaleTimeString()}
            {isUsingMockData && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Demo Data
              </Badge>
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

        {/* Network Stats - Using inline styles to force backgrounds */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6"
        >
          <Card
            className="backdrop-blur-sm shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, rgba(147, 51, 234, 0.4) 0%, rgba(126, 34, 206, 0.3) 50%, rgba(109, 40, 217, 0.2) 100%)",
              borderColor: "rgba(147, 51, 234, 0.3)",
              boxShadow: "0 10px 25px -5px rgba(147, 51, 234, 0.2)",
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">Latest Block</CardTitle>
              <Cube className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-base sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                <AnimatedCounter value={stats.latestBlock} />
              </div>
            </CardContent>
          </Card>

          <Card
            className="backdrop-blur-sm shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(37, 99, 235, 0.3) 50%, rgba(29, 78, 216, 0.2) 100%)",
              borderColor: "rgba(59, 130, 246, 0.3)",
              boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.2)",
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">
                Recent Transactions
              </CardTitle>
              <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-base sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                <AnimatedCounter value={transactions.length} />
              </div>
            </CardContent>
          </Card>

          <Card
            className="backdrop-blur-sm shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, rgba(236, 72, 153, 0.4) 0%, rgba(219, 39, 119, 0.3) 50%, rgba(190, 24, 93, 0.2) 100%)",
              borderColor: "rgba(236, 72, 153, 0.3)",
              boxShadow: "0 10px 25px -5px rgba(236, 72, 153, 0.2)",
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">
                Avg Block Time
              </CardTitle>
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-pink-400" />
            </CardHeader>
            <CardContent>
              <div className="text-base sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                <AnimatedCounter value={stats.avgBlockTime} decimals={1} suffix="s" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="backdrop-blur-sm shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, rgba(99, 102, 241, 0.4) 0%, rgba(79, 70, 229, 0.3) 50%, rgba(67, 56, 202, 0.2) 100%)",
              borderColor: "rgba(99, 102, 241, 0.3)",
              boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.2)",
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-white/70 font-rajdhani">Gas Price</CardTitle>
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-base sm:text-lg lg:text-2xl font-bold text-white font-orbitron">
                <AnimatedCounter value={Number.parseFloat(stats.gasPrice)} decimals={2} suffix=" Gwei" />
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
