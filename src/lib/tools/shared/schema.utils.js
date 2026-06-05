/**
 * Wraps a flat property map into the strict JSON Schema object shape
 * expected by the OpenAI function-calling API.
 *
 * @param {Record<string, object>} shape - Property definitions
 * @param {string[]} required - Required property names
 * @returns {object} JSON Schema object
 */
export function toJsonSchema(shape = {}, required = []) {
  return {
    type: "object",
    properties: shape,
    required,
    additionalProperties: false,
  }
}
