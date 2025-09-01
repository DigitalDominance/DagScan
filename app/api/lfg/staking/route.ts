import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const response = await fetch("https://api.dev-lfg.kaspa.com/staking/search", {
      headers: {
        Accept: "application/json",
        "User-Agent": "DagScan/1.0",
      },
    })

    if (!response.ok) {
      throw new Error(`LFG API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching LFG staking data:", error)
    return NextResponse.json({ error: "Failed to fetch staking data" }, { status: 500 })
  }
}
