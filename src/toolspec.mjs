/**
 * Tool schema helpers for Format Studio.
 *
 * The harness's own plugins declare tool schemas in a compact form
 * (`{ type, required: true, description }` per property) and convert them with
 * `defineTool` from `@deepseek-ai/dsh-tools`. That package lives inside the dsh
 * installation and is not resolvable from a profile-installed bundle, so this
 * module performs the same compact-to-JSON-Schema conversion locally and the
 * host half registers a plain tool definition.
 */

/** Convert one compact schema node into standard JSON Schema. */
export function toJsonSchema(node) {
  if (!node || typeof node !== 'object') return {};
  const out = {};
  if (node.type) out.type = node.type;
  if (node.description) out.description = node.description;
  if (node.title) out.title = node.title;
  if (Array.isArray(node.enum)) out.enum = node.enum.slice();
  if (node.const !== undefined) out.const = node.const;
  if (node.default !== undefined) out.default = node.default;
  if (Array.isArray(node.examples)) out.examples = node.examples.slice();
  if (Array.isArray(node.oneOf)) out.oneOf = node.oneOf.map(toJsonSchema);
  if (node.items) out.items = toJsonSchema(node.items);
  if (node.additionalProperties !== undefined) out.additionalProperties = node.additionalProperties;

  if (node.properties) {
    out.properties = {};
    const required = [];
    for (const [key, child] of Object.entries(node.properties)) {
      out.properties[key] = toJsonSchema(child);
      if (child && child.required === true) required.push(key);
    }
    if (required.length > 0) out.required = required;
  }
  return out;
}

/** Convert a compact parameters map (`{ name: spec }`) into a JSON Schema object. */
export function toParameterSchema(parameters) {
  return toJsonSchema({ type: 'object', additionalProperties: false, properties: parameters });
}
