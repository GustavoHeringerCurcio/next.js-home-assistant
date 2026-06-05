import { z } from "zod"
import { toJsonSchema } from "../shared/schema.utils.js"
import {
  sendDeviceCommands,
  getDeviceStatus,
  isTuyaSuccess,
} from "@/lib/tuya/device-commands"

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Resolves the lamp device ID from env or returns a structured error. */
function getLampDeviceId() {
  const deviceId = process.env.TUYA_LAMP_DEVICE_ID
  if (!deviceId) {
    throw new Error(
      "TUYA_LAMP_DEVICE_ID is not set in .env. Add your lamp's device ID to enable lamp control."
    )
  }
  return deviceId
}

/** Maps user-facing brightness percentage (1–100) → Tuya internal scale (10–1000). */
const pctToTuya = (pct) => Math.round((pct / 100) * 990 + 10)

/** Maps Tuya internal brightness (10–1000) → user-facing percentage (1–100). */
const tuyaToPct = (raw) => Math.round(((raw - 10) / 990) * 100)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ─── Tool: control_wifi_lamp ──────────────────────────────────────────────────

/**
 * control_wifi_lamp
 *
 * Sends one or more simultaneous commands to the WiFi lamp via Tuya Cloud:
 *   - Power on/off        (switch_led)
 *   - Brightness 1–100%   (bright_value_v2, mapped to Tuya 10–1000)
 *   - HSV color           (work_mode → colour, colour_data_v2)
 *
 * All three parameters are optional and combinable in a single call.
 */
const controlWifiLamp = {
  name: "control_wifi_lamp",
  description:
    "Control the user's WiFi lamp. Can turn it on/off, set brightness (1–100%), " +
    "and change its color (HSV). Use for any request about the lamp, light, or bulb. " +
    "Combine power, brightness, and color in a single call when possible.",
  parameters: toJsonSchema(
    {
      action: {
        type: "string",
        enum: ["on", "off"],
        description: 'Power the lamp "on" or "off". Omit to leave power state unchanged.',
      },
      brightness: {
        type: "number",
        description:
          "Brightness percentage from 1 (dimmest) to 100 (maximum). Omit to leave unchanged.",
      },
      color: {
        type: "object",
        description:
          "Set lamp color using HSV. Providing this automatically switches to colour mode.",
        properties: {
          hue: {
            type: "number",
            description: "Hue angle 0–360 (0 = red, 120 = green, 240 = blue).",
          },
          saturation: {
            type: "number",
            description: "Color saturation 0–100 (0 = white/gray, 100 = vivid color).",
          },
          value: {
            type: "number",
            description:
              "Brightness component 0–100. Prefer setting to 100 and using the brightness field instead.",
          },
        },
        required: ["hue", "saturation", "value"],
        additionalProperties: false,
      },
    },
    []
  ),
  schema: z.object({
    action: z.enum(["on", "off"]).optional(),
    brightness: z.number().min(1).max(100).optional(),
    color: z
      .object({
        hue: z.number().min(0).max(360),
        saturation: z.number().min(0).max(100),
        value: z.number().min(0).max(100),
      })
      .optional(),
  }),
  async execute(args) {
    let deviceId
    try {
      deviceId = getLampDeviceId()
    } catch (err) {
      return { success: false, error: err.message }
    }

    if (args.action == null && args.brightness == null && !args.color) {
      return {
        success: false,
        error: "No parameters provided. Supply at least one of: action, brightness, or color.",
      }
    }

    // 1. Fetch current status of the device to perform state-aware sequential control
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

    const currentPower = currentStatus ? getDp("switch_led") : null
    const currentMode = currentStatus ? getDp("work_mode") : null

    const preCommands = []
    const postCommands = []

    if (args.action === "off") {
      preCommands.push({ code: "switch_led", value: false })
    } else {
      // 1. Power on if requested or if it is currently off
      const needPowerOn = args.action === "on" || (currentStatus && !currentPower)
      if (needPowerOn) {
        preCommands.push({ code: "switch_led", value: true })
      }

      // 2. Determine target work mode
      let targetMode = null
      if (args.color) {
        targetMode = "colour"
      } else if (currentStatus) {
        targetMode = currentMode || "white"
      } else {
        targetMode = "white"
      }

      const needModeChange = targetMode && (!currentStatus || currentMode !== targetMode)
      if (needModeChange) {
        preCommands.push({ code: "work_mode", value: targetMode })
      }

      // 3. Handle properties based on active mode
      if (targetMode === "colour") {
        // Retrieve current color components as baseline
        let h = 0, s = 1000, v = 1000
        const rawColor = currentStatus ? getDp("colour_data_v2") : null
        if (rawColor) {
          try {
            const parsed = typeof rawColor === "string" ? JSON.parse(rawColor) : rawColor
            if (parsed) {
              h = parsed.h
              s = parsed.s
              v = parsed.v
            }
          } catch (e) {}
        }

        // Apply new color if requested
        if (args.color) {
          h = Math.round(args.color.hue)
          s = Math.round((args.color.saturation / 100) * 1000)
          v = Math.round((args.color.value / 100) * 1000)
        }

        // Apply new brightness to the 'v' (value) component in colour mode
        if (args.brightness != null) {
          v = Math.round((args.brightness / 100) * 1000)
        }

        // Send color data DP as a raw JSON object (per Tuya specifications)
        postCommands.push({
          code: "colour_data_v2",
          value: { h, s, v }
        })
      } else {
        // White mode: set brightness using bright_value_v2
        if (args.brightness != null) {
          postCommands.push({ code: "bright_value_v2", value: pctToTuya(args.brightness) })
        }
      }
    }

    // 4. Send commands to Tuya sequentially to avoid clashes
    let result = null

    try {
      if (preCommands.length > 0) {
        result = await sendDeviceCommands(deviceId, preCommands)
        if (!isTuyaSuccess(result)) {
          return {
            success: false,
            error: result?.msg || "Failed to apply power/mode commands.",
            tuya_code: result?.code,
          }
        }
        // If mode or power changed, wait a bit for device to transition before sending payload
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
      return {
        success: true,
        applied: {
          ...(args.action != null && { power: args.action }),
          ...(args.brightness != null && { brightness_pct: args.brightness }),
          ...(args.color && { color_hsv: args.color }),
        },
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

// ─── Tool: get_wifi_lamp_status ───────────────────────────────────────────────

/**
 * get_wifi_lamp_status
 *
 * Reads all datapoints from the lamp and returns a normalized status object:
 *   - power: "on" | "off"
 *   - brightness_pct: number (1–100)
 *   - mode: "white" | "colour"
 *   - color_hsv: { hue, saturation, value } (when in colour mode)
 */
const getWifiLampStatus = {
  name: "get_wifi_lamp_status",
  description:
    "Get the current status of the user's WiFi lamp: power state, brightness, " +
    "color mode, and active color. Use when the user asks what the lamp is doing.",
  parameters: toJsonSchema({}),
  schema: z.object({}),
  async execute() {
    let deviceId
    try {
      deviceId = getLampDeviceId()
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

    const rawBrightness = dp("bright_value_v2")
    const colourRaw = dp("colour_data_v2")

    let colourObj = null
    if (colourRaw) {
      if (typeof colourRaw === "object") {
        colourObj = colourRaw
      } else if (typeof colourRaw === "string") {
        try {
          colourObj = JSON.parse(colourRaw)
        } catch (e) {
          // Ignore parsing errors and keep null
        }
      }
    }

    const color = colourObj
      ? {
          hue: colourObj.h,
          saturation: Math.round((colourObj.s / 1000) * 100),
          value: Math.round((colourObj.v / 1000) * 100),
        }
      : null

    const mode = dp("work_mode") || "white"
    let brightness_pct = null
    if (mode === "colour" && color) {
      brightness_pct = color.value
    } else if (rawBrightness != null) {
      brightness_pct = tuyaToPct(rawBrightness)
    }

    return {
      success: true,
      status: {
        power: dp("switch_led") ? "on" : "off",
        brightness_pct,
        mode,
        ...(color && { color_hsv: color }),
      },
      device_id: deviceId,
    }
  },
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const tools = [controlWifiLamp, getWifiLampStatus]
