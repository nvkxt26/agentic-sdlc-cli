#!/usr/bin/env node
/**
 * Deterministic Confluence page fetcher. Emits TOON on stdout (caveman FULL).
 *
 * Usage: node confluence.mjs --id 123456
 *        node confluence.mjs --title "Design doc" --space ENG
 * Env:   ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN
 */

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
      out.push(`${pad}${k}[${v.length}]: ${v.map(scalar).join(',')}`);
    } else if (v && typeof v === 'object') {
      out.push(`${pad}${k}:`); emit(v, depth + 1, out);
    } else {
      out.push(`${pad}${k}: ${scalar(v)}`);
    }
  }
}
function toon(obj) { const out = []; emit(obj, 0, out); return out.join('\n'); }
function fail(message) { console.log(toon({ error: { skill: 'confluence', message } })); process.exit(1); }
function getArg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

const id = getArg('id');
const title = getArg('title');
const space = getArg('space');
if (!id && !(title && space)) fail('provide --id <pageId> or --title <t> --space <KEY>');

const base = process.env.ATLASSIAN_BASE_URL;
const email = process.env.ATLASSIAN_EMAIL;
const token = process.env.ATLASSIAN_API_TOKEN;
if (!base || !email || !token) fail('missing env ATLASSIAN_BASE_URL/ATLASSIAN_EMAIL/ATLASSIAN_API_TOKEN');

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

(async () => {
  const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
  const root = base.replace(/\/$/, '');
  let url;
  if (id) {
    url = `${root}/wiki/rest/api/content/${encodeURIComponent(id)}?expand=body.storage,version,space`;
  } else {
    url = `${root}/wiki/rest/api/content?title=${encodeURIComponent(title)}&spaceKey=${encodeURIComponent(space)}&expand=body.storage,version,space`;
  }

  let res;
  try {
    res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } });
  } catch (e) {
    fail(`request failed: ${e.message}`);
  }
  if (!res.ok) fail(`http ${res.status} fetching confluence page`);
  const data = await res.json();
  const page = id ? data : (data.results && data.results[0]);
  if (!page) fail('page not found');

  const result = {
    page: {
      id: page.id,
      title: page.title || '',
      space: page.space?.key || space || '',
      version: page.version?.number || '',
      url: page._links?.base && page._links?.webui ? page._links.base + page._links.webui : '',
    },
    body: stripHtml(page.body?.storage?.value),
  };
  console.log(toon(result));
})();
