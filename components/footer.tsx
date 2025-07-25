"use client"

import { motion } from "motion/react"
import { Heart } from "lucide-react"
import { useRouter } from "next/navigation"

export default function Footer() {
  const router = useRouter()

  const handleLogoClick = () => {
    router.push("/")
  }

  const handleKasperClick = () => {
    window.open("https://x.com/kaspercoin", "_blank", "noopener,noreferrer")
  }

  return (
    <footer className="relative z-20 border-t border-white/10 bg-black/20 backdrop-blur-xl mt-16">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-3 mb-4 md:mb-0 cursor-pointer" onClick={handleLogoClick}>
            <img src="/dagscan-logo.webp" alt="DagScan" className="h-8 w-8" />
            <span className="text-lg font-bold text-white font-orbitron bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              DagScan
            </span>
          </div>

          <motion.div
            className="flex items-center space-x-2 text-white/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <span className="font-rajdhani">Made by</span>
            <span
              className="font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-orbitron cursor-pointer hover:from-purple-300 hover:to-pink-300 transition-all duration-200"
              onClick={handleKasperClick}
            >
              KASPER
            </span>
            <span className="font-rajdhani">with</span>
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            >
              <Heart className="h-4 w-4 text-red-400 fill-current" />
            </motion.div>
          </motion.div>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10 text-center text-sm text-white/50">
          <p className="font-rajdhani">Exploring the Kaspa EVM ecosystem • Built for the community</p>
        </div>
      </div>
    </footer>
  )
}
