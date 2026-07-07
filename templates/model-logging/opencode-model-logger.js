/**
 * agentic-sdlc — OpenCode model-usage logger plugin.
 *
 * Logs the ACTUAL provider/model selected at runtime for every assistant turn
 * (i.e. each agent invocation), at both the start and end of the turn, to
 * `.agentic/logs/model-usage.log`. OpenCode assistant messages carry the real
 * `providerID`/`modelID` (ground truth from the runtime, not a self-report), so
 * this is the actually-executed model — not merely the model configured on the
 * agent file.
 *
 * Auto-loaded by OpenCode from `.opencode/plugins/`. Zero dependencies; every
 * path is wrapped so a logging failure can never disrupt a session.
 */
export const AgenticModelLogger = async ({ directory }) => {
  const { appendFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');

  const logDir = join(directory || process.cwd(), '.agentic', 'logs');
  const logFile = join(logDir, 'model-usage.log');

  const started = new Set();
  const ended = new Set();

  const write = (phase, info) => {
    try {
      mkdirSync(logDir, { recursive: true });
      const ts = new Date().toISOString();
      const provider = info.providerID ?? 'unknown';
      const model = info.modelID ?? 'unknown';
      const agent = info.mode ?? info.agent ?? '(default)';
      const line =
        `${ts} ${phase} source=actual provider=${provider} model=${model} ` +
        `agent=${agent} session=${info.sessionID ?? '-'} msg=${info.id ?? '-'}\n`;
      appendFileSync(logFile, line);
    } catch {
      /* logging must never break a session */
    }
  };

  return {
    event: async ({ event }) => {
      try {
        if (event?.type !== 'message.updated') return;
        const info = event.properties?.info;
        if (!info || info.role !== 'assistant') return;
        // Model is resolved as soon as the assistant message exists.
        if (info.id && !started.has(info.id)) {
          started.add(info.id);
          write('START', info);
        }
        // `time.completed` is set once the turn finishes.
        if (info.id && info.time?.completed && !ended.has(info.id)) {
          ended.add(info.id);
          write('END  ', info);
        }
      } catch {
        /* never throw from a plugin event handler */
      }
    },
  };
};
