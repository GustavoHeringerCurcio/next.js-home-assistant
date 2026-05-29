import { z } from "zod"
import { upsertMemory } from "@/lib/db/memory"

function toJsonSchema(shape, required = []) {
  return {
    type: "object",
    properties: shape,
    required,
    additionalProperties: false,
  }
}

export const tools = [
  {
    name: "get_current_time",
    description: "Get the current server time and timezone.",
    parameters: toJsonSchema({
      label: {
        type: "string",
        description: "Optional human label for why the time is being requested.",
      },
    }),
    schema: z.object({
      label: z.string().optional(),
    }),
    async execute(args) {
      return {
        label: args.label || "server_time",
        iso: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
    },
  },
  {
    name: "save_memory",
    description: "Save a durable memory about the user, project, preferences, or environment.",
    parameters: toJsonSchema(
      {
        content: {
          type: "string",
          description: "The memory content to save.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Short labels for the memory.",
        },
        importance: {
          type: "number",
          description: "Importance from 0 to 1.",
        },
      },
      ["content"]
    ),
    schema: z.object({
      content: z.string().min(1),
      tags: z.array(z.string()).optional(),
      importance: z.number().min(0).max(1).optional(),
    }),
    async execute(args) {
      const memory = await upsertMemory({
        content: args.content,
        tags: args.tags || [],
        importance: args.importance ?? 0.5,
      })

      return {
        saved: Boolean(memory),
        memory,
      }
    },
  },
]

export function getOpenAITools() {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }))
}

export async function runTool(name, rawArgs = {}) {
  const tool = tools.find((candidate) => candidate.name === name)

  if (!tool) {
    throw new Error(`Unknown tool: ${name}`)
  }

  const args = tool.schema.parse(rawArgs)
  return tool.execute(args)
}
