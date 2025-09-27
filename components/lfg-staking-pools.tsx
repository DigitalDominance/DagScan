"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { motion } from "framer-motion"

interface StakingPool {
  id: string
  creator: string
  stakingToken: string
  stakingTokenDecimals: number
  stakingTokenTotalSupply: number
  stakingTokenTicker: string
  stakingTokenName: string
  rewardToken: string
  rewardTokenDecimals: number
  rewardTokenTotalSupply: number
  rewardTokenTicker: string
  rewardTokenName: string
  timeUnit: number
  rewardRatioNumerator: number
  rewardRatioDenominator: number
  totalStaked: number
  totalRewarded: number
  totalPendingRewards: number
  apr: number
  aprusd: number
  stakingTokenImage: string
  stakingTokenColorHex: string
  rewardTokenImage: string
  rewardTokenColorHex: string
}

interface StakingResponse {
  success: boolean
  result: StakingPool[]
}

export default function LFGStakingPools() {
  const [pools, setPools] = useState<StakingPool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStakingPools = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/lfg/staking")

        if (!response.ok) {
          throw new Error("Failed to fetch staking pools")
        }

        const data: StakingResponse = await response.json()
        setPools(data.result || [])
      } catch (err) {
        console.error("Failed to fetch staking pools:", err)
        setError("Failed to load staking pools")
      } finally {
        setLoading(false)
      }
    }

    fetchStakingPools()
  }, [])

  const formatCurrency = (value: number) => {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(2)}B`
    }
    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M`
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K`
    }
    return `${value.toFixed(2)}`
  }

  const formatNumber = (value: number) => {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(2)}B`
    }
    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(2)}M`
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(2)}K`
    }
    return value.toFixed(2)
  }

  const formatAPR = (apr: number) => {
    if (apr >= 1e6) {
      return `${(apr / 1e6).toFixed(1)}M%`
    } else if (apr >= 1e3) {
      return `${(apr / 1e3).toFixed(1)}K%`
    }
    return `${apr.toFixed(2)}%`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="bg-black/40 border-white/20 backdrop-blur-xl animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-white/10 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-black/40 border-white/20 backdrop-blur-xl">
        <CardContent className="p-8 text-center">
          <p className="text-red-400 font-rajdhani">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {pools.map((pool, index) => (
        <motion.div
          key={pool.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="bg-black/40 border-white/20 backdrop-blur-xl hover:bg-black/50 transition-all duration-300">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={`https://ipfs.io/ipfs/${pool.stakingTokenImage}`}
                        alt={pool.stakingTokenTicker}
                        className="w-10 h-10 rounded-full"
                        onError={(e) => {
                          e.currentTarget.src = "/digital-token.png"
                        }}
                      />
                      <img
                        src={`https://ipfs.io/ipfs/${pool.rewardTokenImage}`}
                        alt={pool.rewardTokenTicker}
                        className="w-6 h-6 rounded-full absolute -bottom-1 -right-1 border-2 border-black"
                        onError={(e) => {
                          e.currentTarget.src = "/golden-trophy-on-pedestal.png"
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white font-orbitron text-sm sm:text-base">
                        {pool.stakingTokenTicker} → {pool.rewardTokenTicker}
                      </h3>
                      <p className="text-white/70 text-xs sm:text-sm font-rajdhani">Stake {pool.stakingTokenName}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 flex-1">
                    <div className="text-center sm:text-left">
                      <p className="text-white/70 text-xs font-rajdhani">APR</p>
                      <p className="text-green-400 font-semibold font-orbitron text-sm">{formatAPR(pool.apr)}</p>
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-white/70 text-xs font-rajdhani">Total Staked</p>
                      <p className="text-purple-400 font-semibold font-orbitron text-sm">
                        {formatNumber(pool.totalStaked)}
                      </p>
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-white/70 text-xs font-rajdhani">Rewards</p>
                      <p className="text-orange-400 font-semibold font-orbitron text-sm">
                        {formatNumber(pool.totalRewarded)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">Active</Badge>
                  <Button
                    size="sm"
                    className="relative text-white font-rajdhani hover:bg-black/60 active:bg-black/80 overflow-hidden before:absolute before:inset-0 before:rounded-md before:p-[1px] before:bg-gradient-to-br before:from-green-500 before:to-blue-500 after:absolute after:inset-[1px] after:bg-black/40 after:backdrop-blur-xl after:rounded-[calc(0.375rem-1px)] hover:after:bg-black/60 active:after:bg-black/80"
                    onClick={() => window.open(`https://lfg.kaspa.com/app/stake/${pool.id}`, "_blank")}
                  >
                    <span className="relative z-10 flex items-center text-xs">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Stake
                    </span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
