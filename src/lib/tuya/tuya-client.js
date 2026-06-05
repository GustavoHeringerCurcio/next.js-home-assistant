import { TuyaContext } from "@tuya/tuya-connector-nodejs"

let _context = null

/**
 * Returns a lazy-initialized singleton TuyaContext.
 * All Tuya device tools should import and use this instead of
 * creating their own context.
 *
 * Required env vars:
 *   TUYA_ACCESS_ID      — your Tuya IoT project Access ID
 *   TUYA_ACCESS_SECRET  — your Tuya IoT project Access Secret
 *   TUYA_BASE_URL       — regional API base URL (default: Western Americas)
 */
export function getTuyaContext() {
  if (_context) return _context

  const accessKey = process.env.TUYA_ACCESS_ID
  const secretKey = process.env.TUYA_ACCESS_SECRET
  const baseUrl = process.env.TUYA_BASE_URL || "https://openapi.tuyaus.com"

  if (!accessKey || !secretKey) {
    throw new Error(
      "Tuya credentials are missing. Set TUYA_ACCESS_ID and TUYA_ACCESS_SECRET in your .env file."
    )
  }

  _context = new TuyaContext({ baseUrl, accessKey, secretKey })
  return _context
}
