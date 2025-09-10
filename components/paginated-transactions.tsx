"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Activity, Copy, CheckCircle, ChevronLeft, ChevronRight, X, ArrowRight, Info } from "lucide-react"
import { KasplexAPI } from "@/lib/api"
import ClickableAddress from "./clickable-address"

interface PaginatedTransactionsProps {
  isOpen: boolean
  onClose: () => void
  network: "kasplex" | "igra"
  onTransactionClick: (txHash: string) => void
  onAddressClick: (address: string) => void
}

export default function PaginatedTransactions({
  isOpen,
  onClose,
  network,
  onTransactionClick,
  onAddressClick,
}: PaginatedTransactionsProps) {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const transactionsPerPage = 25
  const api = new KasplexAPI(network)

  useEffect(() => {
    if (isOpen) {
      fetchTransactions(1)
    }
  }, [isOpen, network])

  const fetchTransactions = async (page: number) => {
    setLoading(true)
    try {
      // Get fewer blocks but more efficiently
      const blocksToFetch = Math.min(15, Math.ceil(transactionsPerPage / 3)) // Reduced from 25
      const latestBlocks = await api.getLatestBlocks(blocksToFetch)
      const allTransactions = []

      for (const block of latestBlocks) {
        try {
          const fullBlock = await api.getBlock(block.number, true)
          if (fullBlock.transactions && Array.isArray(fullBlock.transactions)) {
            for (const tx of fullBlock.transactions) {
              if (typeof tx === "object" && tx.hash) {
                try {
                  const receipt = await api.getTransactionReceipt(tx.hash)
                  const txType = detectTransactionType(tx, receipt)

                  let toInfo = null
                  if (tx.to) {
                    try {
                      // Use the API's getContractInfo method if available
                      if (typeof api.getContractInfo === "function") {
                        toInfo = await api.getContractInfo(tx.to)
                      }
                    } catch (error) {
                      console.error("Failed to get contract info:", error)
                      toInfo = { isContract: false, isVerified: false }
                    }
                  }

                  allTransactions.push({
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to || "Contract Creation",
                    toInfo,
                    value: (Number.parseInt(tx.value || "0", 16) / 1e18).toFixed(4),
                    gasPrice: (Number.parseInt(tx.gasPrice || "0", 16) / 1e9).toFixed(2),
                    timestamp: Number.parseInt(fullBlock.timestamp, 16) * 1000,
                    status: receipt?.status === "0x1" ? "success" : "failed",
                    type: txType,
                    input: tx.input || "0x",
                  })

                  // Break early if we have enough for this page
                  if (allTransactions.length >= transactionsPerPage * page) {
                    break
                  }
                } catch (error) {
                  console.error("Failed to get transaction receipt:", error)
                }
              }
            }
          }
        } catch (error) {
          console.error("Failed to get full block:", error)
        }

        // Break early if we have enough transactions
        if (allTransactions.length >= transactionsPerPage * page) {
          break
        }
      }

      // Sort by timestamp and paginate
      allTransactions.sort((a, b) => b.timestamp - a.timestamp)
      const startIndex = (page - 1) * transactionsPerPage
      const paginatedTransactions = allTransactions.slice(startIndex, startIndex + transactionsPerPage)

      setTransactions(paginatedTransactions)
      setCurrentPage(page)
    } catch (error) {
      console.error("Failed to fetch transactions:", error)
      setTransactions([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const detectTransactionType = (tx: any, receipt: any): string => {
    if (!tx.to) return "Contract Creation"

    if (tx.input && tx.input !== "0x" && tx.input.length > 2) {
      const methodId = tx.input.slice(0, 10)
      const erc20Methods: Record<string, string> = {
        "0xa9059cbb": "Token Transfer",
        "0x23b872dd": "Token Transfer From",
        "0x095ea7b3": "Token Approval",
        "0x18160ddd": "Total Supply Call",
        "0x70a08231": "Balance Query",
        "0xdd62ed3e": "Allowance Query",
      }

      const defiMethods: Record<string, string> = {
        "0x7ff36ab5": "Swap ETH→Tokens",
        "0x18cbafe5": "Swap Tokens→ETH",
        "0x38ed1739": "Swap Tokens",
        "0xb6f9de95": "Swap ETH→Tokens",
        "0xe8e33700": "Add Liquidity",
        "0x02751cec": "Remove Liquidity",
        "0xa694fc3a": "Stake",
        "0x2e1a7d4d": "Withdraw",
      }

      if (erc20Methods[methodId]) return erc20Methods[methodId]
      if (defiMethods[methodId]) return defiMethods[methodId]
      return "Contract Call"
    }

    if (tx.value && tx.value !== "0x0") return "ETH Transfer"
    return "Transaction"
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedHash(text)
      setTimeout(() => setCopiedHash(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const formatHash = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-8)}`
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
      case "ETH Transfer":
        return "bg-green-500/20 text-green-300 border-green-500/30"
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
    }
  }

  const getShortMethodName = (type: string) => {
    const shortNames: Record<string, string> = {
      "Swap Exact ETH For Tokens": "Swap ETH→Tokens",
      "Swap Exact Tokens For ETH": "Swap Tokens→ETH",
      "Swap Exact Tokens For Tokens": "Swap Tokens",
      "Swap ETH For Exact Tokens": "Swap ETH→Tokens",
      "Token Transfer From": "Transfer From",
      "NFT Transfer From": "NFT Transfer",
    }
    return shortNames[type] || type
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-6xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="bg-black/40 border-white/20 backdrop-blur-xl h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white font-inter flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              All Transactions
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white/70 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-white/70 font-inter">Loading transactions...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {transactions.map((tx, index) => (
                    <motion.div
                      key={tx.hash}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.02 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => {
                        onTransactionClick(tx.hash)
                        onClose()
                      }}
                    >
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <div
                            className={`h-3 w-3 rounded-full ${
                              tx.status === "success" ? "bg-green-400" : "bg-red-400"
                            }`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-white font-mono text-sm">{formatHash(tx.hash)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-white/50 hover:text-white flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(tx.hash)
                              }}
                            >
                              {copiedHash === tx.hash ? (
                                <CheckCircle className="h-3 w-3 text-green-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/70 font-inter mb-1">
                            <ClickableAddress address={tx.from} onAddressClick={onAddressClick} />
                            <ArrowRight className="h-3 w-3 flex-shrink-0" />
                            {tx.to === "Contract Creation" ? (
                              <span className="text-purple-400">Contract Creation</span>
                            ) : (
                              <ClickableAddress
                                address={tx.to}
                                contractInfo={tx.toInfo}
                                onAddressClick={onAddressClick}
                              />
                            )}
                          </div>
                          <div className="text-xs text-white/50 font-inter">{formatTime(tx.timestamp)}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="text-sm text-white font-inter mb-2">{tx.value} KAS</div>
                        <div className="flex items-center gap-1 justify-end group relative">
                          <Badge className={`text-xs ${getTransactionTypeColor(tx.type)} border`}>
                            {getShortMethodName(tx.type)}
                          </Badge>
                          {tx.type !== getShortMethodName(tx.type) && (
                            <>
                              <Info className="h-3 w-3 text-white/30" />
                              <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
                                {tx.type}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchTransactions(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="text-white/70 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <span className="text-white/70 font-inter text-sm">Page {currentPage}</span>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchTransactions(currentPage + 1)}
                disabled={loading}
                className="text-white/70 hover:text-white"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
