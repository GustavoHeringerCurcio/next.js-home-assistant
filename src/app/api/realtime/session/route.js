import OpenAI from "openai"
import { AGENT_CONFIG, SYSTEM_PROMPT, hasOpenAIKey } from "@/lib/config"
import { getOpenAITools } from "@/lib/tools/registry"

export const runtime = "nodejs"

export async function POST() {
  if (!hasOpenAIKey()) {
    return Response.json(
      {
        error: "OPENAI_API_KEY is not configured.",
      },
      { status: 400 }
    )
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const session = await client.beta.realtime.sessions.create({
    model: AGENT_CONFIG.realtimeModel,
    modalities: ["text", "audio"],
    voice: process.env.OPENAI_REALTIME_VOICE || "alloy",
    instructions: SYSTEM_PROMPT,
    tools: getOpenAITools(),
    tool_choice: "auto",
  })

  return Response.json(session)
}
