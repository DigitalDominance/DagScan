"use client"

import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Search } from "lucide-react"

interface LoadingModalProps {
  isOpen: boolean
  onClose: () => void
  searchQuery: string
}

export default function LoadingModal({ isOpen, onClose, searchQuery }: LoadingModalProps) {
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
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white font-inter flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-400" />
              Searching...
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-white/70 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-white/70 font-inter mb-2">Searching for:</p>
              <code className="text-white font-mono text-sm bg-white/10 px-2 py-1 rounded break-all">
                {searchQuery}
              </code>
              <p className="text-white/50 font-inter text-sm mt-3">This may take a few moments...</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
