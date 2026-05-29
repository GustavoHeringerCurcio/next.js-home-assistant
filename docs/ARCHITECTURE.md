# Architecture

Tuya Custom Agent is a local single-user assistant with text chat, voice input/output, tool calling, and durable memory.

## Stack

- Next.js App Router in `src/app`
- React chat UI in `src/components/agent-console.jsx`
- shadcn/ui components in `src/components/ui`
- OpenAI Responses API for typed chat and tool calling
- File-backed local SQLite through `better-sqlite3`

## Main Flow

1. The user types or speaks in the browser.
2. The UI posts messages to `POST /api/chat`.
3. `src/lib/agent/run-agent.js` retrieves memories, calls OpenAI, executes requested tools, and saves messages.

## Local-First Behavior

The app runs without `OPENAI_API_KEY`. Without an OpenAI key, it returns a local setup message. Memory persistence uses `.data/tuya-agent.sqlite` by default and is created automatically.

## Key Files

- `src/lib/config.js`: model names and system prompt.
- `src/lib/agent/run-agent.js`: OpenAI Responses tool loop.
- `src/lib/tools/registry.js`: tool definitions and execution.
- `src/lib/db/client.js`: local SQL connection and schema.
- `src/lib/db/memory.js`: message and memory persistence.
- `src/app/api/chat/route.js`: chat endpoint.
- `src/app/api/realtime/session/route.js`: OpenAI realtime session scaffold.
