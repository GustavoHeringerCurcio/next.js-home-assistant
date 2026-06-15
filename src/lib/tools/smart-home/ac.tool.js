import { z } from "zod"
import { toJsonSchema } from "../shared/schema.utils.js"
import {
  sendDeviceCommands,
  getDeviceStatus,
  isTuyaSuccess,
} from "@/lib/tuya/device-commands"

// ─── Private helpers ──────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Resolves the AC device ID from env or returns a structured error. */
function getAcDeviceId() {
  const deviceId = process.env.TUYA_AC_DEVICE_ID
  if (!deviceId) {
    throw new Error(
      "TUYA_AC_DEVICE_ID is not set in .env. Add your AC's device ID to enable AC control."
    )
  }
  return deviceId
}

/** 
 * Maps user-friendly mode names to Tuya Standard Instruction Set codes.
 * Based on docs/TOOL_AUTHORING.md
 */
const MODE_MAP = {
  cool: "cold",
  heat: "hot",
  fan: "wind",
  dry: "wet",
  auto: "auto",
}

/** Reverse map for reading status back to user-friendly names. */
const REVERSE_MODE_MAP = Object.fromEntries(
  Object.entries(MODE_MAP).map(([k, v]) => [v, k])
)

// ─── Tool: control_ac ─────────────────────────────────────────────────────────

/**
 * control_ac
 *
 * Sends commands to the AC via Tuya Cloud:
 *   - Power on/off (switch)
 *   - Temperature (temp_set)
 *   - Mode (mode)
 *   - Fan speed (fan_speed_enum)
 */
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
    let deviceId
    try {
      deviceId = getAcDeviceId()
    } catch (err) {
      return { success: false, error: err.message }
    }

    if (args.power == null && args.temperature == null && !args.mode && !args.fan_speed) {
      return {
        success: false,
        error: "No parameters provided. Supply at least one of: power, temperature, mode, or fan_speed.",
      }
    }

    // 1. Fetch current status for state-aware sequential control
    let currentStatus = null
    try {
      const statusRes = await getDeviceStatus(deviceId)
      if (isTuyaSuccess(statusRes) && Array.isArray(statusRes.result)) {
        currentStatus = statusRes.result
      }
    } catch (err) {
      console.warn("Failed to fetch device status for sequential control:", err)
    }

    const getDp = (code) => currentStatus?.find((d) => d.code === code)?.value
    const currentPower = currentStatus ? getDp("switch") : null

    const preCommands = []
    const postCommands = []

    if (args.power === "off") {
      preCommands.push({ code: "switch", value: false })
    } else {
      const needPowerOn = args.power === "on" || (currentStatus != null && currentPower === false)
      if (needPowerOn) {
        preCommands.push({ code: "switch", value: true })
      }

      if (args.temperature != null) {
        postCommands.push({ code: "temp_set", value: args.temperature })
      }
      if (args.mode) {
        postCommands.push({ code: "mode", value: MODE_MAP[args.mode] })
      }
      if (args.fan_speed) {
        postCommands.push({ code: "fan_speed_enum", value: args.fan_speed })
      }
    }

    // 2. Send commands to Tuya sequentially to avoid clashes
    let result = null

    try {
      if (preCommands.length > 0) {
        result = await sendDeviceCommands(deviceId, preCommands)
        if (!isTuyaSuccess(result)) {
          return {
            success: false,
            error: result?.msg || "Failed to apply power commands.",
            tuya_code: result?.code,
          }
        }
        if (postCommands.length > 0) {
          await sleep(500)
        }
      }

      if (postCommands.length > 0) {
        result = await sendDeviceCommands(deviceId, postCommands)
      }
    } catch (err) {
      return { success: false, error: err.message || "Failed to reach Tuya Cloud API." }
    }

    if (!result || isTuyaSuccess(result)) {
      const applied = {}
      if (args.power) {
        applied.power = args.power
      } else if (preCommands.some((c) => c.code === "switch" && c.value === true)) {
        applied.power = "on"
      }
      if (args.temperature != null) applied.temperature = args.temperature
      if (args.mode) applied.mode = args.mode
      if (args.fan_speed) applied.fan_speed = args.fan_speed

      return {
        success: true,
        applied,
        device_id: deviceId,
      }
    }

    return {
      success: false,
      error: result?.msg || "Tuya API returned a failure response.",
      tuya_code: result?.code,
    }
  },
}

// ─── Tool: get_ac_status ─────────────────────────────────────────────────────

/**
 * get_ac_status
 *
 * Reads the current state of the AC from Tuya Cloud.
 */
const getAcStatus = {
  name: "get_ac_status",
  description:
    "Get the current status of the Air Conditioner: power state, temperature, mode, and fan speed.",
  parameters: toJsonSchema({}),
  schema: z.object({}),
  async execute() {
    let deviceId
    try {
      deviceId = getAcDeviceId()
    } catch (err) {
      return { success: false, error: err.message }
    }

    let result
    try {
      result = await getDeviceStatus(deviceId)
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

    const rawMode = dp("mode")
    const mode = REVERSE_MODE_MAP[rawMode] || rawMode

    return {
      success: true,
      status: {
        power: dp("switch") ? "on" : "off",
        temperature: dp("temp_set"),
        mode: mode,
        fan_speed: dp("fan_speed_enum"),
      },
      device_id: deviceId,
    }
  },
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const tools = [controlAc, getAcStatus]
