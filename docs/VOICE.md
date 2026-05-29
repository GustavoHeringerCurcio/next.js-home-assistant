# Voice

The current UI provides voice input and output with browser APIs:

- Voice input: `SpeechRecognition` or `webkitSpeechRecognition`
- Voice output: `speechSynthesis`

This keeps the first version cheap because spoken turns still use the same text agent endpoint.

## Current Flow

1. The user clicks the mic button.
2. The browser transcribes speech locally or via the browser provider.
3. The transcript is sent to `POST /api/chat`.
4. The assistant response is spoken with `speechSynthesis` when voice output is enabled.

## OpenAI Realtime Scaffold

`POST /api/realtime/session` creates an ephemeral OpenAI realtime session using `OPENAI_REALTIME_MODEL`. This keeps the main API key server-side.

The next voice upgrade should connect the browser to OpenAI Realtime over WebRTC using the returned `client_secret` and route realtime function calls back through the server-side tool registry.
