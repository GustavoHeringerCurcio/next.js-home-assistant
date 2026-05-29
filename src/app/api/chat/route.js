import { runAgentTurn } from "@/lib/agent/run-agent"

export const runtime = "nodejs"

export async function POST(request) {
  try {
    const body = await request.json()
    const result = await runAgentTurn({
      messages: body.messages || [],
      conversationId: body.conversationId,
    })

    return Response.json(result)
  } catch (error) {
    return Response.json(
      {
        error: error.message || "Agent request failed.",
      },
      { status: 500 }
    )
  }
}
