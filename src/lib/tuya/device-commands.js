import { getTuyaContext } from "./tuya-client"

/**
 * Send one or more commands to any Tuya device.
 *
 * @param {string} deviceId - The Tuya device ID from the developer platform
 * @param {Array<{ code: string, value: unknown }>} commands - Standard Instruction Set commands
 * @returns {Promise<object>} Raw Tuya API response
 *
 * @example
 * // Turn a lamp on
 * await sendDeviceCommands(deviceId, [{ code: "switch_led", value: true }])
 *
 * @example
 * // Set brightness (10–1000 on Tuya scale)
 * await sendDeviceCommands(deviceId, [{ code: "bright_value_v2", value: 500 }])
 */
export async function sendDeviceCommands(deviceId, commands) {
  const ctx = getTuyaContext()
  const result = await ctx.request({
    path: `/v1.0/devices/${deviceId}/commands`,
    method: "POST",
    body: { commands },
  })
  return result
}

/**
 * Get all datapoints (status) for a Tuya device.
 *
 * @param {string} deviceId - The Tuya device ID
 * @returns {Promise<object>} Device status object from Tuya Cloud
 */
export async function getDeviceStatus(deviceId) {
  const ctx = getTuyaContext()
  const result = await ctx.request({
    path: `/v1.0/devices/${deviceId}/status`,
    method: "GET",
  })
  return result
}

/**
 * Convenience: check whether a Tuya API result indicates success.
 *
 * @param {object} result - Raw Tuya API response
 * @returns {boolean}
 */
export function isTuyaSuccess(result) {
  return result?.result === true || result?.success === true
}
