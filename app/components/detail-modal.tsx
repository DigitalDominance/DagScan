"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { X, Copy, CheckCircle, ExternalLink, CuboidIcon as Cube, Activity, Shield, Code, Zap } from "lucide-react"
import ClickableAddress from "./clickable-address"
import type { ContractInfo } from "@/lib/api"

interface BlockDetails {
  type: "block"
  number: number
  hash: string
  timestamp: number
  transactions: any[]
  gasUsed: string
  gasLimit: string
  miner: string
  parentHash: string
  difficulty: string
  size: string
}

interface TransactionDetails {
  type: "transaction"
  hash: string
  from: string
  fromInfo?: ContractInfo | null
  to: string
  toInfo?: ContractInfo | null
  value: string
  gasPrice: string
  gasUsed: string
  gasLimit: string
  timestamp: number
  status: "success" | "failed"
  blockNumber: number
  blockHash: string
  transactionIndex: number
  nonce: string
  input: string
  txType: string
}

interface AddressDetails {
  type: "address"
  address: string
  balance: string
  transactionCount: number
  transactions: any[]
  contractInfo?: ContractInfo
}

type DetailData = BlockDetails | TransactionDetails | AddressDetails

interface DetailModalProps {
  isOpen: boolean
  onClose: () => void
  data: DetailData | null
  onAddressClick?: (address: string) => void
  onTransactionClick?: (txHash: string) => void
}

export default function DetailModal({ isOpen, onClose, data, onAddressClick, onTransactionClick }: DetailModalProps) {
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [loadingTransactions, setLoadingTransactions] = useState(false)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
      setTimeout(() => setCopiedText(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const formatHash = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-8)}`
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString()
  const formatValue = (value: string) => `${Number.parseFloat(value).toFixed(6)} KAS`

  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const isValidTxHash = (hash: string): boolean => {
    return /^0x[a-fA-F0-9]{64}$/.test(hash)
  }

  const handleTransactionClick = (txHash: string) => {
    if (onTransactionClick && isValidTxHash(txHash)) {
      onTransactionClick(txHash)
    }
  }

  const handleAddressClick = (address: string) => {
    if (onAddressClick && isValidAddress(address)) {
      onAddressClick(address)
    }
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
      case "ETH Transfer":
        return "bg-green-500/20 text-green-300 border-green-500/30"
      case "NFT Transfer":
      case "NFT Transfer From":
        return "bg-pink-500/20 text-pink-300 border-pink-500/30"
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30"
    }
  }

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case "Token Transfer":
      case "Token Transfer From":
        return <Zap className="h-3 w-3" />
      case "Contract Creation":
        return <Code className="h-3 w-3" />
      case "Contract Call":
        return <Activity className="h-3 w-3" />
      default:
        return <ExternalLink className="h-3 w-3" />
    }
  }

  if (!data) return null

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white font-inter flex items-center gap-2">
                  {data.type === "block" && <Cube className="h-5 w-5 text-purple-400" />}
                  {data.type === "transaction" && <Activity className="h-5 w-5 text-blue-400" />}
                  {data.type === "address" && (
                    <>
                      {data.contractInfo?.isContract ? (
                        <Code className="h-5 w-5 text-blue-400" />
                      ) : (
                        <ExternalLink className="h-5 w-5 text-green-400" />
                      )}
                    </>
                  )}
                  {data.type === "block" && `Block #${data.number}`}
                  {data.type === "transaction" && "Transaction Details"}
                  {data.type === "address" && (data.contractInfo?.isContract ? "Contract Details" : "Address Details")}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={onClose} className="text-white/70 hover:text-white">
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>

              <CardContent className="space-y-6">
                {data.type === "transaction" && (
                  <div className="space-y-4">
                    {/* Transaction Type Badge */}
                    <div className="flex items-center gap-2">
                      <Badge className={`${getTransactionTypeColor(data.txType)} border`}>
                        {getTransactionTypeIcon(data.txType)}
                        <span className="ml-1">{data.txType}</span>
                      </Badge>
                      <Badge variant={data.status === "success" ? "default" : "destructive"}>{data.status}</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-white/70 font-inter">Transaction Hash</label>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded">
                              {formatHash(data.hash)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-white/50 hover:text-white"
                              onClick={() => copyToClipboard(data.hash)}
                            >
                              {copiedText === data.hash ? (
                                <CheckCircle className="h-3 w-3 text-green-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm text-white/70 font-inter">Block</label>
                          <div className="text-white font-inter mt-1">#{data.blockNumber}</div>
                        </div>

                        <div>
                          <label className="text-sm text-white/70 font-inter">From</label>
                          <div className="mt-1">
                            <ClickableAddress
                              address={data.from}
                              contractInfo={data.fromInfo}
                              onAddressClick={handleAddressClick}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-sm text-white/70 font-inter">Value</label>
                          <div className="text-white font-inter mt-1">{formatValue(data.value)}</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-white/70 font-inter">To</label>
                          <div className="mt-1">
                            {data.to === "Contract Creation" ? (
                              <span className="text-purple-400 font-inter">Contract Creation</span>
                            ) : (
                              <ClickableAddress
                                address={data.to}
                                contractInfo={data.toInfo}
                                onAddressClick={handleAddressClick}
                              />
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-sm text-white/70 font-inter">Gas Price</label>
                          <div className="text-white font-inter mt-1">{data.gasPrice} Gwei</div>
                        </div>

                        <div>
                          <label className="text-sm text-white/70 font-inter">Gas Used</label>
                          <div className="text-white font-inter mt-1">
                            {Number.parseInt(data.gasUsed || "0").toLocaleString()}
                          </div>
                        </div>

                        <div>
                          <label className="text-sm text-white/70 font-inter">Timestamp</label>
                          <div className="text-white font-inter mt-1">{formatTime(data.timestamp)}</div>
                        </div>
                      </div>
                    </div>

                    {data.input && data.input !== "0x" && (
                      <div>
                        <label className="text-sm text-white/70 font-inter">Input Data</label>
                        <div className="mt-1 p-3 bg-white/5 rounded-lg max-h-32 overflow-y-auto">
                          <code className="text-white/80 font-mono text-xs break-all">{data.input}</code>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {data.type === "address" && (
                  <div className="space-y-4">
                    {/* Contract Info */}
                    {data.contractInfo?.isContract && (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Code className="h-4 w-4 text-blue-400" />
                          <span className="text-blue-300 font-inter font-semibold">Contract Information</span>
                          {data.contractInfo.isVerified && (
                            <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                              <Shield className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>

                        {data.contractInfo.name && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                            <div>
                              <label className="text-sm text-white/70 font-inter">Contract Name</label>
                              <div className="text-white font-inter mt-1">{data.contractInfo.name}</div>
                            </div>
                            {data.contractInfo.symbol && (
                              <div>
                                <label className="text-sm text-white/70 font-inter">Symbol</label>
                                <div className="text-white font-inter mt-1">{data.contractInfo.symbol}</div>
                              </div>
                            )}
                            {data.contractInfo.contractType && (
                              <div>
                                <label className="text-sm text-white/70 font-inter">Type</label>
                                <div className="text-white font-inter mt-1">{data.contractInfo.contractType}</div>
                              </div>
                            )}
                            {data.contractInfo.decimals && (
                              <div>
                                <label className="text-sm text-white/70 font-inter">Decimals</label>
                                <div className="text-white font-inter mt-1">{data.contractInfo.decimals}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-sm text-white/70 font-inter">Address</label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded">
                          {data.address}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-white/50 hover:text-white"
                          onClick={() => copyToClipboard(data.address)}
                        >
                          {copiedText === data.address ? (
                            <CheckCircle className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm text-white/70 font-inter">Balance</label>
                        <div className="text-white font-inter mt-1">{formatValue(data.balance)}</div>
                      </div>
                      <div>
                        <label className="text-sm text-white/70 font-inter">Transaction Count</label>
                        <div className="text-white font-inter mt-1">{data.transactionCount}</div>
                      </div>
                      <div>
                        <label className="text-sm text-white/70 font-inter">Address Type</label>
                        <div className="text-white font-inter mt-1">
                          {data.contractInfo?.isContract ? "Contract" : "Externally Owned Account"}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-inter font-semibold">All Transactions</h3>
                        {loadingTransactions && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                        )}
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {data.transactions.length === 0 ? (
                          <div className="text-center py-8 text-white/50 font-inter">No transactions found</div>
                        ) : (
                          data.transactions.map((tx: any, index: number) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-white/5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                              onClick={() => handleTransactionClick(tx.hash)}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`h-2 w-2 rounded-full ${tx.status === "success" ? "bg-green-400" : "bg-red-400"}`}
                                />
                                <div>
                                  <code className="text-white/80 font-mono text-sm">{formatHash(tx.hash)}</code>
                                  {tx.type && (
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge className={`text-xs ${getTransactionTypeColor(tx.type)}`}>{tx.type}</Badge>
                                      <span className="text-xs text-white/50">
                                        {tx.from === data.address ? "OUT" : "IN"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-white text-sm">{formatValue(tx.value)}</div>
                                <div className="text-xs text-white/50">{formatTime(tx.timestamp)}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {data.type === "block" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-white/70 font-inter">Block Hash</label>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded">
                              {formatHash(data.hash)}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-white/50 hover:text-white"
                              onClick={() => copyToClipboard(data.hash)}
                            >
                              {copiedText === data.hash ? (
                                <CheckCircle className="h-3 w-3 text-green-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm text-white/70 font-inter">Timestamp</label>
                          <div className="text-white font-inter mt-1">{formatTime(data.timestamp)}</div>
                        </div>

                        <div>
                          <label className="text-sm text-white/70 font-inter">Transactions</label>
                          <div className="text-white font-inter mt-1">{data.transactions.length}</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-white/70 font-inter">Miner</label>
                          <div className="mt-1">
                            <ClickableAddress address={data.miner} onAddressClick={handleAddressClick} />
                          </div>
                        </div>

                        <div>
                          <label className="text-sm text-white/70 font-inter">Gas Used / Limit</label>
                          <div className="text-white font-inter mt-1">
                            {Number.parseInt(data.gasUsed).toLocaleString()} /{" "}
                            {Number.parseInt(data.gasLimit).toLocaleString()}
                          </div>
                        </div>

                        <div>
                          <label className="text-sm text-white/70 font-inter">Size</label>
                          <div className="text-white font-inter mt-1">{data.size} bytes</div>
                        </div>
                      </div>
                    </div>

                    {data.transactions.length > 0 && (
                      <div>
                        <h3 className="text-white font-inter font-semibold mb-3">Transactions</h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {data.transactions.slice(0, 20).map((tx: any, index: number) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2 bg-white/5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                              onClick={() => handleTransactionClick(typeof tx === "string" ? tx : tx.hash)}
                            >
                              <code className="text-white/80 font-mono text-sm">
                                {formatHash(typeof tx === "string" ? tx : tx.hash)}
                              </code>
                              <Badge variant="default" className="text-xs">
                                Success
                              </Badge>
                            </div>
                          ))}
                          {data.transactions.length > 20 && (
                            <div className="text-center py-2 text-white/50 text-sm">
                              And {data.transactions.length - 20} more transactions...
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
