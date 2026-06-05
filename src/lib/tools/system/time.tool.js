import { z } from "zod"
import { toJsonSchema } from "../shared/schema.utils.js"

/**
 * get_current_time
 *
 * Returns the current server time and timezone.
 * Useful for time-sensitive questions or logging.
 */
const getCurrentTime = {
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
}

export const tools = [getCurrentTime]
