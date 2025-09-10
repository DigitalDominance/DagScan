"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, BarChart3, X, Maximize2, Minimize2, ZoomIn, ZoomOut, Move } from "lucide-react"
import { ZealousAPI } from "@/lib/zealous-api"
import { KasplexAPI } from "@/lib/api"
import { LFGAPI } from "@/lib/lfg-api"
import { useNetwork } from "@/context/NetworkContext"

interface TokenPriceChartProps {
  tokenAddress: string
  tokenSymbol: string
  apiType?: "zealous" | "kasplex" | "lfg"
}

interface ChartPoint {
  x: number
  y: number
  timestamp: string
  price: number
  marketCap?: number
}

interface TooltipData {
  x: number
  y: number
  price: number
  marketCap: number
  timestamp: string
  visible: boolean
}

export default function TokenPriceChart({ tokenAddress, tokenSymbol, apiType = "zealous" }: TokenPriceChartProps) {
  const { currentNetwork } = useNetwork();

  const [priceData, setPriceData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<"1H" | "24H" | "7D" | "30D" | "90D" | "ALL">("24H")
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [priceChange, setPriceChange] = useState<number>(0)
  const [marketCap, setMarketCap] = useState<number>(0)
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [panOffset, setPanOffset] = useState<number>(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipData>({
    x: 0,
    y: 0,
    price: 0,
    marketCap: 0,
    timestamp: "",
    visible: false,
  })
  const [tokenSupply, setTokenSupply] = useState<number>(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; panOffset: number }>({ x: 0, panOffset: 0 })
  const [isZooming, setIsZooming] = useState(false)
  const [initialZoomData, setInitialZoomData] = useState<{
    zoom: number
    pan: number
    distance: number
    center: { x: number; y: number }
  } | null>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [containerHeight, setContainerHeight] = useState(300)
  const [showCrosshair, setShowCrosshair] = useState(false)
  const [crosshairPosition, setCrosshairPosition] = useState({ x: 0, y: 0 })
  const chartRef = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLDivElement>(null)

  const zealousAPI = new ZealousAPI()
  const kasplexAPI = new KasplexAPI(currentNetwork)
  const lfgAPI = new LFGAPI()

  const formatTimeLabel = (dateString: string, isShortRange: boolean) => {
    const date = new Date(dateString)
    if (isShortRange) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "$0.00"
    }
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`
    }
    if (value >= 1) {
      return `$${value.toFixed(4)}`
    }
    if (value >= 0.001) {
      return `$${value.toFixed(6)}`
    }
    return `$${value.toFixed(8)}`
  }

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "0.00%"
    }
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value.toFixed(2)}%`
  }

  useEffect(() => {
    const updateDimensions = () => {
      const ref = isFullscreen ? fullscreenRef.current : chartRef.current
      if (ref) {
        const rect = ref.getBoundingClientRect()
        setContainerWidth(rect.width || 800)

        if (isFullscreen) {
          const viewportHeight = window.innerHeight
          const headerHeight = 140
          const footerHeight = 60
          setContainerHeight(Math.max(400, viewportHeight - headerHeight - footerHeight))
        } else {
          setContainerHeight(280)
        }
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    window.addEventListener("orientationchange", updateDimensions)

    return () => {
      window.removeEventListener("resize", updateDimensions)
      window.removeEventListener("orientationchange", updateDimensions)
    }
  }, [isFullscreen])

  const fetchTokenSupply = async (address: string): Promise<number> => {
    try {
      const totalSupplyMethodId = "0x18160ddd"

      const result = await kasplexAPI.rpcCall("eth_call", [
        {
          to: address,
          data: totalSupplyMethodId,
        },
        "latest",
      ])

      if (result && result !== "0x") {
        const supply = Number.parseInt(result, 16) / Math.pow(10, 18)
        return supply
      }

      return Math.random() * 1000000000
    } catch (error) {
      console.warn("Failed to fetch token supply from RPC:", error)
      return Math.random() * 1000000000
    }
  }

  useEffect(() => {
    const fetchSupply = async () => {
      const supply = await fetchTokenSupply(tokenAddress)
      setTokenSupply(supply)
    }
    fetchSupply()
  }, [tokenAddress])

  useEffect(() => {
    const fetchPriceData = async () => {
      try {
        setLoading(true)
        setError(null)

        if (apiType === "lfg") {
          const lfgData = await lfgAPI.getTokenHistory(tokenAddress)
          if (lfgData && lfgData.points && lfgData.points.length > 0) {
            const prices = lfgData.points.map((point: any) => ({
              timestamp: new Date(point.t).toISOString(),
              priceUSD: point.price || 0,
            }))

            const mostRecentPrice = prices[prices.length - 1]?.priceUSD || 0
            setCurrentPrice(mostRecentPrice)
            setMarketCap(mostRecentPrice * tokenSupply)
          }
        } else {
          try {
            const currentPriceData = await zealousAPI.getCurrentTokenPrice(tokenAddress)
            if (currentPriceData && typeof currentPriceData.priceUSD === "number") {
              setCurrentPrice(currentPriceData.priceUSD)
              const calculatedMarketCap = currentPriceData.priceUSD * tokenSupply
              setMarketCap(calculatedMarketCap)
            }
          } catch (currentPriceError) {
            console.warn("Could not fetch current price:", currentPriceError)
          }
        }

        const now = new Date()

        let limit: number
        switch (timeRange) {
          case "1H":
            limit = 1440
            break
          case "24H":
            limit = 2880
            break
          case "7D":
            limit = 10080
            break
          case "30D":
            limit = 43200
            break
          case "90D":
            limit = 129600
            break
          default:
            limit = 10000
        }

        let prices: any[] = []
        if (apiType === "lfg") {
          const lfgData = await lfgAPI.getTokenHistory(tokenAddress)
          if (lfgData && lfgData.points && lfgData.points.length > 0) {
            prices = lfgData.points.map((point: any) => ({
              timestamp: new Date(point.t).toISOString(),
              priceUSD: point.price || 0,
            }))

            const mostRecentPrice = prices[prices.length - 1]?.priceUSD || 0
            setCurrentPrice(mostRecentPrice)
            setMarketCap(mostRecentPrice * tokenSupply)
          }
        } else {
          prices = await zealousAPI.getTokenPrice(tokenAddress, limit, 0)
        }

        if (!prices || prices.length === 0) {
          setError("No price data available")
          return
        }

        prices.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

        const validPrices = prices.filter((price) => {
          const priceDate = new Date(price.timestamp)
          const isValidPrice = typeof price.priceUSD === "number" && !isNaN(price.priceUSD) && price.priceUSD > 0
          const isNotFuture = priceDate <= now
          return isValidPrice && isNotFuture
        })

        if (validPrices.length === 0) {
          setError("No valid price data available")
          return
        }

        let filteredPrices: any[] = []
        if (timeRange === "ALL") {
          filteredPrices = validPrices
        } else {
          const mostRecentTime = new Date(validPrices[validPrices.length - 1].timestamp)
          let startTime: Date

          switch (timeRange) {
            case "1H":
              startTime = new Date(mostRecentTime.getTime() - 60 * 60 * 1000)
              break
            case "24H":
              startTime = new Date(mostRecentTime.getTime() - 24 * 60 * 60 * 1000)
              break
            case "7D":
              startTime = new Date(mostRecentTime.getTime() - 7 * 24 * 60 * 60 * 1000)
              break
            case "30D":
              startTime = new Date(mostRecentTime.getTime() - 30 * 24 * 60 * 60 * 1000)
              break
            case "90D":
              startTime = new Date(mostRecentTime.getTime() - 90 * 24 * 60 * 60 * 1000)
              break
            default:
              startTime = new Date(0)
          }

          filteredPrices = validPrices.filter((price) => {
            const priceDate = new Date(price.timestamp)
            return priceDate >= startTime
          })
        }

        if (filteredPrices.length === 0) {
          console.warn(`No data available for ${timeRange} range, showing most recent data`)
          filteredPrices = validPrices.slice(-Math.min(100, validPrices.length))
        }

        if (timeRange === "1H" && filteredPrices.length > 60) {
          filteredPrices = filteredPrices.slice(-60)
        }

        const chartData = filteredPrices.map((price, index) => ({
          x: index,
          y: price.priceUSD || 0,
          timestamp: price.timestamp,
          price: price.priceUSD || 0,
          marketCap: (price.priceUSD || 0) * tokenSupply,
        }))

        setPriceData(chartData)

        if (filteredPrices.length > 1) {
          const oldPrice = filteredPrices[0].priceUSD || 0
          const newPrice = filteredPrices[filteredPrices.length - 1].priceUSD || 0
          if (oldPrice > 0) {
            setPriceChange(((newPrice - oldPrice) / oldPrice) * 100)
          }
        }
      } catch (err) {
        console.error("Failed to fetch price data:", err)
        setError("Failed to load price data")
      } finally {
        setLoading(false)
      }
    }

    if (tokenSupply > 0) {
      fetchPriceData()
    }
  }, [tokenAddress, timeRange, tokenSupply, apiType])

  useEffect(() => {
    setZoomLevel(1)
    setPanOffset(0)
  }, [timeRange, isFullscreen])

  const handleChartHover = useCallback(
    (event: React.MouseEvent, point?: ChartPoint) => {
      if (isDragging || isZooming) return

      const rect = (isFullscreen ? fullscreenRef.current : chartRef.current)?.getBoundingClientRect()
      if (!rect) return

      const chartAreaLeft = isFullscreen ? 80 : 60
      const x = event.clientX - rect.left - chartAreaLeft
      const y = event.clientY - rect.top

      if (x >= 0 && x <= rect.width - chartAreaLeft) {
        setCrosshairPosition({ x: x + chartAreaLeft, y })
        setShowCrosshair(true)
      }

      if (point) {
        const mouseX = event.clientX - rect.left
        const mouseY = event.clientY - rect.top
        const containerWidth = rect.width
        const containerHeight = rect.height

        let tooltipX = mouseX + 15
        let tooltipY = mouseY - 80

        if (tooltipX + 220 > containerWidth) {
          tooltipX = mouseX - 235
        }

        if (tooltipY < 10) {
          tooltipY = mouseY + 15
        }

        if (tooltipY + 120 > containerHeight) {
          tooltipY = containerHeight - 130
        }

        if (tooltipX < 10) {
          tooltipX = 10
        }

        setTooltip({
          x: tooltipX,
          y: tooltipY,
          price: point.price,
          marketCap: point.marketCap || 0,
          timestamp: point.timestamp,
          visible: true,
        })
      }
    },
    [isDragging, isZooming, isFullscreen],
  )

  const handleChartLeave = useCallback(() => {
    setShowCrosshair(false)
    closeTooltip()
  }, [])

  const closeTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }))
  }, [])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen)
    closeTooltip()
    setZoomLevel(1)
    setPanOffset(0)
  }, [isFullscreen, closeTooltip])

  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev * 1.5, 10))
  }, [])

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev / 1.5, 0.5))
  }, [])

  const resetZoom = useCallback(() => {
    setZoomLevel(1)
    setPanOffset(0)
  }, [])

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!isFullscreen) return

      event.preventDefault()
      event.stopPropagation()

      const rect = fullscreenRef.current?.getBoundingClientRect()
      if (!rect) return

      const mouseX = event.clientX - rect.left
      const containerWidth = rect.width
      const zoomPoint = mouseX / containerWidth

      const oldPanOffset = panOffset
      const oldZoomLevel = zoomLevel

      let newZoomLevel: number
      if (event.deltaY < 0) {
        newZoomLevel = Math.min(oldZoomLevel * 1.2, 10)
      } else {
        newZoomLevel = Math.max(oldZoomLevel / 1.2, 0.5)
      }

      const zoomRatio = newZoomLevel / oldZoomLevel
      const newPanOffset = oldPanOffset * zoomRatio + mouseX * (1 - zoomRatio)

      setZoomLevel(newZoomLevel)
      setPanOffset(newPanOffset)
    },
    [isFullscreen, panOffset, zoomLevel],
  )

  const getTouchDistance = useCallback((touches: TouchList) => {
    if (touches.length < 2) return 0
    const touch1 = touches[0]
    const touch2 = touches[1]
    return Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2))
  }, [])

  const getTouchCenter = useCallback((touches: TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 }
    const touch1 = touches[0]
    const touch2 = touches[1]
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    }
  }, [])

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!isFullscreen) return

      event.preventDefault()
      setIsDragging(true)
      setDragStart({ x: event.clientX, panOffset })
      closeTooltip()
    },
    [isFullscreen, panOffset, closeTooltip],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isFullscreen || !isDragging) return

      event.preventDefault()
      const deltaX = event.clientX - dragStart.x
      const newPanOffset = dragStart.panOffset + deltaX
      setPanOffset(newPanOffset)
    },
    [isFullscreen, isDragging, dragStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!isFullscreen) return

      event.preventDefault()
      event.stopPropagation()

      const touches = event.touches

      if (touches.length === 2) {
        const distance = getTouchDistance(touches)
        const center = getTouchCenter(touches)

        setIsZooming(true)
        setIsDragging(false)
        setInitialZoomData({
          zoom: zoomLevel,
          pan: panOffset,
          distance: distance,
          center: center,
        })
        closeTooltip()
      } else if (touches.length === 1) {
        if (!isZooming) {
          setIsDragging(true)
          setIsZooming(false)
          setDragStart({ x: touches[0].clientX, panOffset })
          setInitialZoomData(null)
          closeTooltip()
        }
      } else {
        setIsDragging(false)
        setIsZooming(false)
        setInitialZoomData(null)
      }
    },
    [isFullscreen, getTouchDistance, getTouchCenter, zoomLevel, panOffset, closeTooltip, isZooming],
  )

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!isFullscreen) return

      event.preventDefault()
      event.stopPropagation()

      const touches = event.touches

      if (touches.length === 2 && isZooming && initialZoomData) {
        const currentDistance = getTouchDistance(touches)
        const currentCenter = getTouchCenter(touches)

        if (initialZoomData.distance > 10 && currentDistance > 10) {
          const scaleChange = currentDistance / initialZoomData.distance
          let newZoomLevel = initialZoomData.zoom * scaleChange

          newZoomLevel = Math.min(Math.max(newZoomLevel, 0.5), 10)

          if (Math.abs(newZoomLevel - zoomLevel) > 0.01) {
            const rect = fullscreenRef.current?.getBoundingClientRect()
            if (rect) {
              const centerX = currentCenter.x - rect.left
              const containerWidth = rect.width
              const zoomPoint = centerX / containerWidth

              const zoomRatio = newZoomLevel / zoomLevel
              const newPanOffset = panOffset * zoomRatio + centerX * (1 - zoomRatio)

              requestAnimationFrame(() => {
                setZoomLevel(newZoomLevel)
                setPanOffset(newPanOffset)
              })
            }
          }
        }
      } else if (touches.length === 1 && isDragging && !isZooming) {
        const deltaX = touches[0].clientX - dragStart.x
        const newPanOffset = dragStart.panOffset + deltaX

        if (Math.abs(newPanOffset - panOffset) > 2) {
          requestAnimationFrame(() => {
            setPanOffset(newPanOffset)
          })
        }
      }
    },
    [
      isFullscreen,
      isZooming,
      initialZoomData,
      isDragging,
      getTouchDistance,
      getTouchCenter,
      zoomLevel,
      panOffset,
      dragStart,
    ],
  )

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (!isFullscreen) return

      event.preventDefault()
      event.stopPropagation()

      const touches = event.touches

      if (touches.length === 0) {
        setIsDragging(false)
        setIsZooming(false)
        setInitialZoomData(null)
      } else if (touches.length === 1 && isZooming) {
        setIsZooming(false)
        setIsDragging(true)
        setDragStart({ x: touches[0].clientX, panOffset })
        setInitialZoomData(null)
      } else if (touches.length > 2) {
        setIsDragging(false)
        setIsZooming(false)
        setInitialZoomData(null)
      }
    },
    [isFullscreen, isZooming, panOffset],
  )

  const handleTouchTap = useCallback(
    (event: React.TouchEvent, point: ChartPoint) => {
      if (isZooming || isDragging) return

      event.preventDefault()
      event.stopPropagation()

      const touch = event.touches[0] || event.changedTouches[0]
      const rect = (isFullscreen ? fullscreenRef.current : chartRef.current)?.getBoundingClientRect()
      if (!rect || !touch) return

      let tooltipX = touch.clientX - rect.left + 15
      let tooltipY = touch.clientY - rect.top - 80

      if (tooltipX + 220 > rect.width) {
        tooltipX = touch.clientX - rect.left - 235
      }

      if (tooltipY < 10) {
        tooltipY = touch.clientY - rect.top + 15
      }

      if (tooltipY + 120 > rect.height) {
        tooltipY = rect.height - rect.top - 130
      }

      if (tooltipX < 10) {
        tooltipX = 10
      }

      setTooltip({
        x: tooltipX,
        y: tooltipY,
        price: point.price,
        marketCap: point.marketCap || 0,
        timestamp: point.timestamp,
        visible: true,
      })
    },
    [isZooming, isDragging, isFullscreen],
  )

  const AdvancedChart = useCallback(
    ({ data, isFullscreenMode = false }: { data: ChartPoint[]; isFullscreenMode?: boolean }) => {
      if (data.length === 0) return null

      const validData = data.filter((d) => typeof d.y === "number" && !isNaN(d.y))
      if (validData.length === 0) return null

      const minPrice = Math.min(...validData.map((d) => d.y))
      const maxPrice = Math.max(...validData.map((d) => d.y))
      const priceRange = maxPrice - minPrice
      const padding = priceRange * 0.1

      const chartHeight = containerHeight
      const containerRef = isFullscreenMode ? fullscreenRef : chartRef
      const chartWidth = containerWidth - 20

      const isShortRange = timeRange === "1H" || timeRange === "24H"

      const createSmoothPath = (points: ChartPoint[]) => {
        if (points.length < 2) return ""

        const coords = points.map((point, index) => ({
          x: (index / (points.length - 1)) * chartWidth,
          y: chartHeight - ((point.y - minPrice + padding) / (priceRange + 2 * padding)) * chartHeight,
        }))

        let path = `M ${coords[0].x} ${coords[0].y}`

        for (let i = 1; i < coords.length; i++) {
          const prev = coords[i - 1]
          const curr = coords[i]
          const next = coords[i + 1]

          if (i === 1) {
            const cp1x = prev.x + (curr.x - prev.x) * 0.3
            const cp1y = prev.y
            const cp2x = curr.x - (curr.x - prev.x) * 0.3
            const cp2y = curr.y
            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`
          } else if (i === coords.length - 1) {
            const cp1x = prev.x + (curr.x - prev.x) * 0.3
            const cp1y = prev.y + (curr.y - prev.y) * 0.3
            const cp2x = curr.x - (curr.x - prev.x) * 0.3
            const cp2y = curr.y - (curr.y - prev.y) * 0.3
            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`
          } else {
            const cp1x = prev.x + (curr.x - prev.x) * 0.3
            const cp1y = prev.y + (curr.y - prev.y) * 0.3
            const cp2x = curr.x - (next.x - prev.x) * 0.1
            const cp2y = curr.y - (next.y - prev.y) * 0.1
            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`
          }
        }

        return path
      }

      const pathData = createSmoothPath(validData)
      const areaData = `${pathData} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`

      let currentTransform = "none"
      if (isFullscreenMode) {
        const scaleX = zoomLevel
        const translateX = panOffset / zoomLevel
        currentTransform = `scaleX(${scaleX}) translateX(${translateX}px)`
      }

      return (
        <div
          className={`w-full relative overflow-hidden ${isFullscreenMode ? "h-full" : ""}`}
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            touchAction: "none",
            cursor: isFullscreenMode ? (isDragging ? "grabbing" : "grab") : "default",
            userSelect: "none",
            height: isFullscreenMode ? `${containerHeight}px` : "280px",
            willChange: isFullscreenMode ? "transform" : "auto",
            zIndex: 1,
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
            perspective: 1000,
          }}
        >
          <div
            className="h-full w-full relative"
            style={{
              transform: currentTransform,
              transformOrigin: "left center",
              willChange: isFullscreenMode ? "transform" : "auto",
              zIndex: 2,
              backfaceVisibility: "hidden",
              transform3d: "translate3d(0,0,0)",
            }}
            onMouseMove={handleChartHover}
            onMouseLeave={handleChartLeave}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="overflow-visible"
              preserveAspectRatio="none"
              style={{ willChange: "auto", zIndex: 3 }}
            >
              <defs>
                <linearGradient id="priceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="50%" stopColor="#EC4899" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
                  <stop offset="33%" stopColor="#EC4899" stopOpacity="0.2" />
                  <stop offset="66%" stopColor="#3B82F6" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#1E1B4B" stopOpacity="0.05" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
                <line
                  key={ratio}
                  x1="0"
                  y1={chartHeight * ratio}
                  x2={chartWidth}
                  y2={chartHeight * ratio}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="1,3"
                  strokeWidth="0.5"
                />
              ))}

              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                <line
                  key={`v-${ratio}`}
                  x1={chartWidth * ratio}
                  y1="0"
                  x2={chartWidth * ratio}
                  y2={chartHeight}
                  stroke="rgba(255,255,255,0.05)"
                  strokeDasharray="1,3"
                  strokeWidth="0.5"
                />
              ))}

              <path d={areaData} fill="url(#areaGradient)" />

              <path
                d={pathData}
                fill="none"
                stroke="url(#priceGradient)"
                strokeWidth={isFullscreenMode ? "2" : "1.5"}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glow)"
              />

              {validData.map((point, index) => {
                const x = (index / (validData.length - 1)) * chartWidth
                const y = chartHeight - ((point.y - minPrice + padding) / (priceRange + 2 * padding)) * chartHeight
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r={isFullscreenMode ? "6" : "4"}
                    fill="url(#priceGradient)"
                    stroke="rgba(0,0,0,0.6)"
                    strokeWidth="1"
                    className="opacity-0 hover:opacity-100 transition-all duration-200 cursor-pointer"
                    onClick={(e) => handleChartHover(e, point)}
                    onMouseEnter={(e) => handleChartHover(e, point)}
                    onMouseLeave={closeTooltip}
                    onTouchStart={(e) => handleTouchTap(e, point)}
                    filter="url(#glow)"
                    style={{ touchAction: "none" }}
                  />
                )
              })}

              {showCrosshair && isFullscreenMode && (
                <g className="pointer-events-none">
                  <line
                    x1={crosshairPosition.x}
                    y1="0"
                    x2={crosshairPosition.x}
                    y2={chartHeight}
                    stroke="rgba(139, 92, 246, 0.5)"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <line
                    x1="0"
                    y1={crosshairPosition.y}
                    x2={chartWidth}
                    y2={crosshairPosition.y}
                    stroke="rgba(139, 92, 246, 0.5)"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                </g>
              )}
            </svg>

            <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-white/60 font-mono mt-2 px-2 pointer-events-none select-none">
              {validData.length > 0 && (
                <>
                  <span className="bg-black/50 px-2 py-1 rounded text-xs">
                    {formatTimeLabel(validData[0].timestamp, isShortRange)}
                  </span>
                  {validData.length > 2 && (
                    <span className="bg-black/50 px-2 py-1 rounded text-xs">
                      {formatTimeLabel(validData[Math.floor(validData.length / 2)].timestamp, isShortRange)}
                    </span>
                  )}
                  <span className="bg-black/50 px-2 py-1 rounded text-xs">
                    {formatTimeLabel(validData[validData.length - 1].timestamp, isShortRange)}
                  </span>
                </>
              )}
            </div>

            {tooltip.visible && (
              <div
                className="pointer-events-none select-none"
                style={{
                  position: "absolute",
                  left: tooltip.x,
                  top: tooltip.y,
                  zIndex: 9999,
                }}
              >
                <div className="bg-black/95 border border-purple-500/50 rounded-xl p-4 text-white text-sm backdrop-blur-xl max-w-xs shadow-2xl">
                  <button
                    onClick={closeTooltip}
                    className="absolute top-2 right-2 text-white/50 hover:text-white pointer-events-auto transition-colors z-10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="space-y-2">
                    <div className="text-purple-400 font-bold text-base">{formatCurrency(tooltip.price)}</div>
                    <div className="text-blue-400 text-sm">Market Cap: {formatCurrency(tooltip.marketCap)}</div>
                    <div className="text-white/70 text-xs font-mono">
                      {timeRange === "1H" || timeRange === "24H"
                        ? new Date(tooltip.timestamp).toLocaleString()
                        : new Date(tooltip.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isFullscreenMode && (
            <div className="hidden md:flex absolute top-4 right-4 flex-col gap-2 bg-black/90 rounded-lg p-2 border border-white/30 backdrop-blur-sm z-[10000]">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  zoomIn()
                }}
                className="text-white hover:bg-white/20 p-1 h-10 w-10"
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  zoomOut()
                }}
                className="text-white hover:bg-white/20 p-1 h-10 w-10"
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  resetZoom()
                }}
                className="text-white hover:bg-white/20 p-1 h-10 w-10"
              >
                <Move className="h-5 w-5" />
              </Button>
              {zoomLevel !== 1 && (
                <div className="text-xs text-white/70 text-center font-mono bg-black/50 px-2 py-1 rounded">
                  {zoomLevel.toFixed(1)}x
                </div>
              )}
            </div>
          )}
        </div>
      )
    },
    [
      containerHeight,
      containerWidth,
      timeRange,
      zoomLevel,
      panOffset,
      handleWheel,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      isDragging,
      isFullscreen,
      showCrosshair,
      crosshairPosition,
      tooltip,
      closeTooltip,
      initialZoomData,
      zoomIn,
      zoomOut,
      resetZoom,
    ],
  )

  if (loading) {
    return (
      <Card className="bg-black border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/20 backdrop-blur-xl w-full">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mr-3"></div>
            <span className="text-white/80">Loading advanced chart...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-black border-2 border-red-500/50 shadow-lg shadow-red-500/20 backdrop-blur-xl w-full">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-red-400" />
            {tokenSymbol} Price Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-400 py-8">{error}</div>
        </CardContent>
      </Card>
    )
  }

  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black backdrop-blur-xl border-4 border-purple-500/30 shadow-2xl shadow-purple-500/10"
        style={{
          userSelect: "none",
          touchAction: "none",
        }}
      >
        <div className="h-full flex flex-col">
          <div
            className="flex-shrink-0 bg-black/50 border-b border-purple-500/30 backdrop-blur-xl"
            style={{ zIndex: 1000 }}
          >
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white truncate flex-1 mr-4">{tokenSymbol} Advanced Chart</h2>
                <Button
                  variant="outline"
                  onClick={toggleFullscreen}
                  className="bg-black/60 border-purple-500/30 text-white hover:bg-purple-500/20 flex-shrink-0"
                  size="sm"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1">
                  <div className="text-2xl font-bold text-white truncate">{formatCurrency(currentPrice)}</div>
                  <div className={`flex items-center gap-2 ${priceChange >= 0 ? "text-purple-400" : "text-pink-400"}`}>
                    {priceChange >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    <span className="font-bold text-lg">{formatPercent(priceChange)}</span>
                  </div>
                </div>

                <Select value={timeRange} onValueChange={(value) => setTimeRange(value as typeof timeRange)}>
                  <SelectTrigger className="w-24 bg-black/60 border-purple-500/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-black/95 border-purple-500/30 text-white">
                    <SelectItem value="1H">1H</SelectItem>
                    <SelectItem value="24H">24H</SelectItem>
                    <SelectItem value="7D">7D</SelectItem>
                    <SelectItem value="30D">30D</SelectItem>
                    <SelectItem value="90D">90D</SelectItem>
                    <SelectItem value="ALL">ALL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-4 py-2" style={{ zIndex: 1 }}>
            <AdvancedChart data={priceData} isFullscreenMode={true} />
          </div>

          <div
            className="flex-shrink-0 bg-black/50 border-t border-purple-500/30 backdrop-blur-xl p-3 text-center"
            style={{ zIndex: 1000 }}
          >
            <div className="text-xs text-white/60">
              <div className="hidden sm:block">
                🖱️ Scroll to zoom • 👆 Pinch to zoom • 🖐️ Drag to pan • 🎯 Hover for crosshair
              </div>
              <div className="sm:hidden">👆 Pinch to zoom • 🖐️ Drag to pan • 🎯 Tap for details</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="bg-black border-2 border-purple-500/50 shadow-lg shadow-purple-500/20 backdrop-blur-xl w-full overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-white flex items-center gap-2 mb-3">
              <BarChart3 className="h-5 w-5 text-purple-400 flex-shrink-0" />
              <span className="truncate">{tokenSymbol} Price Chart</span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="text-2xl font-bold text-white">{formatCurrency(currentPrice)}</div>
              <div className={`flex items-center gap-2 ${priceChange >= 0 ? "text-purple-400" : "text-pink-400"}`}>
                {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span className="font-bold">{formatPercent(priceChange)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-shrink-0">
            <Button
              variant="outline"
              onClick={toggleFullscreen}
              className="bg-black/60 border-purple-500/30 text-white hover:bg-purple-500/20 w-full sm:w-auto"
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              Advanced View
            </Button>
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as typeof timeRange)}>
              <SelectTrigger className="w-full sm:w-36 bg-black/60 border-purple-500/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/95 border-purple-500/30 text-white">
                <SelectItem value="1H">1 Hour</SelectItem>
                <SelectItem value="24H">24 Hours</SelectItem>
                <SelectItem value="7D">7 Days</SelectItem>
                <SelectItem value="30D">30 Days</SelectItem>
                <SelectItem value="90D">90 Days</SelectItem>
                <SelectItem value="ALL">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden px-6 pb-6">
        <div className="px-4 overflow-hidden">
          <AdvancedChart data={priceData} />
        </div>
        <div className="text-xs text-white/50 mt-3 text-center">
          <div className="hidden sm:block">Hover data points for details • Use Advanced View for zoom controls</div>
          <div className="sm:hidden">Tap data points for details • Use Advanced View for full features</div>
        </div>
      </CardContent>
    </Card>
  )
}
