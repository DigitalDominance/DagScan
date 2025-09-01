import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { tokenAddress: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const limit = searchParams.get("limit") || "500"
    const order = searchParams.get("order") || "asc"

    const queryParams = new URLSearchParams({
      limit,
      order,
    })

    if (from) queryParams.append("from", from)
    if (to) queryParams.append("to", to)

    const tokenAddress = params.tokenAddress.toLowerCase()
    const backendUrl = `https://dagscanbackend-7220ff41cc76.herokuapp.com/api/lfg/history?tokenAddress=${tokenAddress}&${queryParams}`
    console.log("[v0] Calling backend URL:", backendUrl)
    console.log("[v0] Token address (lowercase):", tokenAddress)

    const response = await fetch(backendUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "DagScan/1.0",
      },
    })

    if (!response.ok) {
      console.log("[v0] Backend response status:", response.status)
      const responseText = await response.text()
      console.log("[v0] Backend response text:", responseText)

      if (response.status === 404) {
        return NextResponse.json(
          {
            error:
              "Token not found in backend database. The token may not have been indexed yet or the address may be incorrect.",
            tokenAddress: tokenAddress,
          },
          { status: 404 },
        )
      }

      throw new Error(`Backend API responded with status: ${response.status}`)
    }

    const data = await response.json()
    console.log("[v0] Backend response success, data points:", data.points?.length || 0)
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Error fetching LFG token history:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch token history",
        details: error instanceof Error ? error.message : "Unknown error",
        tokenAddress: params.tokenAddress,
      },
      { status: 500 },
    )
  }
}
