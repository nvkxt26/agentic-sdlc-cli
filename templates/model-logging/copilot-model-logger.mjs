#!/usr/bin/env node
/**
 * agentic-sdlc — GitHub Copilot model-usage logger hook (INTENDED model).
 *
 * Registered in `.github/hooks/agentic-model-logging.json` for the
 * SessionStart / SubagentStart / SubagentStop / Stop lifecycle events (honoured
 * by both VS Code Copilot Chat and the Copilot CLI). Copilot's hook payloads
 * expose the agent name (`agent_type`) and lifecycle, but — unlike Claude Code
 * and OpenCode — they do NOT expose the resolved model, and the transcript
 * format is explicitly documented as unstable. So this logger records the
 * agent's *intended* (configured) model, read straight from the installed
 * `.github/agentic-sdlc/agents/<agent>.agent.md` frontmatter.
 *
 * To see the ACTUAL model a Copilot subagent ran on, hover the subagent's
 * collapsed tool call in the chat view (it shows the model + AI credits), or
 * open the agent debug log (Developer: Show Agent Debug Logs).
 *
 * Appends to `.agentic/logs/model-usage.log`. Always exits 0 with
 * `{"continue":true}` so it never interferes with the agent.
 */
import { appendFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/** Best-effort: find the intended model in an agent file's YAML frontmatter. */
function intendedModelFor(projectDir, agentType) {
  if (!agentType) return 'unknown';
  const agentDirs = [
    join(projectDir, '.github', 'agentic-sdlc', 'agents'),
    join(projectDir, '.github', 'agents'),
  ].filter((dir) => existsSync(dir));
  if (agentDirs.length === 0) return 'unknown';

  const wanted = String(agentType).toLowerCase();
  for (const agentsDir of agentDirs) {
    let files = [];
    try {
      files = readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
    } catch {
      continue;
    }

    for (const file of files) {
      const stem = file.replace(/\.agent\.md$/, '').replace(/\.md$/, '');
      let body = '';
      try {
        body = readFileSync(join(agentsDir, file), 'utf8');
      } catch {
        continue;
      }
      const nameMatch = body.match(/^\s*name:\s*(.+)\s*$/m);
      const declaredName = nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';
      const candidates = [stem.toLowerCase(), declaredName.toLowerCase()].filter(Boolean);
      if (!candidates.includes(wanted)) continue;

      const modelMatch = body.match(/^\s*model:\s*(.+)\s*$/m);
      if (modelMatch) return modelMatch[1].trim();
      return 'unspecified';
    }
  }
  return 'unknown';
}

function main() {
  let payload = {};
  try {
    payload = JSON.parse(readStdin() || '{}');
  } catch {
    payload = {};
  }

  const projectDir = payload.cwd || process.cwd();
  const event = payload.hook_event_name || 'Stop';
  const agent = payload.agent_type || (event === 'SessionStart' || event === 'Stop' ? '(session)' : '(subagent)');
  const session = payload.session_id || '-';
  const model =
    event === 'SubagentStart' || event === 'SubagentStop'
      ? intendedModelFor(projectDir, payload.agent_type)
      : 'n/a';

  const logDir = join(projectDir, '.agentic', 'logs');
  try {
    mkdirSync(logDir, { recursive: true });
    const ts = new Date().toISOString();
    appendFileSync(
      join(logDir, 'model-usage.log'),
      `${ts} ${event} source=intended model=${model} agent=${agent} session=${session}` +
        ` note="actual model: hover the subagent in chat for model+credits"\n`,
    );
  } catch {
    /* logging must never interfere with the agent */
  }
}

try {
  main();
} catch {
  /* swallow */
}
// Never block the agent.
process.stdout.write('{"continue":true}');
process.exit(0);
