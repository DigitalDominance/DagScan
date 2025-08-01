"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Search, Menu, X, Coins, Activity, Zap, Wallet, CuboidIcon as Cube, Code } from "lucide-react"
import { useRouter } from "next/navigation"
import { ZealousAPI, type Token } from "@/lib/zealous-api"
import { KasplexAPI } from "@/lib/api"

interface SearchSuggestion {
  type: "address" | "transaction" | "block" | "token" | "dapp"
  value: string
  display: string
  logo?: string
  subtitle?: string
}

interface NavigationProps {
  currentNetwork: "kasplex" | "igra"
  onNetworkChange: (network: "kasplex" | "igra") => void
  onSearch: (query: string) => void
}

export default function Navigation({ currentNetwork, onNetworkChange, onSearch }: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [tokens, setTokens] = useState<Token[]>([])
  const [contractCheckCache, setContractCheckCache] = useState<Record<string, boolean>>({})
  const router = useRouter()
  const zealousAPI = new ZealousAPI()

  // Get token logo URL using the same logic as VerifiedTokensList
  const getTokenLogoUrl = (logoURI: string): string => {
    if (!logoURI) return "/placeholder.svg?height=40&width=40"
    if (logoURI.startsWith("http")) return logoURI
    return `https://testnet.zealousswap.com/images/${logoURI}`
  }

  // Fetch tokens for search suggestions
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const tokenData = await zealousAPI.getTokens(50, 0) // Get top 50 tokens for search
        setTokens(tokenData)
      } catch (error) {
        console.warn("Failed to fetch tokens for search:", error)
      }
    }
    fetchTokens()
  }, [])

  const detectSearchType = async (query: string): Promise<SearchSuggestion[]> => {
    const suggestions: SearchSuggestion[] = []

    if (query.length >= 2) {
      // Search for tokens by symbol or name
      const matchingTokens = tokens
        .filter(
          (token) =>
            token.symbol.toLowerCase().includes(query.toLowerCase()) ||
            token.name.toLowerCase().includes(query.toLowerCase()) ||
            token.address.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 3) // Limit to 3 token suggestions

      matchingTokens.forEach((token) => {
        suggestions.push({
          type: "token",
          value: token.address,
          display: `${token.symbol} - ${token.name}`,
          subtitle: `$${token.priceUSD?.toFixed(6) || "0.00"}`,
          logo: getTokenLogoUrl(token.logoURI), // Use proper logo URL logic
        })
      })

      // Search for dapps
      if (query.toLowerCase().includes("zealous") || query.toLowerCase().includes("swap")) {
        suggestions.push({
          type: "dapp",
          value: "zealous-swap",
          display: "Zealous Swap",
          subtitle: "Decentralized Exchange",
          logo: "/zealous-logo.png",
        })
      }
    }

    if (query.length >= 3) {
      // Check if it looks like an address
      if (query.startsWith("0x") && query.length >= 10) {
        if (query.length === 42) {
          // Check if we already know if this is a contract
          if (contractCheckCache[query.toLowerCase()]) {
            const isContract = contractCheckCache[query.toLowerCase()]
            suggestions.push({
              type: "address",
              value: query,
              display: `${isContract ? "Contract" : "Address"}: ${query.slice(0, 10)}...${query.slice(-8)}`,
            })
          } else {
            // Check if it's a contract via RPC
            try {
              const api = new KasplexAPI("kasplex")
              const addressDetails = await api.getAddressDetails(query)
              const isContract = addressDetails.contractInfo?.isContract || false

              // Cache the result
              setContractCheckCache((prev) => ({
                ...prev,
                [query.toLowerCase()]: isContract,
              }))

              suggestions.push({
                type: "address",
                value: query,
                display: `${isContract ? "Contract" : "Address"}: ${query.slice(0, 10)}...${query.slice(-8)}`,
              })
            } catch (error) {
              // If RPC fails, default to address
              suggestions.push({
                type: "address",
                value: query,
                display: `Address: ${query.slice(0, 10)}...${query.slice(-8)}`,
              })
            }
          }
        } else if (query.length === 66) {
          suggestions.push({
            type: "transaction",
            value: query,
            display: `Transaction: ${query.slice(0, 10)}...${query.slice(-8)}`,
          })
        } else if (query.length > 10) {
          suggestions.push({
            type: "address",
            value: query,
            display: `Possible Address: ${query.slice(0, 10)}...`,
          })
          suggestions.push({
            type: "transaction",
            value: query,
            display: `Possible Transaction: ${query.slice(0, 10)}...`,
          })
        }
      }

      // Check if it's a number (block number)
      if (/^\d+$/.test(query)) {
        suggestions.push({
          type: "block",
          value: query,
          display: `Block #${query}`,
        })
      }
    }

    return suggestions
  }

  useEffect(() => {
    const updateSuggestions = async () => {
      if (searchQuery.trim()) {
        const suggestions = await detectSearchType(searchQuery.trim())
        setSearchSuggestions(suggestions)
        setShowSuggestions(suggestions.length > 0)
      } else {
        setSearchSuggestions([])
        setShowSuggestions(false)
      }
    }

    updateSuggestions()
  }, [searchQuery, tokens, contractCheckCache])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim())
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    if (suggestion.type === "token") {
      router.push(`/tokens/${suggestion.value}`)
    } else if (suggestion.type === "dapp") {
      router.push(`/dapps/${suggestion.value}`)
    } else if (suggestion.type === "transaction") {
      router.push(`/tx/${suggestion.value}`)
    } else if (suggestion.type === "address") {
      // Go directly to address page instead of search page
      router.push(`/address/${suggestion.value}`)
    } else if (suggestion.type === "block") {
      router.push(`/block/${suggestion.value}`)
    } else {
      setSearchQuery(suggestion.value)
      onSearch(suggestion.value)
    }
    setShowSuggestions(false)
  }

  const handleLogoClick = () => {
    router.push("/")
  }

  const getSuggestionIcon = (suggestion: SearchSuggestion) => {
    switch (suggestion.type) {
      case "token":
        return <Coins className="h-4 w-4 text-yellow-400" />
      case "dapp":
        return <Activity className="h-4 w-4 text-cyan-400" />
      case "transaction":
        return <Zap className="h-4 w-4 text-blue-400" />
      case "address":
        // Check if it's a contract based on the display text
        const isContract = suggestion.display.startsWith("Contract:")
        return isContract ? <Code className="h-4 w-4 text-blue-400" /> : <Wallet className="h-4 w-4 text-green-400" />
      case "block":
        return <Cube className="h-4 w-4 text-purple-400" />
      default:
        return <Search className="h-4 w-4 text-white/50" />
    }
  }

  return (
    <nav className="relative z-20 border-b border-white/10 bg-black/20 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <motion.div
            className="flex items-center space-x-3 cursor-pointer"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            onClick={handleLogoClick}
          >
            <img src="/dagscan-logo.webp" alt="DagScan" className="h-8 w-8" />
            <span className="text-xl font-bold text-white font-orbitron bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              DagScan
            </span>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push("/tokens")}
                className="text-white/70 hover:text-white font-orbitron relative bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all duration-300 border border-transparent hover:shadow-[0_0_20px_rgba(59,130,246,0.3),0_0_40px_rgba(147,51,234,0.2),0_0_60px_rgba(236,72,153,0.1)] before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-r before:from-blue-500 before:via-purple-500 before:to-pink-500 before:-z-10 before:opacity-0 hover:before:opacity-100"
              >
                <span className="relative z-10">Tokens</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push("/dapps")}
                className="text-white/70 hover:text-white font-orbitron relative bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all duration-300 border border-transparent hover:shadow-[0_0_20px_rgba(59,130,246,0.3),0_0_40px_rgba(147,51,234,0.2),0_0_60px_rgba(236,72,153,0.1)] before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-r before:from-blue-500 before:via-purple-500 before:to-pink-500 before:-z-10 before:opacity-0 hover:before:opacity-100"
              >
                <span className="relative z-10">DApps</span>
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="Search blocks, txns, addresses, tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(searchSuggestions.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-80 rounded-lg bg-white/10 px-4 py-2 pl-10 text-white placeholder-white/50 backdrop-blur-sm focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 font-orbitron text-sm"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
              </form>

              {/* Search Suggestions */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg overflow-hidden z-50 max-h-80 overflow-y-auto">
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors font-orbitron text-sm flex items-center gap-3"
                    >
                      {suggestion.logo ? (
                        <img
                          src={suggestion.logo || "/placeholder.svg"}
                          alt=""
                          className="h-6 w-6 rounded-full flex-shrink-0"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = "/placeholder.svg?height=24&width=24"
                          }}
                        />
                      ) : (
                        getSuggestionIcon(suggestion)
                      )}
                      <div className="flex-1">
                        <div className="font-bold">{suggestion.display}</div>
                        {suggestion.subtitle && <div className="text-xs text-white/50">{suggestion.subtitle}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-white/70 font-orbitron">Network:</span>
              <div className="flex rounded-lg bg-white/10 p-1">
                <Button
                  variant={currentNetwork === "kasplex" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onNetworkChange("kasplex")}
                  className={`text-xs font-rajdhani font-semibold px-3 py-1 relative ${
                    currentNetwork === "kasplex"
                      ? "bg-black/60 text-white border border-transparent before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-r before:from-purple-500 before:to-blue-500 before:-z-10"
                      : "text-white/70 hover:text-white bg-black/40 hover:bg-black/60 border border-transparent hover:before:absolute hover:before:inset-0 hover:before:rounded-md hover:before:p-[1px] hover:before:bg-gradient-to-r hover:before:from-purple-500 hover:to-blue-500 hover:before:-z-10 hover:before:opacity-50"
                  } transition-all duration-300`}
                >
                  <span className="relative z-10">
                    <img src="/kasplex-logo.png" alt="Kasplex" className="h-4 w-auto" />
                  </span>
                </Button>
                <div className="relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="text-xs text-white/30 cursor-not-allowed font-rajdhani px-3 py-1"
                  >
                    <img src="/igra-logo.png" alt="Igra" className="h-4 w-auto opacity-30" />
                  </Button>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                    Coming Soon
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-black/90"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <Button variant="ghost" size="sm" className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden border-t border-white/10 py-4"
          >
            <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={() => router.push("/tokens")}
                className="w-full justify-start text-white/70 hover:text-white font-orbitron relative bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all duration-300 border border-transparent hover:shadow-[0_0_20px_rgba(59,130,246,0.3),0_0_40px_rgba(147,51,234,0.2),0_0_60px_rgba(236,72,153,0.1)] before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-r before:from-blue-500 before:via-purple-500 before:to-pink-500 before:-z-10 before:opacity-0 hover:before:opacity-100"
              >
                <span className="relative z-10">Tokens</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push("/dapps")}
                className="w-full justify-start text-white/70 hover:text-white font-orbitron relative bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-all duration-300 border border-transparent hover:shadow-[0_0_20px_rgba(59,130,246,0.3),0_0_40px_rgba(147,51,234,0.2),0_0_60px_rgba(236,72,153,0.1)] before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-r before:from-blue-500 before:via-purple-500 before:to-pink-500 before:-z-10 before:opacity-0 hover:before:opacity-100"
              >
                <span className="relative z-10">DApps</span>
              </Button>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70 font-orbitron">Network:</span>
                <div className="flex rounded-lg bg-white/10 p-1">
                  <Button
                    variant={currentNetwork === "kasplex" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onNetworkChange("kasplex")}
                    className={`text-xs font-rajdhani font-semibold px-3 py-1 ${
                      currentNetwork === "kasplex"
                        ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    <img src="/kasplex-logo.png" alt="Kasplex" className="h-4 w-auto" />
                  </Button>
                  <div className="relative group">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      className="text-xs text-white/30 cursor-not-allowed font-rajdhani px-3 py-1"
                    >
                      <img src="/igra-logo.png" alt="Igra" className="h-4 w-auto opacity-30" />
                    </Button>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                      Coming Soon
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <form onSubmit={handleSearch} className="relative">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setShowSuggestions(searchSuggestions.length > 0)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="w-full rounded-lg bg-white/10 px-4 py-2 pl-10 text-white placeholder-white/50 backdrop-blur-sm focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 font-orbitron text-sm"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                </form>

                {/* Mobile Search Suggestions */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg overflow-hidden z-50 max-h-60 overflow-y-auto">
                    {searchSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors font-orbitron text-sm flex items-center gap-3"
                      >
                        {suggestion.logo ? (
                          <img
                            src={suggestion.logo || "/placeholder.svg"}
                            alt=""
                            className="h-6 w-6 rounded-full flex-shrink-0"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = "/placeholder.svg?height=24&width=24"
                            }}
                          />
                        ) : (
                          getSuggestionIcon(suggestion)
                        )}
                        <div className="flex-1">
                          <div className="font-bold">{suggestion.display}</div>
                          {suggestion.subtitle && <div className="text-xs text-white/50">{suggestion.subtitle}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </nav>
  )
}
