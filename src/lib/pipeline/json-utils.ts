/**
 * json-utils.ts — JSON repair utilities for handling malformed LLM responses.
 */

export function repairJson(raw: string): string {
  let s = raw;

  // Remove trailing commas before ] or }
  s = s.replace(/,\s*([}\]])/g, "$1");

  // Fix unescaped newlines inside string values
  s = s.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
    return match.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
  });

  // Close truncated JSON — count unclosed brackets/braces
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }

  // Remove any trailing partial key/value (incomplete entry)
  if (braces > 0 || brackets > 0) {
    // Try to find the last complete object/array element
    const lastComplete = Math.max(s.lastIndexOf("},"), s.lastIndexOf("}]"));
    if (lastComplete > 0) {
      s = s.slice(0, lastComplete + 1);
      // Recount
      braces = 0; brackets = 0; inString = false; escape = false;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (escape) { escape = false; continue; }
        if (ch === "\\") { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") braces++;
        else if (ch === "}") braces--;
        else if (ch === "[") brackets++;
        else if (ch === "]") brackets--;
      }
    }
  }

  // Close any remaining open brackets/braces
  for (let i = 0; i < braces; i++) s += "}";
  for (let i = 0; i < brackets; i++) s += "]";

  return s;
}
