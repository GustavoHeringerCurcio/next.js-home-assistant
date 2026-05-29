# Agent Runtime

The text agent uses the OpenAI Responses API through `src/lib/agent/run-agent.js`.

## Model Policy

`OPENAI_TEXT_MODEL` controls the text model. The default is `gpt-5-nano` because this project optimizes for low cost.

`OPENAI_REALTIME_MODEL` controls the future realtime voice model. The default is `gpt-realtime-mini`. The current code creates an ephemeral realtime session from `src/app/api/realtime/session/route.js`.

## Turn Lifecycle

1. Normalize recent user and assistant messages.
2. Save the latest user message to local SQLite.
3. Retrieve relevant durable memories.
4. Send the turn to OpenAI with the tool registry.
5. Execute any function calls requested by the model.
6. Append `function_call_output` items and continue until the model returns final text.
7. Save the assistant response.

## Local Fallback

If `OPENAI_API_KEY` is missing, the agent does not call OpenAI. It returns a local setup response and can answer basic server-time questions.
