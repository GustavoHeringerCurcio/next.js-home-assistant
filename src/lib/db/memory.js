import { query } from "@/lib/db/client"

export async function saveMessage({ conversationId, role, content, metadata = {} }) {
  try {
    await query(
      `insert into messages (conversation_id, role, content, metadata)
       values ($1, $2, $3, $4)`,
      [conversationId, role, content, JSON.stringify(metadata)]
    )
  } catch (error) {
    console.warn("Failed to save message", error)
  }
}

export async function getRelevantMemories(message, limit = 5) {
  if (!message?.trim()) {
    return []
  }

  try {
    const words = message
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3)
      .slice(0, 8)

    if (!words.length) {
      return []
    }

    const clauses = words.map((_, index) => `lower(content) like $${index + 1}`)
    const { rows } = await query(
      `select id, content, importance, tags, created_at
       from memories
       where ${clauses.join(" or ")}
       order by importance desc, created_at desc
       limit ${Number(limit)}`,
      words.map((word) => `%${word}%`)
    )

    return rows.map((row) => ({
      ...row,
      tags: JSON.parse(row.tags || "[]"),
    }))
  } catch (error) {
    console.warn("Failed to retrieve memories", error)
    return []
  }
}

export async function upsertMemory({ content, tags = [], importance = 0.5 }) {
  try {
    const { rows } = await query(
      `insert into memories (content, tags, importance)
       values ($1, $2, $3)
       returning id, content, tags, importance, created_at`,
      [content, JSON.stringify(tags), importance]
    )

    const memory = rows[0] || null
    return memory
      ? {
          ...memory,
          tags: JSON.parse(memory.tags || "[]"),
        }
      : null
  } catch (error) {
    console.warn("Failed to save memory", error)
    return null
  }
}
