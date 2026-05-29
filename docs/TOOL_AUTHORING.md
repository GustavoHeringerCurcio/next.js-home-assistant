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
