import { z } from "zod"
import { toJsonSchema } from "../shared/schema.utils.js"
import { upsertMemory } from "@/lib/db/memory"

/**
 * save_memory
 *
 * Persists a durable memory about the user into local SQLite.
 * The agent uses this to remember preferences, context, and facts
 * across conversations.
 */
const saveMemory = {
  name: "save_memory",
  description:
    "Save a durable memory about the user, project, preferences, or environment.",
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
        description: "Importance score from 0 (low) to 1 (high).",
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
}

export const tools = [saveMemory]
