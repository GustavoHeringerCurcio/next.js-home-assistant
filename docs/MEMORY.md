# Memory

Memory uses a local SQLite database through `better-sqlite3`. The schema is initialized in code by `src/lib/db/client.js`.

## Tables

Created automatically in `.data/tuya-agent.sqlite` by default:

- `messages`
- `memories`

Embeddings are intentionally not part of the MVP. The first version keeps memory cheap and simple.

## Current Retrieval

`src/lib/db/memory.js` performs keyword-style lookup against memory content. This keeps the MVP cheap because it does not call an embedding model on every message.

## Future Upgrade

Add embeddings only if memory volume grows enough to justify the extra cost and complexity:

1. Generate embeddings only for saved memories.
2. Add a vector store or a separate local embedding index.
3. Keep keyword fallback for local/offline development.

## Failure Mode

If `LOCAL_SQLITE_PATH` is not set, the app uses `.data/tuya-agent.sqlite`. The `.data/` folder is ignored by git.
