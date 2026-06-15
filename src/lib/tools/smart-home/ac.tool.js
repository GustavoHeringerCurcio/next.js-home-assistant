import { z } from "zod"
import { toJsonSchema } from "../shared/schema.utils.js"
import {
  sendIRCommand,
  getIRStatus,
  isTuyaSuccess,
} from "@/lib/tuya/device-commands"

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function getAcIRIds() {
  const hubId = process.env.TUYA_IR_HUB_ID
  const remoteId = process.env.TUYA_IR_AC_REMOTE_ID
  if (!hubId) {
    throw new Error("TUYA_IR_HUB_ID is not set in .env. Add your IR hub's device ID.")
  }
  if (!remoteId) {
    throw new Error("TUYA_IR_AC_REMOTE_ID is not set in .env. Add your virtual AC remote ID.")
  }
  return { hubId, remoteId }
}

const MODE_MAP = {
  cool: "cold",
  heat: "hot",
  fan: "wind",
  dry: "wet",
  auto: "auto",
}

const REVERSE_MODE_MAP = Object.fromEntries(
  Object.entries(MODE_MAP).map(([k, v]) => [v, k])
)

const controlAc = {
  name: "control_ac",
  description:
    "Control the user's Air Conditioner. You can turn it on/off, set the temperature, " +
    "change the mode (cool, heat, fan, dry, auto), and set the fan speed.",
  parameters: toJsonSchema(
    {
      power: {
        type: "string",
        enum: ["on", "off"],
        description: 'Power the AC "on" or "off".',
      },
      temperature: {
        type: "number",
        description: "Target temperature in Celsius (typically 16-30).",
      },
      mode: {
        type: "string",
        enum: ["cool", "heat", "fan", "dry", "auto"],
        description: "Operating mode of the AC.",
      },
      fan_speed: {
        type: "string",
        enum: ["low", "mid", "high", "auto"],
        description: "Fan speed setting.",
      },
    },
    []
  ),
  schema: z.object({
    power: z.enum(["on", "off"]).optional(),
    temperature: z.number().min(16).max(30).optional(),
    mode: z.enum(["cool", "heat", "fan", "dry", "auto"]).optional(),
    fan_speed: z.enum(["low", "mid", "high", "auto"]).optional(),
  }),
  async execute(args) {
    let hubId, remoteId
    try {
      const ids = getAcIRIds()
      hubId = ids.hubId
      remoteId = ids.remoteId
    } catch (err) {
      return { success: false, error: err.message }
    }

    if (args.power == null && args.temperature == null && !args.mode && !args.fan_speed) {
      return {
        success: false,
        error: "No parameters provided. Supply at least one of: power, temperature, mode, or fan_speed.",
      }
    }

    const commands = []

    if (args.power) {
      commands.push({ code: "power", value: args.power === "on" ? 1 : 0 })
    }
    if (args.temperature != null) {
      commands.push({ code: "temp_set", value: args.temperature })
    }
    if (args.mode) {
      commands.push({ code: "mode", value: MODE_MAP[args.mode] })
    }
    if (args.fan_speed) {
      commands.push({ code: "fan_speed_enum", value: args.fan_speed })
    }

    let lastResult = null
    try {
      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i]
        if (i > 0) await sleep(500)
        lastResult = await sendIRCommand(hubId, remoteId, cmd.code, cmd.value)
        if (!isTuyaSuccess(lastResult)) {
          return {
            success: false,
            step: i,
            error: lastResult?.msg || `Failed to send IR command "${cmd.code}".`,
            tuya_code: lastResult?.code,
          }
        }
      }
    } catch (err) {
      return { success: false, error: err.message || "Failed to reach Tuya Cloud API." }
    }

    return {
      success: true,
      applied: {
        ...(args.power && { power: args.power }),
        ...(args.temperature != null && { temperature: args.temperature }),
        ...(args.mode && { mode: args.mode }),
        ...(args.fan_speed && { fan_speed: args.fan_speed }),
      },
      device_id: hubId,
    }
  },
}

const getAcStatus = {
  name: "get_ac_status",
  description:
    "Get the current status of the Air Conditioner: power state, temperature, mode, and fan speed.",
  parameters: toJsonSchema({}),
  schema: z.object({}),
  async execute() {
    let hubId, remoteId
    try {
      const ids = getAcIRIds()
      hubId = ids.hubId
      remoteId = ids.remoteId
    } catch (err) {
      return { success: false, error: err.message }
    }

    let result
    try {
      result = await getIRStatus(hubId, remoteId)
    } catch (err) {
      return { success: false, error: err.message || "Failed to reach Tuya Cloud API." }
    }

    if (!isTuyaSuccess(result)) {
      return {
        success: false,
        error: result?.msg || "Tuya API returned a failure response.",
        tuya_code: result?.code,
      }
    }

    const dps = Array.isArray(result.result) ? result.result : []
    const dp = (code) => dps.find((d) => d.code === code)?.value

    const rawPower = dp("power")
    const rawMode = dp("mode")
    const mode = REVERSE_MODE_MAP[rawMode] || rawMode

    return {
      success: true,
      status: {
        power: rawPower === 1 || rawPower === true ? "on" : "off",
        temperature: dp("temp_set"),
        mode: mode,
        fan_speed: dp("fan_speed_enum"),
      },
      device_id: hubId,
    }
  },
}

export const tools = [controlAc, getAcStatus]
