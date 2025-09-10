import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")
    const page = searchParams.get("page") || "1"
    const sortBy = searchParams.get("sortBy") || "Market Cap (High to Low)"

    const queryParams = new URLSearchParams({
      page,
      sortBy,
    })

    if (q) queryParams.append("q", q)

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/lfg/search?${queryParams}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "DagScan/1.0",
      },
    })

    if (!response.ok) {
      throw new Error(`Backend API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error searching LFG tokens:", error)
    return NextResponse.json({ error: "Failed to search tokens" }, { status: 500 })
  }
}
