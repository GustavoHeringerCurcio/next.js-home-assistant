/**
 * Tool Registry
 *
 * This file aggregates all tool modules from the domain folders and exposes
 * the runtime API. It contains no tool implementation logic.
 */

import { tools as systemTimeTools } from "./system/time.tool.js"
import { tools as systemMemoryTools } from "./system/memory.tool.js"
import { tools as smartHomeLampTools } from "./smart-home/lamp.tool.js"
import { tools as smartHomeAcTools } from "./smart-home/ac.tool.js"

/**
 * All tools available to the agent.
 */
export const tools = [
  ...systemTimeTools,
  ...systemMemoryTools,
  ...smartHomeLampTools,
  ...smartHomeAcTools,
]

/**
 * Formats tools for the OpenAI API `tools` parameter.
 */
export function getOpenAITools() {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }))
}

/**
 * Finds and executes a tool by name after validating its arguments via Zod.
 */
export async function runTool(name, rawArgs = {}) {
  const tool = tools.find((t) => t.name === name)

  if (!tool) {
    throw new Error(`Unknown tool: "${name}"`)
  }

  const args = tool.schema.parse(rawArgs)
  return tool.execute(args)
}
