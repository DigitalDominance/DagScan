"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Search, Menu, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface SearchSuggestion {
  type: "address" | "transaction" | "block"
  value: string
  display: string
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
  const router = useRouter()

  const detectSearchType = (query: string): SearchSuggestion[] => {
    const suggestions: SearchSuggestion[] = []

    if (query.length >= 3) {
      // Check if it looks like an address
      if (query.startsWith("0x") && query.length >= 10) {
        if (query.length === 42) {
          suggestions.push({
            type: "address",
            value: query,
            display: `Address: ${query.slice(0, 10)}...${query.slice(-8)}`,
          })
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
    if (searchQuery.trim()) {
      const suggestions = detectSearchType(searchQuery.trim())
      setSearchSuggestions(suggestions)
      setShowSuggestions(suggestions.length > 0)
    } else {
      setSearchSuggestions([])
      setShowSuggestions(false)
    }
  }, [searchQuery])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim())
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setSearchQuery(suggestion.value)
    onSearch(suggestion.value)
    setShowSuggestions(false)
  }

  const handleLogoClick = () => {
    router.push("/")
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
              <span className="text-sm text-white/70 font-rajdhani">Network:</span>
              <div className="flex rounded-lg bg-white/10 p-1">
                <Button
                  variant="default"
                  size="sm"
                  className="text-xs bg-gradient-to-r from-purple-500 to-blue-500 text-white font-rajdhani font-semibold"
                >
                  Kasplex
                </Button>
                <div className="relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    className="text-xs text-white/30 cursor-not-allowed font-rajdhani"
                  >
                    Igra
                  </Button>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1 bg-black/90 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                    Coming Soon
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-black/90"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="Search blocks, txns, addresses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(searchSuggestions.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-80 rounded-lg bg-white/10 px-4 py-2 pl-10 text-white placeholder-white/50 backdrop-blur-sm focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 font-rajdhani"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
              </form>

              {/* Search Suggestions */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg overflow-hidden z-50">
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors font-inter text-sm"
                    >
                      {suggestion.display}
                    </button>
                  ))}
                </div>
              )}
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70 font-rajdhani">Network:</span>
                <div className="flex rounded-lg bg-white/10 p-1">
                  <Button
                    variant="default"
                    size="sm"
                    className="text-xs bg-gradient-to-r from-purple-500 to-blue-500 text-white font-rajdhani font-semibold"
                  >
                    Kasplex
                  </Button>
                  <div className="relative group">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      className="text-xs text-white/30 cursor-not-allowed font-rajdhani"
                    >
                      Igra
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
                    className="w-full rounded-lg bg-white/10 px-4 py-2 pl-10 text-white placeholder-white/50 backdrop-blur-sm focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 font-rajdhani"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                </form>

                {/* Mobile Search Suggestions */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg overflow-hidden z-50">
                    {searchSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full px-4 py-2 text-left text-white hover:bg-white/10 transition-colors font-inter text-sm"
                      >
                        {suggestion.display}
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
