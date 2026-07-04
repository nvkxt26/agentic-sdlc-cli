import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { findSkill } from '../registry.js';
import { readConfig, defaultConfig } from '../config.js';
import { getProvider, PROVIDER_IDS } from '../providers.js';

/**
 * Execute a deterministic skill's script. Arguments after `--` are forwarded to
 * the script; the script emits TOON on stdout. The script is resolved from
 * whichever configured provider's skills dir contains it.
 */
export async function runCommand(skillId: string, passthrough: string[]): Promise<void> {
  const cwd = process.cwd();
  const skill = findSkill(skillId);

  if (!skill) {
    console.error(pc.red(`Unknown skill "${skillId}". Run \`list\` to see options.`));
    process.exitCode = 1;
    return;
  }
  if (skill.scripts.length === 0) {
    console.error(
      pc.red(`Skill "${skillId}" has no deterministic script; invoke it via the agent instead.`),
    );
    process.exitCode = 1;
    return;
  }

  const config = (await readConfig(cwd)) ?? defaultConfig();
  const scriptRel = skill.scripts[0];

  // Search every provider's skills dir (installed one wins) so `run` works
  // regardless of which provider(s) were scaffolded.
  const providerIds = config.providers?.length ? config.providers : PROVIDER_IDS;
  const candidates = providerIds.map((pid) =>
    join(cwd, getProvider(pid).skillsDir, skill.id, scriptRel),
  );
  const scriptPath = candidates.find((p) => existsSync(p));

  if (!scriptPath) {
    console.error(
      pc.red(
        `Script not found for "${skillId}". Looked in:\n  ${candidates.join('\n  ')}\n` +
          `Run \`init\` or \`add ${skillId}\` first.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  await new Promise<void>((resolve) => {
    const child = spawn('node', [scriptPath, ...passthrough], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      process.exitCode = code ?? 0;
      resolve();
    });
  });
}
