import { NextResponse } from "next/server"

const LFG_BASE_URL = "https://api.lfg.kaspa.com"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sortBy = searchParams.get("sortBy") || "Market Cap (High to Low)"
    const view = searchParams.get("view") || "grid"
    const page = searchParams.get("page") || "1"

    const params = new URLSearchParams({
      sortBy,
      view,
      page,
    })

    const response = await fetch(`${LFG_BASE_URL}/tokens/search?${params}`, {
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
    console.error("Error fetching LFG tokens:", error)
    return NextResponse.json({ error: "Failed to fetch LFG tokens" }, { status: 500 })
  }
}
