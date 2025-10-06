// Configuration for bridged KRC20 tokens that need max supply from KRC20 API
// These tokens are bridged from Kaspa mainnet, so we can't use their ERC20 totalSupply
// Instead, we fetch their max supply from the KRC20 API

export interface BridgedTokenConfig {
  ticker: string
  address: string
}

// List of bridged tokens - add new tokens here as they get bridged
export const BRIDGED_TOKENS: BridgedTokenConfig[] = [
  { ticker: "NACHO", address: "0x..." }, // Replace with actual addresses
  { ticker: "ZEAL", address: "0x..." },
  { ticker: "BITE", address: "0x..." },
  { ticker: "KASPY", address: "0x..." },
  { ticker: "WOLFY", address: "0x..." },
  { ticker: "KROAK", address: "0x..." },
  { ticker: "KYRO", address: "0x..." },
  { ticker: "FUND", address: "0x..." },
  { ticker: "SHARKY", address: "0x..." },
  { ticker: "CRUMBS", address: "0x..." },
]

// Helper function to check if a token is bridged
export function isBridgedToken(addressOrTicker: string): boolean {
  const normalized = addressOrTicker.toLowerCase()
  return BRIDGED_TOKENS.some(
    (token) => token.address.toLowerCase() === normalized || token.ticker.toLowerCase() === normalized,
  )
}

// Helper function to get ticker from address
export function getTickerFromAddress(address: string): string | null {
  const token = BRIDGED_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())
  return token?.ticker || null
}

// Helper function to get address from ticker
export function getAddressFromTicker(ticker: string): string | null {
  const token = BRIDGED_TOKENS.find((t) => t.ticker.toLowerCase() === ticker.toLowerCase())
  return token?.address || null
}
