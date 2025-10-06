// KRC20 API client for fetching token data from Kaspa mainnet
// Used for bridged tokens to get accurate max supply

const KRC20_API_BASE = "https://api.kasplex.org/v1"

interface KRC20TokenResponse {
  message: string
  result: Array<{
    ca: string // contract address
    name: string
    max: string // max supply in smallest unit
    lim: string
    pre: string
    to: string
    dec: string // decimals
    mod: string
    minted: string
    burned: string
    opScoreAdd: string
    opScoreMod: string
    state: string
    hashRev: string
    mtsAdd: string
    holderTotal: string
    transferTotal: string
    mintTotal: string
    holder: Array<{
      address: string
      amount: string
    }>
  }>
}

// Cache for KRC20 token data to avoid repeated API calls
const krc20Cache = new Map<string, { supply: number; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export class KRC20API {
  /**
   * Fetch max supply for a KRC20 token by ticker
   * @param ticker - Token ticker (e.g., "NACHO", "ZEAL")
   * @returns Max supply as a number (already divided by decimals)
   */
  async getMaxSupply(ticker: string): Promise<number | null> {
    try {
      // Check cache first
      const cached = krc20Cache.get(ticker.toUpperCase())
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log(`[v0] Using cached KRC20 supply for ${ticker}`)
        return cached.supply
      }

      console.log(`[v0] Fetching KRC20 max supply for ${ticker}`)

      const response = await fetch(`${KRC20_API_BASE}/krc20/token/${ticker}`, {
        headers: {
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        console.warn(`[v0] KRC20 API returned ${response.status} for ${ticker}`)
        return null
      }

      const data: KRC20TokenResponse = await response.json()

      if (!data.result || data.result.length === 0) {
        console.warn(`[v0] No KRC20 token data found for ${ticker}`)
        return null
      }

      const tokenData = data.result[0]
      const maxSupply = BigInt(tokenData.max)
      const decimals = Number.parseInt(tokenData.dec, 10)

      // Convert from smallest unit to actual token amount
      const supply = Number(maxSupply) / Math.pow(10, decimals)

      // Cache the result
      krc20Cache.set(ticker.toUpperCase(), {
        supply,
        timestamp: Date.now(),
      })

      console.log(`[v0] KRC20 max supply for ${ticker}: ${supply.toLocaleString()}`)

      return supply
    } catch (error) {
      console.error(`[v0] Failed to fetch KRC20 max supply for ${ticker}:`, error)
      return null
    }
  }

  /**
   * Fetch max supplies for multiple tokens in parallel
   * @param tickers - Array of token tickers
   * @returns Map of ticker to max supply
   */
  async getMaxSupplies(tickers: string[]): Promise<Map<string, number>> {
    const results = new Map<string, number>()

    // Fetch all supplies in parallel
    const supplies = await Promise.all(tickers.map((ticker) => this.getMaxSupply(ticker)))

    tickers.forEach((ticker, index) => {
      const supply = supplies[index]
      if (supply !== null) {
        results.set(ticker.toUpperCase(), supply)
      }
    })

    return results
  }

  /**
   * Clear the cache (useful for testing or forcing refresh)
   */
  clearCache(): void {
    krc20Cache.clear()
  }
}

// Export a singleton instance
export const krc20API = new KRC20API()
