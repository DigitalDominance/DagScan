import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: { tokenAddress: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const pages = searchParams.get("pages") || "3"

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/lfg/${params.tokenAddress}/snapshot?pages=${pages}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "User-Agent": "DagScan/1.0",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Backend API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error taking LFG token snapshot:", error)
    return NextResponse.json({ error: "Failed to take token snapshot" }, { status: 500 })
  }
}
