/**
 * Minimal TOON (Token-Oriented Object Notation) encoder.
 *
 * TOON is the wire format for all inter-skill communication (requirement #6).
 * It is line-oriented and indentation-based, and collapses arrays of uniform
 * objects into a compact tabular form to minimise tokens.
 *
 * Supported:
 *  - scalars: string | number | boolean | null
 *  - nested objects
 *  - arrays of primitives:        key[3]: a,b,c
 *  - arrays of uniform objects:   key[2]{f1,f2}:
 *                                   v1,v2
 *                                   v3,v4
 */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const INDENT = '  ';

function encodeScalar(v: Json): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (s === '' || /[\s,:{}[\]"]/.test(s)) {
    return '"' + s.replaceAll('\\', String.raw`\\`).replaceAll('"', String.raw`\"`) + '"';
  }
  return s;
}

function isObject(v: Json): v is { [k: string]: Json } {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** True when every element is a non-null object sharing the exact same keys. */
function uniformObjectArray(
  arr: Json[],
): { uniform: true; keys: string[] } | { uniform: false } {
  if (arr.length === 0) return { uniform: false };
  if (!arr.every(isObject)) return { uniform: false };
  const keys = Object.keys(arr[0]);
  if (keys.length === 0) return { uniform: false };
  const sig = keys.join('\u0000');
  const allSame = arr.every((o) => Object.keys(o as object).join('\u0000') === sig);
  // tabular form only makes sense when cell values are scalars
  const scalarCells = arr.every((o) =>
    keys.every((k) => {
      const cell = (o as Record<string, Json>)[k];
      return cell === null || typeof cell !== 'object';
    }),
  );
  return allSame && scalarCells ? { uniform: true, keys } : { uniform: false };
}

function primitiveArray(arr: Json[]): boolean {
  return arr.every((v) => v === null || typeof v !== 'object');
}

function encodeValue(key: string, value: Json, depth: number, out: string[]): void {
  const pad = INDENT.repeat(depth);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push(`${pad}${key}[0]:`);
      return;
    }
    if (primitiveArray(value)) {
      out.push(`${pad}${key}[${value.length}]: ${value.map(encodeScalar).join(',')}`);
      return;
    }
    const u = uniformObjectArray(value);
    if (u.uniform) {
      out.push(`${pad}${key}[${value.length}]{${u.keys.join(',')}}:`);
      for (const row of value) {
        const cells = u.keys.map((k) => encodeScalar((row as Record<string, Json>)[k]));
        out.push(`${pad}${INDENT}${cells.join(',')}`);
      }
      return;
    }
    // non-uniform: fall back to one indexed block per element
    out.push(`${pad}${key}[${value.length}]:`);
    value.forEach((el, i) => {
      if (isObject(el)) {
        out.push(`${pad}${INDENT}- ${i}:`);
        for (const [k, v] of Object.entries(el)) encodeValue(k, v, depth + 2, out);
      } else {
        out.push(`${pad}${INDENT}- ${encodeScalar(el)}`);
      }
    });
    return;
  }

  if (isObject(value)) {
    out.push(`${pad}${key}:`);
    for (const [k, v] of Object.entries(value)) encodeValue(k, v, depth + 1, out);
    return;
  }

  out.push(`${pad}${key}: ${encodeScalar(value)}`);
}

/** Encode a JSON-compatible value as TOON text. */
export function toToon(data: { [k: string]: Json }): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(data)) encodeValue(k, v, 0, out);
  return out.join('\n');
}
