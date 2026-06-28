import pc from 'picocolors';
import { findSkill, findAgent } from '../registry.js';
import { install } from '../installer.js';
import { readConfig, writeConfig, defaultConfig } from '../config.js';
import { TIER_IDS } from '../models.js';
import type { ModelTier } from '../types.js';

interface AddFlags {
  model?: string;
}

/** Install a single skill or agent into the current project, with optional model override. */
export async function addCommand(target: string, flags: AddFlags): Promise<void> {
  const cwd = process.cwd();
  const config = (await readConfig(cwd)) ?? defaultConfig();

  if (flags.model) {
    if (!TIER_IDS.includes(flags.model as ModelTier)) {
      console.error(
        pc.red(`Invalid --model "${flags.model}". Valid tiers: ${TIER_IDS.join(', ')}`),
      );
      process.exitCode = 1;
      return;
    }
    config.modelOverrides[target] = flags.model as ModelTier;
  }

  const skill = findSkill(target);
  const agent = findAgent(target);

  if (!skill && !agent) {
    console.error(pc.red(`Unknown skill or agent "${target}". Run \`list\` to see options.`));
    process.exitCode = 1;
    return;
  }

  const result = await install({
    cwd,
    config,
    coreOnly: true,
    onlySkills: skill ? [skill.id] : [],
    onlyAgents: agent ? [agent.id] : [],
  });

  if (flags.model) await writeConfig(cwd, config);

  console.log(pc.green(`✓ Added "${target}" (${result.written.length} files).`));
  for (const f of result.written) console.log(`  ${pc.dim(f)}`);
}
