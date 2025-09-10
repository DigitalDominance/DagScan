"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Search, Coins, Activity, Zap, Wallet, CuboidIcon as Cube, Code } from "lucide-react"
import { KasplexAPI } from "@/lib/api"
import { ZealousAPI } from "@/lib/zealous-api"
import BeamsBackground from "@/components/beams-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"
import { useNetwork } from "@/context/NetworkContext"

interface TokenResult {
  address: string
  symbol: string
  name: string
  logoURI: string
}

interface DappResult {
  name: string
  slug: string
  logo: string
  description: string
}

interface AddressResult {
  address: string
  isContract: boolean
  contractName?: string
  contractSymbol?: string
  contractType?: string
}

export default function SearchPage() {
  const params = useParams()
  const router = useRouter()
  const { currentNetwork, handleNetworkChange } = useNetwork();
  const [searchResult, setSearchResult] = useState<any>(null)
  const [tokenResults, setTokenResults] = useState<TokenResult[]>([])
  const [dappResults, setDappResults] = useState<DappResult[]>([])
  const [addressResults, setAddressResults] = useState<AddressResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = decodeURIComponent(params.query as string)
  const api = new KasplexAPI(currentNetwork)
  const zealousAPI = new ZealousAPI()

  // Get token logo URL using the same logic as VerifiedTokensList
  const getTokenLogoUrl = (logoURI: string): string => {
    if (!logoURI) return "/placeholder.svg?height=40&width=40"
    if (logoURI.startsWith("http")) return logoURI
    return `https://testnet.zealousswap.com/images/${logoURI}`
  }

  // Helper function to check if query looks like blockchain data
  const isBlockchainQuery = (query: string): { type: string; shouldRedirect: boolean } => {
    // Transaction hash: starts with 0x and is 66 characters
    if (query.startsWith("0x") && query.length === 66) {
      return { type: "transaction", shouldRedirect: true }
    }

    // Address: starts with 0x and is 42 characters
    if (query.startsWith("0x") && query.length === 42) {
      return { type: "address", shouldRedirect: false } // Don't redirect, check contract status first
    }

    // Block number: only digits
    if (/^\d+$/.test(query)) {
      return { type: "block", shouldRedirect: true }
    }

    return { type: "unknown", shouldRedirect: false }
  }

  // Get icon for search result type
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "transaction":
        return <Zap className="h-5 w-5 text-blue-400" />
      case "address":
        return <Wallet className="h-5 w-5 text-green-400" />
      case "contract":
        return <Code className="h-5 w-5 text-blue-400" />
      case "block":
        return <Cube className="h-5 w-5 text-purple-400" />
      case "token":
        return <Coins className="h-5 w-5 text-yellow-400" />
      case "dapp":
        return <Activity className="h-5 w-5 text-cyan-400" />
      default:
        return <Search className="h-5 w-5 text-white/50" />
    }
  }

  // Check if an address is a contract using RPC call (same as address page)
  const checkIfContract = async (address: string): Promise<AddressResult> => {
    try {
      console.log(`🔍 Checking if ${address} is a contract...`)
      const addressData = await api.getAddressDetails(address)

      const result: AddressResult = {
        address,
        isContract: addressData.contractInfo?.isContract || false,
        contractName: addressData.contractInfo?.name,
        contractSymbol: addressData.contractInfo?.symbol,
        contractType: addressData.contractInfo?.contractType,
      }

      console.log(`✅ Contract check result:`, result)
      return result
    } catch (error) {
      console.warn("Failed to check if address is contract:", error)
      return {
        address,
        isContract: false,
      }
    }
  }

  useEffect(() => {
    const performSearch = async () => {
      try {
        setLoading(true)
        setError(null)

        const blockchainCheck = isBlockchainQuery(query)

        // If it's an address, check if it's a contract first
        if (blockchainCheck.type === "address") {
          console.log(`🔍 Detected address, checking contract status for: ${query}`)
          const addressResult = await checkIfContract(query)
          setAddressResults([addressResult])
          setLoading(false)
          return
        }

        // If it's other blockchain data, redirect directly
        if (blockchainCheck.shouldRedirect) {
          console.log(`Detected ${blockchainCheck.type}, redirecting directly to: ${query}`)

          if (blockchainCheck.type === "transaction") {
            router.replace(`/tx/${query}`)
            return
          } else if (blockchainCheck.type === "block") {
            router.replace(`/block/${query}`)
            return
          }
        }

        // If not blockchain data, try the API search first
        try {
          const result = await api.searchByHash(query)
          if (result) {
            setSearchResult(result)
            // Redirect to appropriate page based on result type
            if (result.type === "block") {
              router.replace(`/block/${result.number}`)
              return
            } else if (result.type === "transaction") {
              router.replace(`/tx/${result.hash}`)
              return
            } else if (result.type === "address") {
              router.replace(`/address/${result.address}`)
              return
            }
          }
        } catch (blockchainError) {
          console.log("API search failed, continuing with token/dapp search...", blockchainError)
        }

        // Search for tokens with timeout
        const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
        const tokensPromise = zealousAPI.getTokens(500, 0)
        const allTokens = await Promise.race([tokensPromise, timeoutPromise])

        const matchingTokens = allTokens.filter(
          (token) =>
            token.symbol.toLowerCase().includes(query.toLowerCase()) ||
            token.name.toLowerCase().includes(query.toLowerCase()) ||
            token.address.toLowerCase() === query.toLowerCase(),
        )

        // Process tokens (simplified - no price fetching)
        const tokensWithLogos = matchingTokens.slice(0, 5).map((token) => ({
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          logoURI: getTokenLogoUrl(token.logoURI),
        }))

        setTokenResults(tokensWithLogos)

        // Search for dapps
        const dapps: DappResult[] = []
        if (query.toLowerCase().includes("zealous") || query.toLowerCase().includes("swap")) {
          dapps.push({
            name: "Zealous Swap",
            slug: "zealous-swap",
            logo: "/zealous-logo.png",
            description: "Decentralized Exchange on Kasplex",
          })
        }
        setDappResults(dapps)

        // If no results found anywhere
        if (tokensWithLogos.length === 0 && dapps.length === 0 && addressResults.length === 0) {
          setError("No results found for your search")
        }
      } catch (err) {
        setError("No results found for your search")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (query) {
      performSearch()
    }
  }, [query, router, currentNetwork])

  const handleSearch = (newQuery: string) => {
    router.push(`/search/${encodeURIComponent(newQuery)}`)
  }

  if (loading) {
    return (
      <BeamsBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork={currentNetwork} onNetworkChange={handleNetworkChange} onSearch={handleSearch} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-white/70 font-orbitron font-bold">Searching for: {query}</p>
              <p className="text-white/50 font-orbitron text-sm mt-2">This may take a few moments...</p>
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
            <Button variant="ghost" onClick={() => router.push("/")} className="text-white/70 hover:text-white mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 mb-6"
            >
              <Search className="h-8 w-8 text-purple-400" />
              <h1 className="text-3xl font-bold text-white font-orbitron bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Search Results
              </h1>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl mb-6">
              <CardHeader>
                <CardTitle className="text-white font-orbitron font-bold">
                  Search Query: <code className="text-purple-400 font-mono">{query}</code>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {error && tokenResults.length === 0 && dappResults.length === 0 && addressResults.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-red-400 font-orbitron font-bold mb-4">{error}</p>
                    <p className="text-white/50 font-orbitron text-sm mb-4">Make sure you're searching for a valid:</p>
                    <ul className="text-white/70 font-orbitron text-sm space-y-2">
                      <li className="flex items-center gap-2">
                        <Cube className="h-4 w-4 text-purple-400" />
                        Block number (e.g., 123456)
                      </li>
                      <li className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-400" />
                        Transaction hash (0x...)
                      </li>
                      <li className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-green-400" />
                        Address (0x...)
                      </li>
                      <li className="flex items-center gap-2">
                        <Code className="h-4 w-4 text-blue-400" />
                        Contract address (0x...)
                      </li>
                      <li className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-yellow-400" />
                        Token name or symbol
                      </li>
                      <li className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-cyan-400" />
                        DApp name
                      </li>
                    </ul>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Address/Contract Results */}
                    {addressResults.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-orbitron">
                          {addressResults[0].isContract ? (
                            <Code className="h-5 w-5 text-blue-400" />
                          ) : (
                            <Wallet className="h-5 w-5 text-green-400" />
                          )}
                          {addressResults[0].isContract ? "Contracts" : "Addresses"} ({addressResults.length})
                        </h3>
                        <div className="grid gap-4">
                          {addressResults.map((addressResult) => (
                            <Card
                              key={addressResult.address}
                              className={`${
                                addressResult.isContract
                                  ? "bg-blue-500/10 border-blue-500/20"
                                  : "bg-black/20 border-white/10"
                              } backdrop-blur-sm hover:bg-black/30 transition-colors cursor-pointer`}
                              onClick={() => router.push(`/address/${addressResult.address}`)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  {addressResult.isContract ? (
                                    <Code className="h-10 w-10 text-blue-400 p-2 bg-blue-400/20 rounded-full" />
                                  ) : (
                                    <Wallet className="h-10 w-10 text-green-400 p-2 bg-green-400/20 rounded-full" />
                                  )}
                                  <div className="flex-1">
                                    <div className="text-white font-bold font-orbitron text-lg">
                                      {addressResult.isContract ? "Contract:" : "Address:"}{" "}
                                      {addressResult.contractName || ""}
                                    </div>
                                    <div className="text-white/70 text-sm font-orbitron">
                                      {addressResult.isContract
                                        ? `Smart Contract${addressResult.contractType ? ` (${addressResult.contractType})` : ""}`
                                        : "Externally Owned Account"}
                                    </div>
                                    <div className="text-white/50 text-xs font-mono">
                                      {addressResult.address.slice(0, 10)}...{addressResult.address.slice(-8)}
                                    </div>
                                    {addressResult.contractSymbol && (
                                      <div className="text-white/60 text-xs font-orbitron mt-1">
                                        Symbol: {addressResult.contractSymbol}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {addressResult.isContract ? (
                                      <Code className="h-4 w-4 text-blue-400" />
                                    ) : (
                                      <Wallet className="h-4 w-4 text-green-400" />
                                    )}
                                    <span className="text-white/70 font-orbitron text-sm font-bold">
                                      {addressResult.isContract ? "Contract" : "Address"}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Token Results */}
                    {tokenResults.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-orbitron">
                          <Coins className="h-5 w-5 text-yellow-400" />
                          Tokens ({tokenResults.length})
                        </h3>
                        <div className="grid gap-4">
                          {tokenResults.map((token) => (
                            <Card
                              key={token.address}
                              className="bg-black/20 border-white/10 backdrop-blur-sm hover:bg-black/30 transition-colors cursor-pointer"
                              onClick={() => router.push(`/tokens/${token.address}`)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={token.logoURI || "/placeholder.svg"}
                                    alt={token.symbol}
                                    className="h-10 w-10 rounded-full flex-shrink-0"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement
                                      target.src = "/placeholder.svg?height=40&width=40"
                                    }}
                                  />
                                  <div className="flex-1">
                                    <div className="text-white font-bold font-orbitron text-lg">{token.symbol}</div>
                                    <div className="text-white/70 text-sm font-orbitron">{token.name}</div>
                                    <div className="text-white/50 text-xs font-mono">
                                      {token.address.slice(0, 10)}...{token.address.slice(-8)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Coins className="h-4 w-4 text-yellow-400" />
                                    <span className="text-white/70 font-orbitron text-sm font-bold">Token</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* DApp Results */}
                    {dappResults.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 font-orbitron">
                          <Activity className="h-5 w-5 text-cyan-400" />
                          DApps ({dappResults.length})
                        </h3>
                        <div className="grid gap-4">
                          {dappResults.map((dapp) => (
                            <Card
                              key={dapp.slug}
                              className="bg-black/20 border-white/10 backdrop-blur-sm hover:bg-black/30 transition-colors cursor-pointer"
                              onClick={() => router.push(`/dapps/${dapp.slug}`)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={dapp.logo || "/placeholder.svg"}
                                    alt={dapp.name}
                                    className="h-12 w-12 rounded-xl"
                                  />
                                  <div className="flex-1">
                                    <div className="text-white font-bold text-lg font-orbitron">{dapp.name}</div>
                                    <div className="text-white/70 font-orbitron">{dapp.description}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-cyan-400" />
                                    <span className="text-white/70 font-orbitron text-sm font-bold">DApp</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
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
