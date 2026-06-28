import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { findSkill } from '../registry.js';
import { GITHUB_DIR } from '../paths.js';

/**
 * Execute a deterministic skill's script (requirement #4). Arguments after `--`
 * are forwarded to the script; the script emits TOON on stdout.
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
      pc.red(`Skill "${skillId}" has no deterministic script; invoke it via Copilot instead.`),
    );
    process.exitCode = 1;
    return;
  }

  const scriptRel = skill.scripts[0];
  const scriptPath = join(cwd, GITHUB_DIR, 'skills', skill.id, scriptRel);

  if (!existsSync(scriptPath)) {
    console.error(
      pc.red(
        `Script not found at ${scriptPath}. Run \`init\` or \`add ${skillId}\` first.`,
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
