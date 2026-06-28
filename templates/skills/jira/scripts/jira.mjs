#!/usr/bin/env node
/**
 * Deterministic Jira issue fetcher. Emits TOON on stdout (caveman FULL).
 *
 * Usage: node jira.mjs --issue FXDOMAIN-1234
 * Env:   ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN
 */

// ---- tiny TOON encoder (self-contained) -------------------------------------
function scalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v).replace(/\r?\n/g, ' ').trim();
  if (s === '' || /[\s,:{}\[\]"]/.test(s)) return '"' + s.replace(/"/g, '\\"') + '"';
  return s;
}
function emit(obj, depth, out) {
  const pad = '  '.repeat(depth);
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      if (v.length === 0) { out.push(`${pad}${k}[0]:`); continue; }
      const allScalar = v.every((x) => x === null || typeof x !== 'object');
      if (allScalar) { out.push(`${pad}${k}[${v.length}]: ${v.map(scalar).join(',')}`); continue; }
      const keys = Object.keys(v[0]);
      const uniform = v.every((o) => o && typeof o === 'object' && Object.keys(o).join() === keys.join()
        && keys.every((kk) => o[kk] === null || typeof o[kk] !== 'object'));
      if (uniform) {
        out.push(`${pad}${k}[${v.length}]{${keys.join(',')}}:`);
        for (const row of v) out.push(`${pad}  ${keys.map((kk) => scalar(row[kk])).join(',')}`);
      } else {
        out.push(`${pad}${k}[${v.length}]:`);
        v.forEach((el) => { out.push(`${pad}  -`); emit(el, depth + 2, out); });
      }
    } else if (v && typeof v === 'object') {
      out.push(`${pad}${k}:`); emit(v, depth + 1, out);
    } else {
      out.push(`${pad}${k}: ${scalar(v)}`);
    }
  }
}
function toon(obj) { const out = []; emit(obj, 0, out); return out.join('\n'); }
function fail(message) { console.log(toon({ error: { skill: 'jira', message } })); process.exit(1); }

// ---- arg parsing ------------------------------------------------------------
function getArg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const issue = getArg('issue') || process.argv.find((a) => /^[A-Z][A-Z0-9]+-\d+$/.test(a));
if (!issue) fail('missing --issue <KEY>');

const base = process.env.ATLASSIAN_BASE_URL;
const email = process.env.ATLASSIAN_EMAIL;
const token = process.env.ATLASSIAN_API_TOKEN;
if (!base || !email || !token) {
  fail('missing env ATLASSIAN_BASE_URL/ATLASSIAN_EMAIL/ATLASSIAN_API_TOKEN');
}

// ---- ADF → plain text (best effort) -----------------------------------------
function adfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  let t = '';
  if (node.text) t += node.text;
  if (Array.isArray(node.content)) t += node.content.map(adfText).join(' ');
  return t;
}
const FIGMA_RE = /https?:\/\/(?:www\.)?figma\.com\/[^\s)"']+/g;

(async () => {
  const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
  const fields = 'summary,description,status,issuetype,labels,comment,issuelinks';
  const url = `${base.replace(/\/$/, '')}/rest/api/3/issue/${encodeURIComponent(issue)}?fields=${fields}`;

  let res;
  try {
    res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } });
  } catch (e) {
    fail(`request failed: ${e.message}`);
  }
  if (!res.ok) fail(`http ${res.status} fetching ${issue}`);
  const data = await res.json();
  const f = data.fields || {};

  const descText = adfText(f.description);
  const comments = (f.comment?.comments || []).map((c) => ({
    author: c.author?.displayName || 'unknown',
    body: adfText(c.body),
  }));
  const links = (f.issuelinks || [])
    .map((l) => {
      const o = l.outwardIssue || l.inwardIssue;
      if (!o) return null;
      return { type: l.type?.name || 'rel', key: o.key, summary: o.fields?.summary || '' };
    })
    .filter(Boolean);

  const haystack = [descText, ...comments.map((c) => c.body)].join('\n');
  const figmaLinks = Array.from(new Set(haystack.match(FIGMA_RE) || []));

  const result = {
    issue: {
      key: data.key,
      summary: f.summary || '',
      status: f.status?.name || '',
      type: f.issuetype?.name || '',
    },
    labels: f.labels || [],
    description: descText,
    comments,
    links,
    figmaLinks,
  };
  console.log(toon(result));
})();
