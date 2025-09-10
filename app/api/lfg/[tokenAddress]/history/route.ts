import { NextResponse } from "next/server"

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''

export async function GET(request: Request, { params }: { params: { tokenAddress: string } }) {
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

    const response = await fetch(`${BACKEND_BASE_URL}/lfg/${params.tokenAddress}/history?${queryParams}`, {
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Backend API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching LFG token history:", error)
    return NextResponse.json({ error: "Failed to fetch LFG token history" }, { status: 500 })
  }
}
