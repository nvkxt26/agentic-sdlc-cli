#!/usr/bin/env node
/**
 * agentic-workflow — Claude Code model-usage logger hook.
 *
 * Registered in `.claude/settings.json` for the `Stop` (main agent finished)
 * and `SubagentStop` (a persona subagent finished) events. Claude Code passes a
 * JSON payload on stdin that includes `transcript_path` — a JSONL transcript in
 * which every assistant turn records its real `model`. We read the last
 * assistant entry and log the ACTUAL model that executed (ground truth from the
 * runtime, not the model merely configured on the agent file).
 *
 * Appends to `.agentic/logs/model-usage.log`. Zero dependencies; fully
 * defensive — any failure exits 0 so it never blocks the agent.
 */
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function main() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8'); // stdin
  } catch {
    return;
  }

  let payload = {};
  try {
    payload = JSON.parse(raw || '{}');
  } catch {
    return;
  }

  const projectDir = process.env['CLAUDE_PROJECT_DIR'] || payload.cwd || process.cwd();
  const event = payload.hook_event_name || 'Stop';
  const agent = payload.agent_type || (event === 'SubagentStop' ? '(subagent)' : '(main)');
  const session = payload.session_id || '-';

  // Extract the actual model from the last assistant turn in the transcript.
  let model = 'unknown';
  const transcript = payload.transcript_path;
  if (transcript && existsSync(transcript)) {
    try {
      const lines = readFileSync(transcript, 'utf8').split(/\r?\n/).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        let obj;
        try {
          obj = JSON.parse(lines[i]);
        } catch {
          continue;
        }
        const m = obj?.message?.model || obj?.model;
        if (m) {
          model = m;
          break;
        }
      }
    } catch {
      /* transcript unreadable — leave model as unknown */
    }
  }

  const logDir = join(projectDir, '.agentic', 'logs');
  const logFile = join(logDir, 'model-usage.log');
  try {
    mkdirSync(logDir, { recursive: true });
    const ts = new Date().toISOString();
    appendFileSync(
      logFile,
      `${ts} ${event} source=actual model=${model} agent=${agent} session=${session}\n`,
    );
  } catch {
    /* logging must never block the agent */
  }
}

try {
  main();
} catch {
  /* swallow everything */
}
process.exit(0);
