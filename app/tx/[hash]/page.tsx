"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Copy, CheckCircle, Activity, Code, Zap, ExternalLink } from "lucide-react"
import { KasplexAPI } from "@/lib/api"
import ClickableAddress from "@/components/clickable-address"
import BeamsBackground from "@/components/beams-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { useNetwork } from "@/context/NetworkContext"

export default function TransactionPage() {
  const params = useParams()
  const router = useRouter()
  const { currentNetwork, handleNetworkChange } = useNetwork();
  const [txData, setTxData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const txHash = params.hash as string
  const api = new KasplexAPI(currentNetwork)

  useEffect(() => {
    const fetchTxData = async () => {
      try {
        setLoading(true)
        const data = await api.getTransactionDetails(txHash)
        setTxData(data)
      } catch (err) {
        setError("Failed to load transaction data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (txHash) {
      fetchTxData()
    }
  }, [txHash, currentNetwork])

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

  const handleAddressClick = (address: string) => {
    router.push(`/address/${address}`)
  }

  const handleBlockClick = (blockNumber: number) => {
    router.push(`/block/${blockNumber}`)
  }

  const handleSearch = (query: string) => {
    router.push(`/search/${encodeURIComponent(query)}`)
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

  if (loading) {
    return (
      <BeamsBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork={currentNetwork} onNetworkChange={handleNetworkChange} onSearch={handleSearch} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-white/70 font-inter">Loading transaction data...</p>
            </div>
          </main>
          <Footer />
        </div>
      </BeamsBackground>
    )
  }

  if (error || !txData) {
    return (
      <BeamsBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork={currentNetwork} onNetworkChange={handleNetworkChange} onSearch={handleSearch} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-400 font-inter mb-4">{error || "Transaction not found"}</p>
              <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700">
                Go Home
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

        <main className="flex-1 mx-auto max-w-6xl px-4 py-8">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => router.back()} className="text-white/70 hover:text-white mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 mb-6"
            >
              <Activity className="h-8 w-8 text-blue-400" />
              <h1 className="text-3xl font-bold text-white">Transaction Details</h1>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white font-inter flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-400" />
                  Transaction Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Transaction Type Badge */}
                <div className="flex items-center gap-2">
                  <Badge className={`${getTransactionTypeColor(txData.txType)} border`}>
                    {getTransactionTypeIcon(txData.txType)}
                    <span className="ml-1">{txData.txType}</span>
                  </Badge>
                  <Badge variant={txData.status === "success" ? "default" : "destructive"}>{txData.status}</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-white/70 font-inter">Transaction Hash</label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded break-all">
                          {txData.hash}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-white/50 hover:text-white flex-shrink-0"
                          onClick={() => copyToClipboard(txData.hash)}
                        >
                          {copiedText === txData.hash ? (
                            <CheckCircle className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-white/70 font-inter">Block</label>
                      <div className="mt-1">
                        <button
                          onClick={() => handleBlockClick(txData.blockNumber)}
                          className="text-blue-400 hover:text-blue-300 font-inter"
                        >
                          #{txData.blockNumber}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-white/70 font-inter">From</label>
                      <div className="mt-1">
                        <ClickableAddress
                          address={txData.from}
                          contractInfo={txData.fromInfo}
                          onAddressClick={handleAddressClick}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-white/70 font-inter">Value</label>
                      <div className="text-white font-inter mt-1">{formatValue(txData.value)}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-white/70 font-inter">To</label>
                      <div className="mt-1">
                        {txData.to === "Contract Creation" ? (
                          <span className="text-purple-400 font-inter">Contract Creation</span>
                        ) : (
                          <ClickableAddress
                            address={txData.to}
                            contractInfo={txData.toInfo}
                            onAddressClick={handleAddressClick}
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-white/70 font-inter">Gas Price</label>
                      <div className="text-white font-inter mt-1">{txData.gasPrice} Gwei</div>
                    </div>

                    <div>
                      <label className="text-sm text-white/70 font-inter">Gas Used</label>
                      <div className="text-white font-inter mt-1">
                        {Number.parseInt(txData.gasUsed || "0").toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-white/70 font-inter">Timestamp</label>
                      <div className="text-white font-inter mt-1">{formatTime(txData.timestamp)}</div>
                    </div>
                  </div>
                </div>

                {txData.input && txData.input !== "0x" && (
                  <div>
                    <label className="text-sm text-white/70 font-inter">Input Data</label>
                    <div className="mt-1 p-3 bg-white/5 rounded-lg max-h-32 overflow-y-auto">
                      <code className="text-white/80 font-mono text-xs break-all">{txData.input}</code>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </main>

        <Footer />
      </div>
    </BeamsBackground>
  )
}
