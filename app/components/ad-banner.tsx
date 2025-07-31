"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"

const adImages = ["/powadbanner.png", "/ad1.webp", "/ad2.webp", "/ad3.webp"]
const adLinks = [
  "https://www.proofofworks.com",
  "#", // placeholder for other ads
  "#",
  "#",
]

export default function AdBanner() {
  const [currentAdIndex, setCurrentAdIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % adImages.length)
    }, 5000) // Switch every 5 seconds

    return () => clearInterval(interval)
  }, [])

  const handleAdClick = () => {
    const link = adLinks[currentAdIndex]
    if (link && link !== "#") {
      window.open(link, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div className="relative w-full py-6">
      <div
        className="relative h-32 sm:h-40 overflow-hidden rounded-xl bg-gradient-to-r from-purple-900/20 to-pink-900/20 backdrop-blur-sm border border-white/10 cursor-pointer hover:border-white/20 transition-all duration-300"
        onClick={handleAdClick}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentAdIndex}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <img
              src={adImages[currentAdIndex] || "/placeholder.svg"}
              alt={currentAdIndex === 0 ? "Proof of Works - Click to visit" : `Advertisement ${currentAdIndex + 1}`}
              className="h-full w-full object-contain rounded-xl"
            />
          </motion.div>
        </AnimatePresence>

        {/* Hover overlay for POW ad */}
        {currentAdIndex === 0 && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all duration-300 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100">
            <span className="text-white font-inter text-sm bg-black/50 px-3 py-1 rounded-lg">
              Visit Proof of Works →
            </span>
          </div>
        )}

        {/* Ad indicator dots */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 space-x-2">
          {adImages.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                setCurrentAdIndex(index)
              }}
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                index === currentAdIndex ? "bg-white" : "bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
