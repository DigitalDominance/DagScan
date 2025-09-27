import { NextResponse } from "next/server"

const LFG_BASE_URL = "https://api.lfg.kaspa.com"

export async function GET() {
  try {
    const response = await fetch(`${LFG_BASE_URL}/stats`, {
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`LFG API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching LFG stats:", error)
    return NextResponse.json({ error: "Failed to fetch LFG stats" }, { status: 500 })
  }
}
