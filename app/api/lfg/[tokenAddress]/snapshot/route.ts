import { NextResponse } from "next/server"

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''

export async function POST(request: Request, { params }: { params: { tokenAddress: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const pages = searchParams.get("pages") || "3"

    const queryParams = new URLSearchParams({
      pages,
    })

    const response = await fetch(`${BACKEND_BASE_URL}/lfg/${params.tokenAddress}/snapshot?${queryParams}`, {
      method: "POST",
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
    console.error("Error taking LFG snapshot:", error)
    return NextResponse.json({ error: "Failed to take LFG snapshot" }, { status: 500 })
  }
}
