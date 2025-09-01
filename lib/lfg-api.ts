const BASE_URL = "/api/lfg"
const BACKEND_BASE_URL = "https://dagscanbackend-7220ff41cc76.herokuapp.com"
const IPFS_BASE_URL = "https://ipfs.io/ipfs/"

export interface LFGStats {
  success: boolean
  data: {
    updatedAt: string
    tradeVolumes: {
      combined: {
        "1d": number
        "3d": number
        "7d": number
        all: number
      }
      dex: {
        "1d": number
        "3d": number
        "7d": number
        all: number
      }
      curve: {
        "1d": number
        "3d": number
        "7d": number
        all: number
      }
    }
    tradeCounts: {
      combined: {
        "1d": number
        "3d": number
        "7d": number
        all: number
      }
    }
    usersCount: number
    dexTokensCount: number
    launchpadTokensCount: number
    tvl: {
      total: number
      breakdown: Record<string, number>
    }
  }
}

export interface LFGToken {
  tokenAddress: string
  deployerAddress: string
  ticker: string
  name: string
  description: string
  totalSupply: number
  image: string
  colorHex: string
  devLock: string
  isHypedLaunch: boolean
  bondingCurve: string
  state: string
  decimals: number
  version: number
  isNSFW: boolean
  txHash: string
  price: number
  marketCap: number
  volume: {
    "1h": number
    "4h": number
    "12h": number
    "1d": number
    "3d": number
    "7d": number
    all: number
  }
  priceChange: {
    "1h": number
    "4h": number
    "12h": number
    "1d": number
    "3d": number
    "7d": number
    all: number
  }
  tradeCount: {
    "1h": number
    "4h": number
    "12h": number
    "1d": number
    "3d": number
    "7d": number
    all: number
  }
  progress: number
  createdAt: string
  updatedAt: string
  socials?: {
    website?: string
    twitter?: string
    telegram?: string
  }
}

export interface LFGTokensResponse {
  success: boolean
  result: LFGToken[]
  page: number
  limit: number
  hasMore: boolean
}

export interface LFGHistoricalPrice {
  t: number // timestamp in ms
  price: number
  marketCap: number
  v1h: number
  v4h: number
  v12h: number
  v1d: number
  v3d: number
  v7d: number
}

export interface LFGHistoricalResponse {
  success: boolean
  tokenAddress: string
  count: number
  points: LFGHistoricalPrice[]
}

export class LFGAPI {
  private async fetchAPI<T>(url: string): Promise<T> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }
    return response.json()
  }

  private getTokenLogoUrl(image: string): string {
    if (!image) return "/placeholder.svg?height=40&width=40"
    if (image.startsWith("http")) return image
    return `${IPFS_BASE_URL}${image}`
  }

  async getStats(): Promise<LFGStats> {
    return this.fetchAPI<LFGStats>(`${BASE_URL}/stats`)
  }

  async getTokens(page = 1, sortBy = "Market Cap (High to Low)"): Promise<LFGTokensResponse> {
    const params = new URLSearchParams({
      sortBy,
      page: page.toString(),
    })

    const response = await this.fetchAPI<LFGTokensResponse>(`${BASE_URL}/tokens?${params}`)

    // Process tokens to add proper logo URLs
    if (response.result) {
      response.result = response.result.map((token) => ({
        ...token,
        image: this.getTokenLogoUrl(token.image),
      }))
    }

    return response
  }

  async searchTokens(query: string, page = 1, sortBy = "Market Cap (High to Low)"): Promise<LFGTokensResponse> {
    const params = new URLSearchParams({
      q: query,
      sortBy,
      page: page.toString(),
    })

    const response = await this.fetchAPI<LFGTokensResponse>(`${BASE_URL}/tokens?${params}`)

    // Process tokens to add proper logo URLs
    if (response.result) {
      response.result = response.result.map((token) => ({
        ...token,
        image: this.getTokenLogoUrl(token.image),
      }))
    }

    return response
  }

  async getTokenHistory(tokenAddress: string, from?: string, to?: string, limit = 500): Promise<LFGHistoricalResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      order: "asc",
    })

    if (from) params.append("from", from)
    if (to) params.append("to", to)

    return this.fetchAPI<LFGHistoricalResponse>(`/api/dagscan/lfg/${tokenAddress}/history?${params}`)
  }

  async takeSnapshot(
    tokenAddress: string,
    pages = 3,
  ): Promise<{ success: boolean; tokenAddress: string; snappedAt: string }> {
    const params = new URLSearchParams({
      pages: pages.toString(),
    })

    const response = await fetch(`/api/dagscan/lfg/${tokenAddress}/snapshot?${params}`, {
      method: "POST",
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    return response.json()
  }

  // Helper method to get combined stats for dashboard
  async getCombinedStats(): Promise<{
    totalTVL: number
    totalVolume24h: number
    totalTokens: number
  }> {
    try {
      const stats = await this.getStats()
      return {
        totalTVL: stats.data.tvl.total,
        totalVolume24h: stats.data.tradeVolumes.combined["1d"],
        totalTokens: stats.data.dexTokensCount + stats.data.launchpadTokensCount,
      }
    } catch (error) {
      console.error("Failed to fetch LFG stats:", error)
      return {
        totalTVL: 0,
        totalVolume24h: 0,
        totalTokens: 0,
      }
    }
  }
}
