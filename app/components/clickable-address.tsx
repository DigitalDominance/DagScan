"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, CheckCircle, Shield, Code } from "lucide-react"
import type { ContractInfo } from "@/lib/api"

interface ClickableAddressProps {
  address: string
  contractInfo?: ContractInfo | null
  onAddressClick?: (address: string) => void
  showFull?: boolean
  className?: string
}

export default function ClickableAddress({
  address,
  contractInfo,
  onAddressClick,
  showFull = false,
  className = "",
}: ClickableAddressProps) {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  const copyToClipboard = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopiedAddress(text)
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const formatAddress = (addr: string) => {
    if (showFull) return addr
    // More mobile-friendly formatting
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const getDisplayName = () => {
    if (contractInfo?.isVerified && contractInfo.name) {
      return contractInfo.name
    }
    return formatAddress(address)
  }

  const handleClick = () => {
    if (onAddressClick) {
      onAddressClick(address)
    }
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div
        className="flex items-center gap-1 cursor-pointer hover:bg-white/10 rounded px-1 py-0.5 transition-colors min-w-0"
        onClick={handleClick}
      >
        {contractInfo?.isContract && (
          <Code className="h-2.5 w-2.5 text-blue-400 flex-shrink-0" title="Contract Address" />
        )}
        {contractInfo?.isVerified && (
          <Shield className="h-2.5 w-2.5 text-green-400 flex-shrink-0" title="Verified Contract" />
        )}

        <span className="text-white font-mono text-xs truncate">{getDisplayName()}</span>

        {contractInfo?.isVerified && contractInfo.symbol && (
          <Badge variant="secondary" className="text-xs ml-1 hidden sm:inline-flex">
            {contractInfo.symbol}
          </Badge>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-4 w-4 p-0 text-white/50 hover:text-white flex-shrink-0"
        onClick={(e) => copyToClipboard(address, e)}
      >
        {copiedAddress === address ? (
          <CheckCircle className="h-2.5 w-2.5 text-green-400" />
        ) : (
          <Copy className="h-2.5 w-2.5" />
        )}
      </Button>
    </div>
  )
}
