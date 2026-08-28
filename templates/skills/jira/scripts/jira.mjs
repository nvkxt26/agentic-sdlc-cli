#!/usr/bin/env node
/**
 * Deterministic Jira issue fetcher. Emits TOON on stdout (caveman FULL).
 *
 * Usage:
 *   node jira.mjs --issue FXDOMAIN-1234        # single issue
 *   node jira.mjs --epic  FXDOMAIN-1000        # epic + its child issues
 * Env:   ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN
 */
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

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

export function buildJql({ jql, sprint, assignee, board }) {
  if (jql) {
    const hasOrderBy = /order\s+by/i.test(jql);
    return hasOrderBy ? jql : `${jql} ORDER BY priority DESC, created ASC`;
  }
  let query = '';
  if (sprint) {
    if (sprint === 'active') {
      query = 'sprint in openSprints()';
    } else if (/^\d+$/.test(sprint)) {
      query = `sprint = ${sprint}`;
    } else {
      throw new Error(`invalid sprint value: ${sprint} (expected numeric id or "active")`);
    }
    const user = assignee || 'currentUser()';
    query += ` AND assignee = ${user}`;
  } else {
    const user = assignee || 'currentUser()';
    query = `assignee = ${user}`;
  }
  return `${query} ORDER BY priority DESC, created ASC`;
}

// ---- ADF → plain text (best effort) -----------------------------------------
const ADF_BLOCK = /^(paragraph|heading|listItem|bulletList|orderedList|blockquote|codeBlock)$/;
export function adfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  let t = '';
  if (node.text) t += node.text;
  if (Array.isArray(node.content)) {
    const childHasBlock = node.content.some((c) => c && ADF_BLOCK.test(c.type));
    t += node.content.map(adfText).join(childHasBlock ? '\n' : ' ');
  }
  return t;
}

// ---- self-learning custom-field discovery -----------------------------------
// Custom-field ids (e.g. Acceptance Criteria = customfield_10903) vary per
// Atlassian account, so we never hardcode them. Instead we discover the field
// by display-name heuristic, learn its id into a per-host cache, and reuse it
// first on later runs — growing the cache when a new field is discovered.
export const ACCEPTANCE_RE = /acceptance/i;

/** Ids of custom fields whose display name matches `re` (default: acceptance). */
export function matchAcceptanceFields(defs, re = ACCEPTANCE_RE) {
  return (defs || [])
    .filter((d) => d && d.custom && typeof d.name === 'string' && re.test(d.name))
    .map((d) => d.id);
}

/** Normalize any Jira custom-field value shape to plain text. */
export function parseFieldValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(parseFieldValue).filter(Boolean).join('; ');
  if (typeof v === 'object') {
    if (typeof v.value === 'string') return v.value.trim();
    if (v.type || Array.isArray(v.content)) return adfText(v).trim();
    if (typeof v.displayName === 'string') return v.displayName.trim();
    if (typeof v.name === 'string') return v.name.trim();
    return '';
  }
  return String(v).trim();
}

/** Host portion of the Atlassian base url — the per-account cache key. */
export function hostKey(baseUrl) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return String(baseUrl || 'default');
  }
}

/** Prepend `id` to the learned list, deduped and learned-first. */
export function mergeLearned(existing, id) {
  const list = Array.isArray(existing) ? existing.slice() : [];
  if (!id) return list;
  return [id, ...list.filter((x) => x !== id)];
}

export function cacheFilePath(cwd = process.cwd()) {
  return join(cwd, '.agentic', 'cache', 'jira-fields.json');
}

export function loadFieldCache(file = cacheFilePath()) {
  try {
    if (!existsSync(file)) return {};
    return JSON.parse(readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
}

export function saveFieldCache(data, file = cacheFilePath()) {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

// ---- workflow transitions (status changes) ----------------------------------
export function normalizeStatus(s) {
  return String(s ?? '').trim().toLowerCase();
}

/** Transition whose target status name equals `to` (case-insensitive), or null. */
export function findDirectTransition(transitions, to) {
  const target = normalizeStatus(to);
  return (transitions || []).find((t) => normalizeStatus(t?.to?.name) === target) || null;
}

/**
 * Pick the next transition toward `to`: a direct one if available, otherwise the
 * first transition whose target status has not been visited yet (greedy hop).
 */
export function chooseNextTransition(transitions, to, visited = new Set()) {
  const direct = findDirectTransition(transitions, to);
  if (direct) return direct;
  return (transitions || []).find((t) => t?.to?.name && !visited.has(normalizeStatus(t.to.name))) || null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const issue = getArg('issue') || (!process.argv.includes('--epic') && !process.argv.includes('--jql') && !process.argv.includes('--sprint') && process.argv.find((a) => /^[A-Z][A-Z0-9]+-\d+$/.test(a)));
  const epic = getArg('epic');
  const jql = getArg('jql');
  const sprint = getArg('sprint');
  const assignee = getArg('assignee');
  const board = getArg('board');
  const transitionTo = getArg('transition');
  const listTransitions = process.argv.includes('--list-transitions');

  if (!issue && !epic && !jql && !sprint && !assignee && !board) {
    fail('missing --issue <KEY>, --epic <KEY>, --jql <query>, or --sprint <id|active>');
  }
  if ((transitionTo || listTransitions) && !issue) {
    fail('--transition/--list-transitions require --issue <KEY>');
  }

  const base = process.env.ATLASSIAN_BASE_URL;
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  if (!base || !email || !token) {
    fail('missing env ATLASSIAN_BASE_URL/ATLASSIAN_EMAIL/ATLASSIAN_API_TOKEN');
  }
  const BASE = base.replace(/\/$/, '');
  const AUTH = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');

  async function getJson(url) {
    let res;
    try {
      res = await fetch(url, { headers: { Authorization: AUTH, Accept: 'application/json' } });
    } catch (e) {
      fail(`request failed: ${e.message}`);
    }
    if (!res.ok) fail(`http ${res.status} fetching ${url}`);
    return res.json();
  }

  // Non-fatal variant: returns null on any failure so discovery/enrichment
  // never crashes the core issue fetch.
  async function getJsonSafe(url) {
    try {
      const res = await fetch(url, { headers: { Authorization: AUTH, Accept: 'application/json' } });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  const FIGMA_RE = /https?:\/\/(?:www\.)?figma\.com\/[^\s)"']+/g;

  // All field definitions ({id,name,custom}); [] on failure.
  async function fetchFieldDefs() {
    const defs = await getJsonSafe(`${BASE}/rest/api/3/field`);
    if (!Array.isArray(defs)) return [];
    return defs.map((d) => ({ id: d.id, name: d.name || '', custom: !!d.custom }));
  }

  // First candidate id whose value is non-empty.
  function pickAcceptance(fields, ids, idName) {
    for (const id of ids) {
      const value = parseFieldValue(fields?.[id]);
      if (value) return { id, name: idName.get(id) || id, value };
    }
    return { id: null, name: '', value: '' };
  }

  async function fetchIssue(key) {
    const STD = 'summary,description,status,issuetype,labels,comment,issuelinks';
    const issueUrl = (spec) =>
      `${BASE}/rest/api/3/issue/${encodeURIComponent(key)}?fields=${spec}`;

    const cache = loadFieldCache();
    const host = hostKey(BASE);
    const entry = cache[host] || {};
    const DEFS_TTL = 24 * 60 * 60 * 1000;
    const defsFresh =
      Array.isArray(entry.defs) && entry.ts && Date.now() - entry.ts < DEFS_TTL;
    let defs = defsFresh ? entry.defs : await fetchFieldDefs();
    if (!defsFresh && defs.length) {
      entry.defs = defs;
      entry.ts = Date.now();
    }

    const learned = Array.isArray(entry.acceptanceFieldIds) ? entry.acceptanceFieldIds : [];
    const candidateIds = [];
    for (const id of [...learned, ...matchAcceptanceFields(defs)]) {
      if (id && !candidateIds.includes(id)) candidateIds.push(id);
    }

    let data = candidateIds.length
      ? await getJsonSafe(issueUrl(`${STD},${candidateIds.join(',')}`))
      : null;
    if (!data) data = await getJson(issueUrl(STD));
    let f = data.fields || {};

    let idName = new Map((defs || []).map((d) => [d.id, d.name]));
    let picked = pickAcceptance(f, candidateIds, idName);

    // Learned/heuristic candidates yielded nothing → discover from all fields,
    // learn the id, and grow the cache for future runs.
    if (!picked.value) {
      const freshDefs = await fetchFieldDefs();
      if (freshDefs.length) {
        defs = freshDefs;
        entry.defs = freshDefs;
        entry.ts = Date.now();
        idName = new Map(freshDefs.map((d) => [d.id, d.name]));
      }
      const rescanIds = matchAcceptanceFields(defs).filter((id) => !candidateIds.includes(id));
      if (rescanIds.length) {
        const allData = await getJsonSafe(issueUrl('*all'));
        if (allData?.fields) {
          const picked2 = pickAcceptance(allData.fields, rescanIds, idName);
          if (picked2.value) {
            picked = picked2;
            f = allData.fields;
          }
        }
      }
    }

    if (picked.id) entry.acceptanceFieldIds = mergeLearned(learned, picked.id);
    cache[host] = entry;
    saveFieldCache(cache);

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

    const acceptance = picked.value
      ? picked.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      : [];

    const customFields = [];
    for (const id of candidateIds) {
      if (id === picked.id) continue;
      const value = parseFieldValue(f[id]);
      if (value) customFields.push({ name: idName.get(id) || id, value });
    }

    const result = {
      issue: {
        key: data.key,
        summary: f.summary || '',
        status: f.status?.name || '',
        type: f.issuetype?.name || '',
      },
      labels: f.labels || [],
      description: descText,
      acceptance,
    };
    if (customFields.length) result.customFields = customFields;
    result.comments = comments;
    result.links = links;
    result.figmaLinks = figmaLinks;
    return result;
  }

  async function fetchEpicChildren(epicKey) {
    // Team-managed projects use `parent`; company-managed use the "Epic Link" field.
    const jql = `parent = "${epicKey}" OR "Epic Link" = "${epicKey}" ORDER BY created ASC`;
    const url = `${BASE}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,issuetype,status,labels&maxResults=100`;
    const data = await getJson(url);
    return (data.issues || []).map((i) => ({
      key: i.key,
      summary: i.fields?.summary || '',
      type: i.fields?.issuetype?.name || '',
      status: i.fields?.status?.name || '',
      labels: (i.fields?.labels || []).join('|'),
    }));
  }

  async function fetchTickets(jql) {
    const url = `${BASE}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,issuetype,status,labels,priority,created,assignee&maxResults=100`;
    const data = await getJson(url);
    return (data.issues || []).map((i) => ({
      key: i.key,
      summary: i.fields?.summary || '',
      type: i.fields?.issuetype?.name || '',
      status: i.fields?.status?.name || '',
      priority: i.fields?.priority?.name || '',
      created: i.fields?.created?.split('T')[0] || '',
      assignee: i.fields?.assignee?.displayName || '',
    }));
  }

  async function fetchStatus(key) {
    const data = await getJson(`${BASE}/rest/api/3/issue/${encodeURIComponent(key)}?fields=status`);
    return data.fields?.status?.name || '';
  }

  async function fetchTransitions(key) {
    const data = await getJson(`${BASE}/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);
    return (data.transitions || []).map((t) => ({
      id: t.id,
      name: t.name || '',
      to: { id: t.to?.id || '', name: t.to?.name || '' },
    }));
  }

  async function applyTransition(key, transitionId) {
    let res;
    try {
      res = await fetch(`${BASE}/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, {
        method: 'POST',
        headers: { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ transition: { id: String(transitionId) } }),
      });
    } catch (e) {
      fail(`transition request failed: ${e.message}`);
    }
    if (!res.ok) fail(`http ${res.status} applying transition ${transitionId} on ${key}`);
  }

  (async () => {
  if (listTransitions) {
    const current = await fetchStatus(issue);
    const trs = await fetchTransitions(issue);
    console.log(
      toon({
        transitions: { issue, status: current, count: trs.length },
        available: trs.map((t) => ({ name: t.name, to: t.to.name })),
      }),
    );
    return;
  }

  if (transitionTo) {
    const maxHopsArg = Number(getArg('max-hops'));
    const maxHops = Number.isFinite(maxHopsArg) && maxHopsArg > 0 ? maxHopsArg : 5;
    const from = await fetchStatus(issue);
    if (normalizeStatus(from) === normalizeStatus(transitionTo)) {
      console.log(toon({ transition: { issue, from, to: from, hops: 0, status: 'already-there' } }));
      return;
    }
    const visited = new Set([normalizeStatus(from)]);
    const path = [];
    let current = from;
    for (let hop = 0; hop < maxHops; hop++) {
      const trs = await fetchTransitions(issue);
      const next = chooseNextTransition(trs, transitionTo, visited);
      if (!next) {
        const options = trs.map((t) => t.to.name).filter(Boolean).join(', ') || 'none';
        fail(`cannot reach "${transitionTo}" from "${current}"; available: ${options}`);
      }
      await applyTransition(issue, next.id);
      current = next.to.name;
      path.push(current);
      visited.add(normalizeStatus(current));
      if (normalizeStatus(current) === normalizeStatus(transitionTo)) {
        console.log(
          toon({ transition: { issue, from, to: current, hops: path.length, status: 'done' }, path }),
        );
        return;
      }
    }
    fail(`did not reach "${transitionTo}" within ${maxHops} hops; now at "${current}" (path: ${path.join(' → ')})`);
  }

  if (jql || sprint || assignee || board) {
    try {
      const query = buildJql({ jql, sprint, assignee, board });
      const tickets = await fetchTickets(query);
      console.log(
        toon({
          query: { jql: query, count: tickets.length },
          tickets,
        }),
      );
    } catch (e) {
      fail(e.message);
    }
    return;
  }

  if (epic) {
    const parent = await fetchIssue(epic);
    const children = await fetchEpicChildren(epic);
    const out = {
      epic: {
        key: parent.issue.key,
        summary: parent.issue.summary,
        status: parent.issue.status,
        type: parent.issue.type,
        childCount: children.length,
      },
      description: parent.description,
    };
    if (parent.acceptance?.length) out.acceptance = parent.acceptance;
    if (parent.customFields?.length) out.customFields = parent.customFields;
    out.children = children;
    console.log(toon(out));
    return;
  }

  const result = await fetchIssue(issue);
  console.log(toon(result));
  })();
}
