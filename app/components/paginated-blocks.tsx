"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CuboidIcon as Cube, Copy, CheckCircle, ChevronLeft, ChevronRight, X } from "lucide-react"
import { KasplexAPI } from "@/lib/api"
import ClickableAddress from "./clickable-address"

interface PaginatedBlocksProps {
  isOpen: boolean
  onClose: () => void
  network: "kasplex" | "igra"
  onBlockClick: (blockNumber: number) => void
  onAddressClick: (address: string) => void
}

export default function PaginatedBlocks({
  isOpen,
  onClose,
  network,
  onBlockClick,
  onAddressClick,
}: PaginatedBlocksProps) {
  const [blocks, setBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [latestBlockNumber, setLatestBlockNumber] = useState(0)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const blocksPerPage = 20
  const api = new KasplexAPI(network)

  useEffect(() => {
    if (isOpen) {
      fetchBlocks(1)
    }
  }, [isOpen, network])

  const fetchBlocks = async (page: number) => {
    setLoading(true)
    try {
      if (latestBlockNumber === 0) {
        const latest = await api.getLatestBlockNumber()
        setLatestBlockNumber(latest)
      }

      const startBlock = latestBlockNumber - (page - 1) * blocksPerPage
      const blockPromises = []

      for (let i = 0; i < blocksPerPage && startBlock - i > 0; i++) {
        blockPromises.push(api.getBlock(startBlock - i, true))
      }

      const fetchedBlocks = await Promise.all(blockPromises)
      const formattedBlocks = fetchedBlocks.map((block) => ({
        number: Number.parseInt(block.number, 16),
        hash: block.hash,
        timestamp: Number.parseInt(block.timestamp, 16) * 1000,
        transactions: block.transactions?.length || 0,
        gasUsed: Number.parseInt(block.gasUsed || "0", 16).toString(),
        gasLimit: Number.parseInt(block.gasLimit || "0", 16).toString(),
        miner: block.miner || "0x0000000000000000000000000000000000000000",
      }))

      setBlocks(formattedBlocks)
      setCurrentPage(page)
    } catch (error) {
      console.error("Failed to fetch blocks:", error)
    } finally {
      setLoading(false)
    }
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
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString()

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
              <Cube className="h-5 w-5 text-purple-400" />
              All Blocks
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white/70 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-white/70 font-inter">Loading blocks...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {blocks.map((block, index) => (
                    <motion.div
                      key={block.hash}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => {
                        onBlockClick(block.number)
                        onClose()
                      }}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 rounded-lg border-2 border-purple-400/50 bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                          <Cube className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium font-inter">#{block.number}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-white/50 hover:text-white"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(block.hash)
                              }}
                            >
                              {copiedHash === block.hash ? (
                                <CheckCircle className="h-3 w-3 text-green-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          <div className="text-sm text-white/70 font-inter">{formatTime(block.timestamp)}</div>
                          <div className="text-xs text-white/50 font-mono">{formatHash(block.hash)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-white font-inter mb-1">{block.transactions} transactions</div>
                        <div className="text-xs text-white/70 font-inter mb-1">
                          Gas: {Number.parseInt(block.gasUsed).toLocaleString()}
                        </div>
                        <ClickableAddress address={block.miner} onAddressClick={onAddressClick} className="text-xs" />
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
                onClick={() => fetchBlocks(currentPage - 1)}
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
                onClick={() => fetchBlocks(currentPage + 1)}
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
