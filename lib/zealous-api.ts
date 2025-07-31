const BASE_URL = "https://dagscanbackend-7220ff41cc76.herokuapp.com/api/zealous"
const TOKEN_LOGO_BASE_URL = "https://testnet.zealousswap.com/images/"

export interface ProtocolStats {
  totalTVL: number
  totalVolumeUSD: number
  poolCount: number
  updatedAt: string
  createdAt: string
}

export interface DailyVolume {
  date: string
  volumeUSD: number
}

export interface Pool {
  address: string
  token0: {
    address: string
    symbol: string
    name: string
    decimals: number
  }
  token1: {
    address: string
    symbol: string
    name: string
    decimals: number
  }
  fee: number
  volumeUSD?: number
  tvl?: number
  apr?: number
  feesUSD?: number
  hasUSDValues: boolean
  hasActiveFarm: boolean
  updatedAt: string
}

export interface TokenPrice {
  tokenAddress: string
  symbol: string
  name: string
  priceUSD: number
  logoURI: string
  poolAddress: string
  timestamp: string
  createdAt: string
}

export interface DailyTokenPrice {
  date: string
  avgPrice: number
  maxPrice: number
  minPrice: number
  firstPrice: number
  lastPrice: number
  logoURI: string
  symbol: string
  name: string
}

export interface CurrentTokenPrice {
  tokenAddress: string
  symbol: string
  name: string
  priceUSD: number
  logoURI: string
  poolAddress: string
  updatedAt: string
}

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI: string
  price: number // API returns 'price'
  priceUSD: number // We'll map price to priceUSD for consistency
  verified: boolean
  rank: number
  updatedAt?: string
}

export interface TokensResponse {
  tokens: Token[]
  count: number
}

export class ZealousAPI {
  private async fetchAPI<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`)
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }
    return response.json()
  }

  private getTokenLogoUrl(logoURI: string): string {
    if (!logoURI) return "/placeholder.svg?height=40&width=40"
    if (logoURI.startsWith("http")) return logoURI
    return `${TOKEN_LOGO_BASE_URL}${logoURI}`
  }

  async getProtocolStats(): Promise<ProtocolStats> {
    return this.fetchAPI<ProtocolStats>("/protocol/stats")
  }

  async getDailyVolume(): Promise<DailyVolume[]> {
    return this.fetchAPI<DailyVolume[]>("/historical/volume/daily")
  }

  async getVolumeHistory(hours = 24): Promise<{ timestamp: string; volumeUSD: number }[]> {
    try {
      // Use the daily volume endpoint and filter by time range
      const dailyData = await this.getDailyVolume()

      // Calculate the cutoff date
      const cutoffDate = new Date()
      cutoffDate.setHours(cutoffDate.getHours() - hours)

      // Filter and transform the data
      const filteredData = dailyData
        .filter((item) => new Date(item.date) >= cutoffDate)
        .map((item) => ({
          timestamp: item.date,
          volumeUSD: item.volumeUSD,
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      return filteredData
    } catch (error) {
      console.error("Error fetching volume history:", error)
      // Return mock data as fallback
      const mockData = []
      const now = new Date()
      for (let i = hours - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 60 * 60 * 1000)
        mockData.push({
          timestamp: date.toISOString(),
          volumeUSD: Math.random() * 100000 + 10000,
        })
      }
      return mockData
    }
  }

  async getHistoricalVolume(): Promise<ProtocolStats[]> {
    return this.fetchAPI<ProtocolStats[]>("/historical/volume")
  }

  async getTokens(limit = 100, skip = 0): Promise<Token[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      skip: skip.toString(),
    })

    try {
      const response = await this.fetchAPI<TokensResponse>(`/tokens?${params}`)

      // Handle case where response might not have the expected structure
      const tokensArray = response?.tokens || response || []

      // Ensure we have an array to work with
      if (!Array.isArray(tokensArray)) {
        console.warn("Unexpected API response structure:", response)
        return []
      }

      // Process tokens and map price to priceUSD for consistency
      return tokensArray.map((token) => ({
        ...token,
        priceUSD: token.price || 0, // Map price to priceUSD
        logoURI: this.getTokenLogoUrl(token.logoURI),
      }))
    } catch (error) {
      console.error("Error fetching tokens:", error)
      throw error
    }
  }

  // Updated to use the new /pools/latest endpoint for better performance
  async getLatestPools(limit = 100, skip = 0, sortField = "tvl", order = "desc"): Promise<Pool[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      skip: skip.toString(),
      sortField,
      order,
    })
    return this.fetchAPI<Pool[]>(`/pools/latest?${params}`)
  }

  // Keep the original pools endpoint for historical data
  async getPools(address?: string, limit = 100, skip = 0): Promise<Pool[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      skip: skip.toString(),
    })
    if (address) params.append("address", address)
    return this.fetchAPI<Pool[]>(`/pools?${params}`)
  }

  // Updated to use the new /pools/:address/latest endpoint
  async getPoolByAddress(address: string): Promise<Pool> {
    return this.fetchAPI<Pool>(`/pools/${address}/latest`)
  }

  async getTokenPrice(tokenAddress: string, limit = 1000, skip = 0): Promise<TokenPrice[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      skip: skip.toString(),
    })
    const prices = await this.fetchAPI<TokenPrice[]>(`/tokens/${tokenAddress}/price?${params}`)

    // Process logo URLs
    return prices.map((price) => ({
      ...price,
      logoURI: this.getTokenLogoUrl(price.logoURI),
    }))
  }

  async getDailyTokenPrice(tokenAddress: string): Promise<DailyTokenPrice[]> {
    const dailyPrices = await this.fetchAPI<DailyTokenPrice[]>(`/tokens/${tokenAddress}/price/daily`)

    // Process logo URLs
    return dailyPrices.map((price) => ({
      ...price,
      logoURI: this.getTokenLogoUrl(price.logoURI),
    }))
  }

  async getCurrentTokenPrice(tokenAddress: string): Promise<CurrentTokenPrice> {
    const price = await this.fetchAPI<CurrentTokenPrice>(`/tokens/${tokenAddress}/current`)

    return {
      ...price,
      logoURI: this.getTokenLogoUrl(price.logoURI),
    }
  }
}
