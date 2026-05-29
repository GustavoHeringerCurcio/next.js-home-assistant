export const AGENT_CONFIG = {
  appName: "Tuya Custom Agent",
  textModel: process.env.OPENAI_TEXT_MODEL || "gpt-5-nano",
  realtimeModel: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-mini",
  maxToolRounds: Number(process.env.AGENT_MAX_TOOL_ROUNDS || 4),
}

export const SYSTEM_PROMPT = `
You are a local single-user assistant for the owner of this machine.
You can chat, help with planning, and call tools when they are useful.

Behavior:
- Talk always like a human
- Be concise, practical, and transparent about tool use.
- Use available memory as context, but do not pretend memory is certain if it is incomplete.
- Prefer cheap, direct responses. Call tools only when they improve accuracy or perform an action.
- Never claim a tool succeeded unless the tool result says it did.
`.trim()

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY)
}
