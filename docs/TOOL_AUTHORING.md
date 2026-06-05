# Tool Authoring

Tools are defined in `src/lib/tools/registry.js`.

## Tool Shape

Each tool has:

- `name`: stable snake_case function name.
- `description`: tells the model when to use it.
- `parameters`: JSON schema passed to OpenAI.
- `schema`: Zod validation before execution.
- `execute(args)`: server-side implementation.

## Rules

- Tools always run on the server.
- Validate all arguments with Zod.
- Return JSON-serializable results.
- Never return secrets.
- Save important side effects in local SQLite where appropriate.

## Starter Test Tools

- `get_current_time`: confirms tool calling works.
- `save_memory`: writes a durable memory to local SQLite.

## Adding A Tool

1. Add a new object to the `tools` array.
2. Include a strict JSON schema with `additionalProperties: false` unless free-form input is required.
3. Add Zod validation.
4. Test with a natural request that requires the new tool.

## Tuya Device Tools

Tuya IoT tools share a singleton API client and generic helpers — never instantiate `TuyaContext` directly in a tool.

### Architecture

```
registry.js tool
  └── src/lib/tuya/device-commands.js  (sendDeviceCommands, getDeviceStatus)
        └── src/lib/tuya/tuya-client.js  (TuyaContext singleton)
              └── @tuya/tuya-connector-nodejs  (Tuya Cloud OpenAPI)
```

### Adding a New Tuya Device Tool

1. **Add a device ID env var** to `.env` and `.env.example`:
   ```
   TUYA_FAN_DEVICE_ID=
   ```

2. **Look up the Standard Instruction Set** for your device type on the
   [Tuya Developer Platform](https://iot.tuya.com) → Cloud → Devices → your device.

3. **Add a tool to `registry.js`** following this pattern:
   ```js
   import { sendDeviceCommands, isTuyaSuccess } from "@/lib/tuya/device-commands"

   {
     name: "control_fan",
     description: "Turn the user's fan on or off.",
     parameters: toJsonSchema(
       { action: { type: "string", enum: ["on", "off"] } },
       ["action"]
     ),
     schema: z.object({ action: z.enum(["on", "off"]) }),
     async execute(args) {
       const deviceId = process.env.TUYA_FAN_DEVICE_ID
       if (!deviceId) return { success: false, error: "TUYA_FAN_DEVICE_ID not set" }
       const result = await sendDeviceCommands(deviceId, [
         { code: "switch", value: args.action === "on" },
       ])
       return isTuyaSuccess(result)
         ? { success: true, action: args.action }
         : { success: false, error: result?.msg }
     },
   }
   ```

### Common Tuya Command Codes

| Device | Code | Value type |
|--------|------|------------|
| LED lamp — power | `switch_led` | boolean |
| LED lamp — brightness | `bright_value_v2` | number 10–1000 |
| LED lamp — color mode | `work_mode` | `"colour"` \| `"white"` |
| LED lamp — HSV color | `colour_data_v2` | `{ h: 0-360, s: 0-1000, v: 0-1000 }` |
| Fan / socket | `switch` | boolean |
| Fan speed | `fan_speed_enum` | `"1"` \| `"2"` \| `"3"` |
| AC — power | `switch` | boolean |
| AC — mode | `mode` | `"cold"` \| `"hot"` \| `"wind"` \| `"wet"` |
| AC — temperature | `temp_set` | number (°C × 10 on some models) |

### Env Vars Convention

Use `TUYA_<DEVICE_LABEL>_DEVICE_ID` for each device.  
Shared credentials (`TUYA_ACCESS_ID`, `TUYA_ACCESS_SECRET`, `TUYA_BASE_URL`) are defined once.
