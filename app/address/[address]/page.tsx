"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  ExternalLink,
  Code,
  Shield,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
} from "lucide-react"
import { KasplexAPI } from "@/lib/api"
import BeamsBackground from "@/components/beams-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"

export default function AddressPage() {
  const params = useParams()
  const router = useRouter()
  const [addressData, setAddressData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [tokenBalances, setTokenBalances] = useState<any[]>([])
  const [nfts, setNfts] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)

  const transactionsPerPage = 10
  const address = params.address as string
  const api = new KasplexAPI("kasplex")

  useEffect(() => {
    const fetchAddressData = async () => {
      try {
        setLoading(true)
        const data = await api.getAddressDetails(address)
        setAddressData(data)

        // Filter out unknown tokens
        const filteredTokens = (data.tokenBalances || []).filter((balance: any) => {
          const tokenName = balance.token?.name || balance.token?.symbol || "Unknown Token"
          return tokenName !== "Unknown Token"
        })
        setTokenBalances(filteredTokens)

        setNfts(data.nfts || [])
      } catch (err) {
        setError("Failed to load address data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (address) {
      fetchAddressData()
    }
  }, [address])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
      setTimeout(() => setCopiedText(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const formatHash = (hash: string) => `${hash.slice(0, 6)}...${hash.slice(-4)}`
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString()
  const formatValue = (value: string) => `${Number.parseFloat(value).toFixed(4)} KAS`

  const handleTransactionClick = (txHash: string) => {
    router.push(`/tx/${txHash}`)
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

  const handleVideoPlay = (nftId: string) => {
    setPlayingVideo(playingVideo === nftId ? null : nftId)
  }

  const isVideoFile = (nft: any) => {
    // First check if metadata has "Videos" category
    if (nft.metadata?.attributes) {
      const categoryAttribute = nft.metadata.attributes.find(
        (attr: any) => attr.trait_type === "Category" && attr.value === "Videos",
      )
      if (categoryAttribute) {
        return true
      }
    }

    // Fallback to URL-based detection
    const mediaUrl = getMediaUrl(nft)
    if (!mediaUrl) return false
    const videoExtensions = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"]
    const lowerUrl = mediaUrl.toLowerCase()
    return videoExtensions.some((ext) => lowerUrl.includes(ext)) || lowerUrl.includes("video")
  }

  const getMediaUrl = (nft: any) => {
    // Check media_url first, then image_url, then metadata
    let url = nft.media_url || nft.image_url || nft.metadata?.image_url || nft.metadata?.image

    // Convert IPFS URLs to HTTP gateway URLs
    if (url && url.startsWith("ipfs://")) {
      url = url.replace("ipfs://", "https://ipfs.io/ipfs/")
    }

    return url
  }

  // Pagination logic
  const totalPages = Math.ceil((addressData?.transactions?.length || 0) / transactionsPerPage)
  const startIndex = (currentPage - 1) * transactionsPerPage
  const endIndex = startIndex + transactionsPerPage
  const currentTransactions = addressData?.transactions?.slice(startIndex, endIndex) || []

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  if (loading) {
    return (
      <BeamsBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork="kasplex" onNetworkChange={() => {}} onSearch={handleSearch} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-white/70 font-inter text-sm sm:text-base">Loading address data...</p>
            </div>
          </main>
          <Footer />
        </div>
      </BeamsBackground>
    )
  }

  if (error || !addressData) {
    return (
      <BeamsBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork="kasplex" onNetworkChange={() => {}} onSearch={handleSearch} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center px-4">
              <p className="text-red-400 font-inter mb-4 text-sm sm:text-base">{error || "Address not found"}</p>
              <Button onClick={() => router.push("/")} className="bg-green-600 hover:bg-green-700 text-sm">
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
        <Navigation currentNetwork="kasplex" onNetworkChange={() => {}} onSearch={handleSearch} />

        <main className="flex-1 mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-8">
          <div className="mb-4 sm:mb-6">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="text-white/70 hover:text-white mb-3 sm:mb-4 text-sm p-2"
            >
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Back
            </Button>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6"
            >
              {addressData.contractInfo?.isContract ? (
                <Code className="h-5 w-5 sm:h-8 sm:w-8 text-blue-400" />
              ) : (
                <ExternalLink className="h-5 w-5 sm:h-8 sm:w-8 text-green-400" />
              )}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                {addressData.contractInfo?.isContract ? "Contract" : "Address"} Details
              </h1>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {/* Contract Info */}
            {addressData.contractInfo?.isContract && (
              <Card className="bg-blue-500/10 border-blue-500/20 backdrop-blur-xl mb-4 sm:mb-6">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-blue-300 font-inter flex items-center gap-2 text-sm sm:text-base">
                    <Code className="h-4 w-4 sm:h-5 sm:w-5" />
                    Contract Information
                    {addressData.contractInfo.isVerified && (
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                        <Shield className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                {addressData.contractInfo.name && (
                  <CardContent className="p-3 sm:p-6 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="text-xs sm:text-sm text-white/70 font-inter">Contract Name</label>
                        <div className="text-white font-inter mt-1 text-sm sm:text-base">
                          {addressData.contractInfo.name}
                        </div>
                      </div>
                      {addressData.contractInfo.symbol && (
                        <div>
                          <label className="text-xs sm:text-sm text-white/70 font-inter">Symbol</label>
                          <div className="text-white font-inter mt-1 text-sm sm:text-base">
                            {addressData.contractInfo.symbol}
                          </div>
                        </div>
                      )}
                      {addressData.contractInfo.contractType && (
                        <div>
                          <label className="text-xs sm:text-sm text-white/70 font-inter">Type</label>
                          <div className="text-white font-inter mt-1 text-sm sm:text-base">
                            {addressData.contractInfo.contractType}
                          </div>
                        </div>
                      )}
                      {addressData.contractInfo.decimals && (
                        <div>
                          <label className="text-xs sm:text-sm text-white/70 font-inter">Decimals</label>
                          <div className="text-white font-inter mt-1 text-sm sm:text-base">
                            {addressData.contractInfo.decimals}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            <Card className="bg-black/40 border-white/20 backdrop-blur-xl mb-4 sm:mb-8">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-white font-inter text-sm sm:text-base">Address Information</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0 space-y-4 sm:space-y-6">
                <div>
                  <label className="text-xs sm:text-sm text-white/70 font-inter">Address</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-white font-mono text-xs sm:text-sm bg-white/10 px-2 py-1 rounded break-all flex-1">
                      {addressData.address}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-white/50 hover:text-white flex-shrink-0"
                      onClick={() => copyToClipboard(addressData.address)}
                    >
                      {copiedText === addressData.address ? (
                        <CheckCircle className="h-3 w-3 text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <label className="text-xs sm:text-sm text-white/70 font-inter">Balance</label>
                    <div className="text-white font-inter mt-1 text-sm sm:text-base">
                      {formatValue(addressData.balance)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm text-white/70 font-inter">Transaction Count</label>
                    <div className="text-white font-inter mt-1 text-sm sm:text-base">
                      {addressData.transactionCount}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs sm:text-sm text-white/70 font-inter">Address Type</label>
                    <div className="text-white font-inter mt-1 text-sm sm:text-base">
                      {addressData.contractInfo?.isContract ? "Contract" : "EOA"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* NFTs Section */}
          {nfts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="bg-black/40 border-white/20 backdrop-blur-xl mb-4 sm:mb-8">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-white font-inter text-sm sm:text-base">NFTs ({nfts.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
                    {nfts.slice(0, 15).map((nft: any, index: number) => {
                      const mediaUrl = getMediaUrl(nft)
                      const isVideo = isVideoFile(nft)

                      return (
                        <div
                          key={index}
                          className="bg-white/5 rounded-lg p-2 sm:p-3 hover:bg-white/10 transition-colors"
                        >
                          <div className="aspect-square mb-2 sm:mb-3 bg-white/5 rounded-lg overflow-hidden relative">
                            {isVideo ? (
                              <div className="relative w-full h-full">
                                <video
                                  src={mediaUrl}
                                  className="w-full h-full object-cover"
                                  loop
                                  muted
                                  playsInline
                                  ref={(video) => {
                                    if (video) {
                                      if (playingVideo === nft.id) {
                                        video.play()
                                      } else {
                                        video.pause()
                                      }
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => handleVideoPlay(nft.id)}
                                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                                >
                                  {playingVideo === nft.id ? (
                                    <Pause className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                                  ) : (
                                    <Play className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                                  )}
                                </button>
                              </div>
                            ) : mediaUrl ? (
                              <img
                                src={mediaUrl || "/placeholder.svg"}
                                alt={nft.metadata?.name || `NFT #${nft.id}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder.svg?height=200&width=200&text=NFT"
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/50">
                                <span className="text-xs">No Media</span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 sm:space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="text-white font-medium text-xs sm:text-sm truncate">
                                {nft.metadata?.name || nft.token?.name || `#${nft.id}`}
                              </h3>
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {nft.token_type || "NFT"}
                              </Badge>
                            </div>

                            {nft.token?.symbol && (
                              <div className="text-xs text-white/70 truncate">{nft.token.symbol}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {nfts.length > 15 && (
                    <div className="text-center mt-3 sm:mt-4 text-white/50 text-xs sm:text-sm">
                      And {nfts.length - 15} more NFTs...
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Token Balances Section */}
          {tokenBalances.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
              <Card className="bg-black/40 border-white/20 backdrop-blur-xl mb-4 sm:mb-8">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="text-white font-inter text-sm sm:text-base">
                    Token Balances ({tokenBalances.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                    {tokenBalances.slice(0, 12).map((balance: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        {balance.token?.icon_url && (
                          <img
                            src={balance.token.icon_url || "/placeholder.svg"}
                            alt={balance.token.symbol}
                            className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = "none"
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <span className="text-white font-medium text-xs sm:text-sm truncate">
                              {balance.token?.name || balance.token?.symbol}
                            </span>
                            {balance.token?.symbol && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {balance.token.symbol}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-white/70">
                            {balance.value && balance.token?.decimals
                              ? (
                                  Number.parseFloat(balance.value) /
                                  Math.pow(10, Number.parseInt(balance.token.decimals))
                                ).toFixed(4)
                              : balance.value || "0"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {tokenBalances.length > 12 && (
                    <div className="text-center mt-3 sm:mt-4 text-white/50 text-xs sm:text-sm">
                      And {tokenBalances.length - 12} more tokens...
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Transactions Section with Pagination */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white font-inter text-sm sm:text-base">
                    Transactions ({addressData.transactions.length})
                  </CardTitle>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-white/70">
                      {currentPage}/{totalPages}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <div className="space-y-2 sm:space-y-3">
                  {currentTransactions.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 text-white/50 font-inter text-sm">
                      No transactions found
                    </div>
                  ) : (
                    currentTransactions.map((tx: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 sm:p-3 bg-white/5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => handleTransactionClick(tx.hash)}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div
                            className={`h-2 w-2 rounded-full flex-shrink-0 ${
                              tx.status === "success" ? "bg-green-400" : "bg-red-400"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <code className="text-white/80 font-mono text-xs sm:text-sm block truncate">
                              {formatHash(tx.hash)}
                            </code>
                            {tx.type && (
                              <div className="flex items-center gap-1 sm:gap-2 mt-1">
                                <Badge className={`text-xs ${getTransactionTypeColor(tx.type)}`}>{tx.type}</Badge>
                                <span className="text-xs text-white/50">
                                  {tx.from === addressData.address ? "OUT" : "IN"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="text-white text-xs sm:text-sm">{formatValue(tx.value)}</div>
                          <div className="text-xs text-white/50 hidden sm:block">{formatTime(tx.timestamp)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-white/10">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="text-white/70 hover:text-white text-xs sm:text-sm p-2"
                    >
                      <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="hidden sm:inline">Previous</span>
                      <span className="sm:hidden">Prev</span>
                    </Button>

                    <div className="flex items-center gap-1 sm:gap-2">
                      {/* Show fewer page numbers on mobile */}
                      {Array.from({ length: Math.min(window.innerWidth < 640 ? 3 : 5, totalPages) }, (_, i) => {
                        let pageNum
                        const maxPages = window.innerWidth < 640 ? 3 : 5
                        if (totalPages <= maxPages) {
                          pageNum = i + 1
                        } else if (currentPage <= Math.floor(maxPages / 2) + 1) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - Math.floor(maxPages / 2)) {
                          pageNum = totalPages - maxPages + 1 + i
                        } else {
                          pageNum = currentPage - Math.floor(maxPages / 2) + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "ghost"}
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                            className={`w-6 h-6 sm:w-8 sm:h-8 p-0 text-xs ${
                              currentPage === pageNum ? "bg-purple-600 text-white" : "text-white/70 hover:text-white"
                            }`}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="text-white/70 hover:text-white text-xs sm:text-sm p-2"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <span className="sm:hidden">Next</span>
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    </Button>
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
