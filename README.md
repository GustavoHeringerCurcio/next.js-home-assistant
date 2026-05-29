# Tuya Custom Agent

Local single-user chatbot and talkbot built with Next.js, OpenAI, shadcn/ui, and local SQLite memory.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000`.

## Environment

Set `OPENAI_API_KEY` in `.env.local` to enable the real agent. Without a key, the app runs in local fallback mode.

Memory is stored at `.data/tuya-agent.sqlite` by default.
