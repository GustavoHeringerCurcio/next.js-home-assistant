import OpenAI from "openai"
import { AGENT_CONFIG, SYSTEM_PROMPT, hasOpenAIKey } from "@/lib/config"
import { getRelevantMemories, saveMessage } from "@/lib/db/memory"
import { getOpenAITools, runTool } from "@/lib/tools"

function normalizeMessages(messages = []) {
  return messages
    .filter((message) => ["user", "assistant"].includes(message.role) && message.content)
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))
}

function buildMemoryContext(memories) {
  if (!memories.length) {
    return "No durable memories were retrieved for this turn."
  }

  return memories
    .map((memory, index) => `${index + 1}. ${memory.content}`)
    .join("\n")
}

async function runOfflineAgent({ message, conversationId }) {
  const timeResult = /time|date/i.test(message)
    ? await runTool("get_current_time", { label: "offline" })
    : null

  const content = [
    "OpenAI is not configured yet, so I am running in local mode.",
    "Add OPENAI_API_KEY to .env.local and restart the dev server to enable the real agent.",
    timeResult ? `Current server time: ${timeResult.iso}` : null,
  ]
    .filter(Boolean)
    .join("\n\n")

  await saveMessage({ conversationId, role: "assistant", content, metadata: { offline: true } })

  return {
    content,
    model: "local-offline",
  }
}

export async function runAgentTurn({ messages, conversationId = crypto.randomUUID() }) {
  const normalizedMessages = normalizeMessages(messages)
  const latestUserMessage = [...normalizedMessages].reverse().find((message) => message.role === "user")

  if (!latestUserMessage) {
    throw new Error("A user message is required.")
  }

  await saveMessage({
    conversationId,
    role: "user",
    content: latestUserMessage.content,
  })

  const memories = await getRelevantMemories(latestUserMessage.content)

  if (!hasOpenAIKey()) {
    return runOfflineAgent({
      message: latestUserMessage.content,
      conversationId,
    })
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const tools = getOpenAITools()
  const instructions = `${SYSTEM_PROMPT}

Durable memory context:
${buildMemoryContext(memories)}`
  const input = [...normalizedMessages]

  let response
  let finalText = ""

  for (let round = 0; round < AGENT_CONFIG.maxToolRounds; round += 1) {
    response = await client.responses.create({
      model: AGENT_CONFIG.textModel,
      instructions,
      input,
      tools,
      tool_choice: "auto",
    })

    input.push(...(response.output || []))

    const functionCalls = (response.output || []).filter((item) => item.type === "function_call")

    if (!functionCalls.length) {
      finalText = response.output_text || ""
      break
    }

    for (const functionCall of functionCalls) {
      let parsedArgs = {}

      try {
        parsedArgs = functionCall.arguments ? JSON.parse(functionCall.arguments) : {}
      } catch (error) {
        parsedArgs = { parseError: error.message, raw: functionCall.arguments }
      }

      let result

      try {
        result = await runTool(functionCall.name, parsedArgs)
      } catch (error) {
        result = {
          error: error.message,
        }
      }

      input.push({
        type: "function_call_output",
        call_id: functionCall.call_id,
        output: JSON.stringify(result),
      })
    }
  }

  if (!finalText && response?.output_text) {
    finalText = response.output_text
  }

  if (!finalText) {
    finalText = "I finished the tool loop, but the model did not return visible text."
  }

  await saveMessage({
    conversationId,
    role: "assistant",
    content: finalText,
    metadata: {
      model: AGENT_CONFIG.textModel,
    },
  })

  return {
    content: finalText,
    model: AGENT_CONFIG.textModel,
  }
}
