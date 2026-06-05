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

/** Common color names → hue (and optional saturation). Saturation/value default to 100 when omitted. */
const COLOR_MAP = {
  red: { hue: 0 },
  orange: { hue: 30 },
  yellow: { hue: 60 },
  lime: { hue: 90 },
  green: { hue: 120 },
  teal: { hue: 165 },
  cyan: { hue: 180 },
  aqua: { hue: 180 },
  blue: { hue: 240 },
  navy: { hue: 240, saturation: 80 },
  indigo: { hue: 260 },
  purple: { hue: 275 },
  violet: { hue: 275 },
  magenta: { hue: 300 },
  pink: { hue: 330 },
  white: { hue: 0, saturation: 0 },
}

function normalizeColorName(name) {
  return String(name).toLowerCase().trim().replace(/\s+/g, "_")
}

function resolveColorInput(colorArg) {
  const value = colorArg.value ?? 100

  if (colorArg.color_name) {
    const key = normalizeColorName(colorArg.color_name)
    const mapped = COLOR_MAP[key]
    if (!mapped) {
      return {
        error: `Unknown color "${colorArg.color_name}". Try a common name like purple, red, or blue.`,
      }
    }
    return {
      hue: mapped.hue,
      saturation: colorArg.saturation ?? mapped.saturation ?? 100,
      value,
      color_name: key,
    }
  }

  if (colorArg.hue != null) {
    return {
      hue: colorArg.hue,
      saturation: colorArg.saturation ?? 100,
      value,
    }
  }

  return { error: "color requires color_name or hue." }
}

function hueToColorName(hue, saturation) {
  if (saturation < 15) return "white"
  let best = null
  let bestDist = Infinity
  for (const [name, mapped] of Object.entries(COLOR_MAP)) {
    if (mapped.saturation === 0) continue
    const dist = Math.min(Math.abs(hue - mapped.hue), 360 - Math.abs(hue - mapped.hue))
    if (dist < bestDist) {
      bestDist = dist
      best = name
    }
  }
  return bestDist <= 20 ? best : null
}

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
    "Control the user's WiFi lamp: on/off, brightness (1–100%), or color. " +
    "For color requests, prefer color_name (e.g. purple, blue, red) — saturation and value default to vivid/100%. " +
    "When setting a color without brightness, brightness is automatically 100%. " +
    "Only pass hue/saturation when the user explicitly asks for fine-tuned color control.",
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
          "Brightness 1–100%. Omit when setting a color (defaults to 100%) or to leave unchanged.",
      },
      color: {
        type: "object",
        description:
          "Set lamp color. Use color_name for everyday requests (purple, blue, etc.). " +
          "Omit saturation/value unless the user asked for them — they default to 100.",
        properties: {
          color_name: {
            type: "string",
            description:
              'Common color name, e.g. "purple", "red", "blue", "green", "pink". Preferred for simple color requests.',
          },
          hue: {
            type: "number",
            description: "Hue 0–360. Only when the user specifies an exact hue.",
          },
          saturation: {
            type: "number",
            description: "Saturation 0–100. Only when the user asks for muted/vivid adjustments. Default 100.",
          },
          value: {
            type: "number",
            description: "Color brightness 0–100. Default 100; prefer the top-level brightness field instead.",
          },
        },
        required: [],
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
        color_name: z.string().optional(),
        hue: z.number().min(0).max(360).optional(),
        saturation: z.number().min(0).max(100).optional(),
        value: z.number().min(0).max(100).optional(),
      })
      .refine((c) => c.color_name || c.hue != null, {
        message: "color requires color_name or hue",
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

    let resolvedColor = null
    if (args.color) {
      resolvedColor = resolveColorInput(args.color)
      if (resolvedColor.error) {
        return { success: false, error: resolvedColor.error }
      }
    }

    const effectiveBrightness =
      args.brightness ?? (resolvedColor ? 100 : null)

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
      if (resolvedColor) {
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
        if (resolvedColor) {
          h = Math.round(resolvedColor.hue)
          s = Math.round((resolvedColor.saturation / 100) * 1000)
          v = Math.round((resolvedColor.value / 100) * 1000)
        }

        // Apply new brightness to the 'v' (value) component in colour mode
        if (effectiveBrightness != null) {
          v = Math.round((effectiveBrightness / 100) * 1000)
        }

        // Send color data DP as a raw JSON object (per Tuya specifications)
        postCommands.push({
          code: "colour_data_v2",
          value: { h, s, v }
        })
      } else {
        // White mode: set brightness using bright_value_v2
        if (effectiveBrightness != null) {
          postCommands.push({ code: "bright_value_v2", value: pctToTuya(effectiveBrightness) })
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
          ...(effectiveBrightness != null && { brightness_pct: effectiveBrightness }),
          ...(resolvedColor && {
            color: resolvedColor.color_name || hueToColorName(resolvedColor.hue, resolvedColor.saturation) || "custom",
          }),
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

    const colorName = color ? hueToColorName(color.hue, color.saturation) : null

    return {
      success: true,
      status: {
        power: dp("switch_led") ? "on" : "off",
        brightness_pct,
        mode,
        ...(colorName && { color: colorName }),
      },
      device_id: deviceId,
    }
  },
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const tools = [controlWifiLamp, getWifiLampStatus]
