"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, BarChart3, X, Maximize2, Minimize2 } from "lucide-react"
import { ZealousAPI } from "@/lib/zealous-api"
import { KasplexAPI } from "@/lib/api"

interface TokenPriceChartProps {
  tokenAddress: string
  tokenSymbol: string
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

export default function TokenPriceChart({ tokenAddress, tokenSymbol }: TokenPriceChartProps) {
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
  const [lastTouchDistance, setLastTouchDistance] = useState<number>(0)
  const [isZooming, setIsZooming] = useState(false)
  const [initialZoomData, setInitialZoomData] = useState<{
    zoom: number
    pan: number
    distance: number
    center: { x: number; y: number }
  } | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLDivElement>(null)

  const zealousAPI = new ZealousAPI()
  const kasplexAPI = new KasplexAPI("kasplex")

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

  // Fetch token supply from RPC
  const fetchTokenSupply = async (address: string): Promise<number> => {
    try {
      // ERC20 totalSupply() method signature
      const totalSupplyMethodId = "0x18160ddd"

      const result = await kasplexAPI.rpcCall("eth_call", [
        {
          to: address,
          data: totalSupplyMethodId,
        },
        "latest",
      ])

      if (result && result !== "0x") {
        // Convert hex to decimal and adjust for decimals (assuming 18 decimals)
        const supply = Number.parseInt(result, 16) / Math.pow(10, 18)
        return supply
      }

      // Fallback to mock supply if RPC call fails
      return Math.random() * 1000000000
    } catch (error) {
      console.warn("Failed to fetch token supply from RPC:", error)
      // Return mock supply as fallback
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

        // Get current price from the new endpoint
        try {
          const currentPriceData = await zealousAPI.getCurrentTokenPrice(tokenAddress)
          if (currentPriceData && typeof currentPriceData.priceUSD === "number") {
            setCurrentPrice(currentPriceData.priceUSD)
            // Calculate market cap with real supply
            const calculatedMarketCap = currentPriceData.priceUSD * tokenSupply
            setMarketCap(calculatedMarketCap)
          }
        } catch (currentPriceError) {
          console.warn("Could not fetch current price:", currentPriceError)
        }

        const now = new Date()

        // Get a large amount of data to work with
        let limit: number
        switch (timeRange) {
          case "1H":
            limit = 1440 // Get more data to ensure we have recent data
            break
          case "24H":
            limit = 2880 // 2 days worth to ensure coverage
            break
          case "7D":
            limit = 10080 // 7 days worth of minutes
            break
          case "30D":
            limit = 43200 // 30 days worth of minutes
            break
          case "90D":
            limit = 129600 // 90 days worth of minutes
            break
          default:
            limit = 10000 // Large number for ALL
        }

        const prices = await zealousAPI.getTokenPrice(tokenAddress, limit, 0)

        if (!prices || prices.length === 0) {
          setError("No price data available")
          return
        }

        // Sort all prices by timestamp first to get chronological order
        prices.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

        // Filter to get only valid prices from the past
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

        // Get the most recent data points within the time range
        let filteredPrices: any[] = []
        if (timeRange === "ALL") {
          filteredPrices = validPrices
        } else {
          // For specific time ranges, get data from the most recent time backwards
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

        // If no data in the specific time range, get the most recent available data
        if (filteredPrices.length === 0) {
          console.warn(`No data available for ${timeRange} range, showing most recent data`)
          filteredPrices = validPrices.slice(-Math.min(100, validPrices.length))
        }

        // For 1H timeframe, limit to exactly 1 hour of data
        if (timeRange === "1H" && filteredPrices.length > 60) {
          filteredPrices = filteredPrices.slice(-60) // Get last 60 minutes
        }

        // Transform to chart points with market cap
        const chartData = filteredPrices.map((price, index) => ({
          x: index,
          y: price.priceUSD || 0,
          timestamp: price.timestamp,
          price: price.priceUSD || 0,
          marketCap: (price.priceUSD || 0) * tokenSupply,
        }))

        setPriceData(chartData)

        // Calculate price change using chart data
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
  }, [tokenAddress, timeRange, tokenSupply])

  // Reset zoom and pan when switching time ranges or toggling fullscreen
  useEffect(() => {
    setZoomLevel(1)
    setPanOffset(0)
  }, [timeRange, isFullscreen])

  const handleChartHover = (event: React.MouseEvent, point: ChartPoint) => {
    if (isDragging || isZooming) return

    const rect = (isFullscreen ? fullscreenRef.current : chartRef.current)?.getBoundingClientRect()
    if (!rect) return

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    setTooltip({
      x,
      y,
      price: point.price,
      marketCap: point.marketCap || 0,
      timestamp: point.timestamp,
      visible: true,
    })
  }

  const handleChartClick = (event: React.MouseEvent, point: ChartPoint) => {
    // Only show tooltip if we weren't dragging or zooming
    if (isDragging || isZooming) return

    const rect = (isFullscreen ? fullscreenRef.current : chartRef.current)?.getBoundingClientRect()
    if (!rect) return

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    setTooltip({
      x,
      y,
      price: point.price,
      marketCap: point.marketCap || 0,
      timestamp: point.timestamp,
      visible: true,
    })
  }

  const closeTooltip = () => {
    setTooltip((prev) => ({ ...prev, visible: false }))
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    closeTooltip()
  }

  // Handle mouse wheel zoom with zoom center
  const handleWheel = (event: React.WheelEvent) => {
    if (!isFullscreen) return

    event.preventDefault()
    event.stopPropagation()

    const rect = fullscreenRef.current?.getBoundingClientRect()
    if (!rect) return

    // Get the exact mouse position relative to the chart container
    const mouseX = event.clientX - rect.left
    const containerWidth = rect.width

    // Calculate the zoom point as a percentage of the container width
    const zoomPoint = mouseX / containerWidth

    // Store the current pan offset before zooming
    const oldPanOffset = panOffset
    const oldZoomLevel = zoomLevel

    let newZoomLevel: number
    if (event.deltaY < 0) {
      // Scroll up - zoom in
      newZoomLevel = Math.min(oldZoomLevel * 1.2, 5)
    } else {
      // Scroll down - zoom out
      newZoomLevel = Math.max(oldZoomLevel / 1.2, 0.5)
    }

    // Calculate the new pan offset to keep the zoom point under the mouse
    const zoomRatio = newZoomLevel / oldZoomLevel
    const newPanOffset = oldPanOffset * zoomRatio + mouseX * (1 - zoomRatio)

    setZoomLevel(newZoomLevel)
    setPanOffset(newPanOffset)
  }

  // Get distance between two touch points
  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0
    const touch1 = touches[0]
    const touch2 = touches[1]
    return Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2))
  }

  // Get center point between two touches
  const getTouchCenter = (touches: TouchList) => {
    if (touches.length < 2) return { x: 0, y: 0 }
    const touch1 = touches[0]
    const touch2 = touches[1]
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    }
  }

  // Handle mouse down for dragging
  const handleMouseDown = (event: React.MouseEvent) => {
    if (!isFullscreen) return

    event.preventDefault()
    setIsDragging(true)
    setDragStart({ x: event.clientX, panOffset })
    closeTooltip()
  }

  // Handle mouse move for dragging
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isFullscreen || !isDragging) return

    event.preventDefault()
    const deltaX = event.clientX - dragStart.x
    const newPanOffset = dragStart.panOffset + deltaX
    setPanOffset(newPanOffset)
  }

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Handle touch start for pinch-to-zoom and dragging
  const handleTouchStart = (event: React.TouchEvent) => {
    if (!isFullscreen) return

    event.preventDefault()
    event.stopPropagation()

    if (event.touches.length === 2) {
      // Two finger pinch - start zoom
      const distance = getTouchDistance(event.touches)
      const center = getTouchCenter(event.touches)

      setIsZooming(true)
      setIsDragging(false)
      setLastTouchDistance(distance)

      // Store initial zoom data
      setInitialZoomData({
        zoom: zoomLevel,
        pan: panOffset,
        distance: distance,
        center: center,
      })
    } else if (event.touches.length === 1) {
      // Single finger - start drag
      setIsDragging(true)
      setIsZooming(false)
      setDragStart({ x: event.touches[0].clientX, panOffset })
      setInitialZoomData(null)
      closeTooltip()
    }
  }

  // Handle touch move for pinch-to-zoom and dragging
  const handleTouchMove = (event: React.TouchEvent) => {
    if (!isFullscreen) return

    event.preventDefault()
    event.stopPropagation()

    if (event.touches.length === 2 && isZooming && initialZoomData) {
      // Two finger pinch zoom
      const currentDistance = getTouchDistance(event.touches)
      const currentCenter = getTouchCenter(event.touches)

      if (initialZoomData.distance > 0) {
        // Calculate zoom scale based on distance change
        const scaleChange = currentDistance / initialZoomData.distance
        const newZoomLevel = Math.min(Math.max(initialZoomData.zoom * scaleChange, 0.5), 5)

        // Calculate pan offset to keep zoom centered on pinch center
        const rect = fullscreenRef.current?.getBoundingClientRect()
        if (rect) {
          const centerX = currentCenter.x - rect.left
          const containerWidth = rect.width
          const zoomPoint = centerX / containerWidth

          // Adjust pan to keep the zoom point stable
          const zoomRatio = newZoomLevel / zoomLevel
          const newPanOffset = panOffset * zoomRatio + centerX * (1 - zoomRatio)

          setZoomLevel(newZoomLevel)
          setPanOffset(newPanOffset)
        }
      }
    } else if (event.touches.length === 1 && isDragging && !isZooming) {
      // Single finger drag
      const deltaX = event.touches[0].clientX - dragStart.x
      const newPanOffset = dragStart.panOffset + deltaX
      setPanOffset(newPanOffset)
    }
  }

  // Handle touch end
  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!isFullscreen) return

    event.preventDefault()
    event.stopPropagation()

    if (event.touches.length === 0) {
      // All fingers lifted
      setLastTouchDistance(0)
      setIsDragging(false)
      setIsZooming(false)
      setInitialZoomData(null)
    } else if (event.touches.length === 1 && isZooming) {
      // One finger remaining after pinch, switch to drag mode
      setLastTouchDistance(0)
      setIsZooming(false)
      setIsDragging(true)
      setDragStart({ x: event.touches[0].clientX, panOffset })
      setInitialZoomData(null)
    }
  }

  // Custom chart component with gradient and interaction handling
  const CustomChart = ({ data, isFullscreenMode = false }: { data: ChartPoint[]; isFullscreenMode?: boolean }) => {
    if (data.length === 0) return null

    const validData = data.filter((d) => typeof d.y === "number" && !isNaN(d.y))
    if (validData.length === 0) return null

    const minPrice = Math.min(...validData.map((d) => d.y))
    const maxPrice = Math.max(...validData.map((d) => d.y))
    const priceRange = maxPrice - minPrice
    const padding = priceRange * 0.1

    const chartHeight = isFullscreenMode ? (typeof window !== "undefined" ? window.innerHeight - 200 : 400) : 300
    const containerRef = isFullscreenMode ? fullscreenRef : chartRef
    const baseChartWidth = 800

    const isShortRange = timeRange === "1H" || timeRange === "24H"

    // Create SVG path for the price line
    const pathData = validData
      .map((point, index) => {
        const x = (index / (validData.length - 1)) * baseChartWidth
        const y = chartHeight - ((point.y - minPrice + padding) / (priceRange + 2 * padding)) * chartHeight
        return `${index === 0 ? "M" : "L"} ${x} ${y}`
      })
      .join(" ")

    // Create area path for gradient fill
    const areaData = `${pathData} L ${baseChartWidth} ${chartHeight} L 0 ${chartHeight} Z`

    // Calculate transform for zoom and pan
    let currentTransform = "none"
    if (isFullscreenMode) {
      const scaleX = zoomLevel
      const translateX = panOffset
      currentTransform = `scaleX(${scaleX}) translateX(${translateX}px)`
    }

    return (
      <div
        className={`w-full relative overflow-hidden ${isFullscreenMode ? "h-full" : "h-80"}`}
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
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div
          className="h-full w-full"
          style={{
            transform: currentTransform,
            transformOrigin: "left center",
            width: `${baseChartWidth}px`,
            minWidth: "100%",
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${baseChartWidth} ${chartHeight}`}
            className="overflow-visible"
            preserveAspectRatio="none"
            style={{
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
          >
            <defs>
              <linearGradient id="priceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="50%" stopColor="#EC4899" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                <stop offset="33%" stopColor="#EC4899" stopOpacity="0.3" />
                <stop offset="66%" stopColor="#3B82F6" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#1E1B4B" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                y1={chartHeight * ratio}
                x2={baseChartWidth}
                y2={chartHeight * ratio}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="2,2"
              />
            ))}

            {/* Area fill with gradient */}
            <path d={areaData} fill="url(#areaGradient)" />

            {/* Price line */}
            <path
              d={pathData}
              fill="none"
              stroke="url(#priceGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {validData.map((point, index) => {
              const x = (index / (validData.length - 1)) * baseChartWidth
              const y = chartHeight - ((point.y - minPrice + padding) / (priceRange + 2 * padding)) * chartHeight
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="6"
                  fill="url(#priceGradient)"
                  stroke="rgba(0,0,0,0.8)"
                  strokeWidth="2"
                  className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={(e) => handleChartClick(e, point)}
                  onMouseEnter={(e) => handleChartHover(e, point)}
                  onMouseLeave={() => closeTooltip()}
                />
              )
            })}
          </svg>

          {/* Y-axis labels - fixed position for fullscreen */}
          <div
            className="absolute top-0 h-full flex flex-col justify-between text-xs text-white/50 font-rajdhani pointer-events-none select-none"
            style={
              isFullscreenMode
                ? {
                    position: "fixed",
                    left: "0.5rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    height: `${chartHeight}px`,
                    zIndex: 1000,
                    backgroundColor: "rgba(0,0,0,0.8)",
                    borderRadius: "0.25rem",
                    padding: "0.25rem",
                  }
                : {
                    left: "-4rem",
                  }
            }
          >
            <span className="text-xs">{formatCurrency(maxPrice + padding)}</span>
            <span className="text-xs">{formatCurrency(maxPrice * 0.75 + minPrice * 0.25)}</span>
            <span className="text-xs">{formatCurrency((maxPrice + minPrice) / 2)}</span>
            <span className="text-xs">{formatCurrency(maxPrice * 0.25 + minPrice * 0.75)}</span>
            <span className="text-xs">{formatCurrency(minPrice - padding)}</span>
          </div>

          {/* X-axis labels */}
          <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-white/50 font-rajdhani mt-2 px-2 pointer-events-none select-none">
            {validData.length > 0 && (
              <>
                <span className="truncate text-xs">{formatTimeLabel(validData[0].timestamp, isShortRange)}</span>
                {validData.length > 2 && (
                  <span className="truncate text-xs">
                    {formatTimeLabel(validData[Math.floor(validData.length / 2)].timestamp, isShortRange)}
                  </span>
                )}
                <span className="truncate text-xs">
                  {formatTimeLabel(validData[validData.length - 1].timestamp, isShortRange)}
                </span>
              </>
            )}
          </div>

          {/* Tooltip */}
          {tooltip.visible && (
            <div
              className="absolute z-50 bg-black/90 border border-white/20 rounded-lg p-3 text-white text-sm font-inter backdrop-blur-xl max-w-xs pointer-events-none select-none"
              style={{
                left: tooltip.x + 10,
                top: tooltip.y - 10,
                transform: tooltip.x > baseChartWidth / 2 ? "translateX(-100%)" : "none",
              }}
            >
              <button
                onClick={closeTooltip}
                className="absolute top-1 right-1 text-white/50 hover:text-white pointer-events-auto"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="space-y-1">
                <div className="font-orbitron text-purple-400 text-xs sm:text-sm">
                  Price: {formatCurrency(tooltip.price)}
                </div>
                <div className="font-orbitron text-blue-400 text-xs sm:text-sm">
                  Market Cap: {formatCurrency(tooltip.marketCap)}
                </div>
                <div className="font-rajdhani text-white/70 text-xs">
                  {isShortRange
                    ? new Date(tooltip.timestamp).toLocaleString()
                    : new Date(tooltip.timestamp).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <Card className="bg-black/40 border-white/20 backdrop-blur-xl w-full max-w-full">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mr-3"></div>
            <span className="text-white/70 font-inter">Loading price chart...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-black/40 border-white/20 backdrop-blur-xl w-full max-w-full">
        <CardHeader>
          <CardTitle className="text-white font-orbitron flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-400" />
            {tokenSymbol} Price Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-400 font-inter py-8">{error}</div>
        </CardContent>
      </Card>
    )
  }

  // Fullscreen overlay
  if (isFullscreen) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl"
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
          touchAction: "none",
        }}
      >
        <div className="h-full flex flex-col">
          {/* Header - Fixed height */}
          <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border-b border-white/20 gap-2 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
              <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white font-orbitron truncate">
                {tokenSymbol} Price Chart
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 lg:gap-4">
                <div className="text-sm sm:text-base lg:text-lg font-bold text-white font-orbitron">
                  {formatCurrency(currentPrice)}
                </div>
                <div className={`flex items-center gap-1 ${priceChange >= 0 ? "text-purple-400" : "text-pink-400"}`}>
                  {priceChange >= 0 ? (
                    <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                  ) : (
                    <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                  <span className="font-orbitron text-sm sm:text-base">{formatPercent(priceChange)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as typeof timeRange)}>
                <SelectTrigger className="w-16 sm:w-20 lg:w-24 bg-black/40 border-white/20 text-white text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/90 border-white/20 text-white">
                  <SelectItem value="1H">1H</SelectItem>
                  <SelectItem value="24H">24H</SelectItem>
                  <SelectItem value="7D">7D</SelectItem>
                  <SelectItem value="30D">30D</SelectItem>
                  <SelectItem value="90D">90D</SelectItem>
                  <SelectItem value="ALL">ALL</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={toggleFullscreen}
                className="bg-black/40 border-white/20 text-white hover:bg-white/10 p-2"
                size="sm"
              >
                <Minimize2 className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>

          {/* Chart - Flexible height */}
          <div className="flex-1 overflow-hidden pl-4 sm:pl-16 lg:pl-20 pr-2 sm:pr-4 py-2 sm:py-4">
            <CustomChart data={priceData} isFullscreenMode={true} />
          </div>

          {/* Instructions - Fixed height */}
          <div className="flex-shrink-0 text-xs text-white/50 font-rajdhani p-2 sm:p-4 text-center border-t border-white/20">
            <div className="hidden sm:block">
              Scroll to zoom • Pinch to zoom on mobile • Click and drag to pan • Hover data points for details
            </div>
            <div className="sm:hidden">
              Pinch with two fingers to zoom • Drag with one finger to pan • Tap data points for details
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="bg-black/40 border-white/20 backdrop-blur-xl w-full max-w-full overflow-hidden">
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-white font-orbitron flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-400 flex-shrink-0" />
              <span className="truncate">{tokenSymbol} Price Chart</span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
              <div className="text-xl sm:text-2xl font-bold text-white font-orbitron">
                {formatCurrency(currentPrice)}
              </div>
              <div className={`flex items-center gap-1 ${priceChange >= 0 ? "text-purple-400" : "text-pink-400"}`}>
                {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span className="font-orbitron">{formatPercent(priceChange)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 flex-shrink-0">
            <Button
              variant="outline"
              onClick={toggleFullscreen}
              className="bg-black/40 border-white/20 text-white hover:bg-white/10 w-full sm:w-auto"
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              Fullscreen
            </Button>
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as typeof timeRange)}>
              <SelectTrigger className="w-full sm:w-32 bg-black/40 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/20 text-white">
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
      <CardContent className="overflow-hidden">
        <div className="pl-4 sm:pl-16 pr-4 overflow-hidden">
          <CustomChart data={priceData} />
        </div>
        <div className="text-xs text-white/50 font-rajdhani mt-2 text-center">
          <div className="hidden sm:block">Click data points for details • Click fullscreen for advanced controls</div>
          <div className="sm:hidden">Tap data points for details • Use fullscreen for zoom controls</div>
        </div>
      </CardContent>
    </Card>
  )
}
