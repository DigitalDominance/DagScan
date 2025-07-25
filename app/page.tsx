"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import BeamsBackground from "@/components/beams-background"
import Navigation from "@/components/navigation"
import Dashboard from "@/components/dashboard"
import Footer from "@/components/footer"

export default function Home() {
  const [currentNetwork, setCurrentNetwork] = useState<"kasplex" | "igra">("kasplex")
  const router = useRouter()

  const handleNetworkChange = (network: "kasplex" | "igra") => {
    // Only allow kasplex for now
    if (network === "kasplex") {
      setCurrentNetwork(network)
    }
  }

  const handleSearch = (query: string) => {
    router.push(`/search/${encodeURIComponent(query)}`)
  }

  return (
    <BeamsBackground>
      <div className="min-h-screen flex flex-col font-inter">
        <Navigation currentNetwork={currentNetwork} onNetworkChange={handleNetworkChange} onSearch={handleSearch} />

        <main className="flex-1">
          <Dashboard network={currentNetwork} />
        </main>

        <Footer />
      </div>
    </BeamsBackground>
  )
}
