"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Search } from "lucide-react"
import { KasplexAPI } from "@/lib/api"
import BeamsBackground from "@/components/beams-background"
import Navigation from "@/components/navigation"
import Footer from "@/components/footer"

export default function SearchPage() {
  const params = useParams()
  const router = useRouter()
  const [searchResult, setSearchResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = decodeURIComponent(params.query as string)
  const api = new KasplexAPI("kasplex")

  useEffect(() => {
    const performSearch = async () => {
      try {
        setLoading(true)
        const result = await api.searchByHash(query)
        setSearchResult(result)

        // Redirect to appropriate page based on result type
        if (result.type === "block") {
          router.replace(`/block/${result.number}`)
        } else if (result.type === "transaction") {
          router.replace(`/tx/${result.hash}`)
        } else if (result.type === "address") {
          router.replace(`/address/${result.address}`)
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
  }, [query, router])

  const handleSearch = (newQuery: string) => {
    router.push(`/search/${encodeURIComponent(newQuery)}`)
  }

  if (loading) {
    return (
      <BeamsBackground>
        <div className="min-h-screen flex flex-col font-inter">
          <Navigation currentNetwork="kasplex" onNetworkChange={() => {}} onSearch={handleSearch} />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-white/70 font-inter">Searching for: {query}</p>
              <p className="text-white/50 font-inter text-sm mt-2">This may take a few moments...</p>
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
              <h1 className="text-3xl font-bold text-white">Search Results</h1>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white font-inter">
                  Search Query: <code className="text-purple-400 font-mono">{query}</code>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {error ? (
                  <div className="text-center py-8">
                    <p className="text-red-400 font-inter mb-4">{error}</p>
                    <p className="text-white/50 font-inter text-sm mb-4">Make sure you're searching for a valid:</p>
                    <ul className="text-white/70 font-inter text-sm space-y-1">
                      <li>• Block number (e.g., 123456)</li>
                      <li>• Transaction hash (0x...)</li>
                      <li>• Address (0x...)</li>
                    </ul>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-white/70 font-inter">Redirecting to results...</p>
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
