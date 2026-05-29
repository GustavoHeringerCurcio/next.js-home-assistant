<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Context

Tuya Custom Agent is a local single-user chatbot/talkbot built with Next.js, OpenAI, local SQLite, and shadcn/ui.

Before changing agent behavior, read:

- `docs/ARCHITECTURE.md`
- `docs/AGENT_RUNTIME.md`
- `docs/TOOL_AUTHORING.md`
- `docs/MEMORY.md`
- `docs/VOICE.md`

Engineering rules:

- Keep the OpenAI API key server-side only. Never expose it with `NEXT_PUBLIC_`.
- Text chat defaults to the cheapest configured model: `OPENAI_TEXT_MODEL`, currently `gpt-5-nano` in `.env.example`.
- Tools live in `src/lib/tools/registry.js` until the registry becomes large enough to split.
- Local SQL persistence lives in `.data/tuya-agent.sqlite` by default and initializes its schema in `src/lib/db/client.js`.
- There is no authentication by design; this is a local single-user app.
