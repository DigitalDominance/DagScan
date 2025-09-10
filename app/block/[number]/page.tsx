"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Copy, CheckCircle, CuboidIcon as Cube } from "lucide-react"
import { KasplexAPI } from "@/lib/api"
import ClickableAddress from "@/components/clickable-address"
import BeamsBackground from "@/components/beams-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { useNetwork } from "@/context/NetworkContext"

export default function BlockPage() {
  const params = useParams()
  const router = useRouter()
  const { currentNetwork, handleNetworkChange } = useNetwork();
  const [blockData, setBlockData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const blockNumber = params.number as string
  const api = new KasplexAPI(currentNetwork)

  useEffect(() => {
    const fetchBlockData = async () => {
      try {
        setLoading(true)
        const data = await api.getBlockDetails(Number.parseInt(blockNumber))
        setBlockData(data)
      } catch (err) {
        setError("Failed to load block data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (blockNumber) {
      fetchBlockData()
    }
  }, [blockNumber])

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

  const handleAddressClick = (address: string) => {
    router.push(`/address/${address}`)
  }

  const handleTransactionClick = (txHash: string) => {
    router.push(`/tx/${txHash}`)
  }

  const handleSearch = (query: string) => {
    router.push(`/search/${encodeURIComponent(query)}`)
  }

  if (loading) {
    return (
      <BeamsBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork={currentNetwork} onNetworkChange={handleNetworkChange} onSearch={handleSearch} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-white/70 font-inter">Loading block data...</p>
            </div>
          </main>
          <Footer />
        </div>
      </BeamsBackground>
    )
  }

  if (error || !blockData) {
    return (
      <BeamsBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork={currentNetwork} onNetworkChange={handleNetworkChange} onSearch={handleSearch} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-400 font-inter mb-4">{error || "Block not found"}</p>
              <Button onClick={() => router.push("/")} className="bg-purple-600 hover:bg-purple-700">
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
              <Cube className="h-8 w-8 text-purple-400" />
              <h1 className="text-3xl font-bold text-white">Block #{blockData.number}</h1>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl mb-8">
              <CardHeader>
                <CardTitle className="text-white font-inter">Block Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-white/70 font-inter">Block Hash</label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded break-all">
                          {blockData.hash}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-white/50 hover:text-white flex-shrink-0"
                          onClick={() => copyToClipboard(blockData.hash)}
                        >
                          {copiedText === blockData.hash ? (
                            <CheckCircle className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-white/70 font-inter">Timestamp</label>
                      <div className="text-white font-inter mt-1">{formatTime(blockData.timestamp)}</div>
                    </div>

                    <div>
                      <label className="text-sm text-white/70 font-inter">Transactions</label>
                      <div className="text-white font-inter mt-1">{blockData.transactions.length}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-white/70 font-inter">Miner</label>
                      <div className="mt-1">
                        <ClickableAddress address={blockData.miner} onAddressClick={handleAddressClick} />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-white/70 font-inter">Gas Used / Limit</label>
                      <div className="text-white font-inter mt-1">
                        {Number.parseInt(blockData.gasUsed).toLocaleString()} /{" "}
                        {Number.parseInt(blockData.gasLimit).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-white/70 font-inter">Size</label>
                      <div className="text-white font-inter mt-1">
                        {Number.parseInt(blockData.size || "0", 16).toLocaleString()} bytes
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {blockData.transactions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-white font-inter">
                    Transactions ({blockData.transactions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {blockData.transactions.slice(0, 50).map((tx: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white/5 rounded hover:bg-white/10 transition-colors cursor-pointer"
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
                    {blockData.transactions.length > 50 && (
                      <div className="text-center py-2 text-white/50 text-sm">
                        And {blockData.transactions.length - 50} more transactions...
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </main>

        <Footer />
      </div>
    </BeamsBackground>
  )
}
