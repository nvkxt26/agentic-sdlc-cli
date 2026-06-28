import pc from 'picocolors';
import { AGENTS, SKILLS, INSTRUCTIONS, PROMPTS } from '../registry.js';
import { MODEL_TIERS, TIER_LABEL } from '../models.js';
import { readConfig } from '../config.js';
import { effectiveTier } from '../installer.js';
import { defaultConfig } from '../config.js';

/** Print the catalog of agents and skills with their resolved models. */
export async function listCommand(): Promise<void> {
  const config = (await readConfig(process.cwd())) ?? defaultConfig();

  console.log(pc.bold('\nSDLC Agents (workflow order)'));
  for (const a of [...AGENTS].sort((x, y) => x.order - y.order)) {
    const tier = effectiveTier(a.id, a.tier, config);
    const model = MODEL_TIERS[tier].primary;
    const overridden = config.modelOverrides[a.id] ? pc.yellow(' (override)') : '';
    console.log(
      `  ${pc.cyan(String(a.order))}. ${pc.bold(a.id.padEnd(18))} ${pc.dim(
        TIER_LABEL[tier].padEnd(15),
      )} ${pc.green(model)}${overridden}`,
    );
    console.log(`     ${pc.dim(a.description)}`);
  }

  console.log(pc.bold('\nSkills'));
  for (const s of SKILLS) {
    const tier = effectiveTier(s.id, s.tier, config);
    const model = MODEL_TIERS[tier].primary;
    const mode = s.standalone ? 'standalone+workflow' : 'workflow';
    const env = s.requiresEnv.length ? ` env:[${s.requiresEnv.join(',')}]` : '';
    console.log(
      `  ${pc.bold(s.id.padEnd(14))} ${pc.dim(TIER_LABEL[tier].padEnd(15))} ${pc.green(
        model,
      )} ${pc.dim('· ' + mode)}`,
    );
    console.log(`     ${pc.dim(s.description + env)}`);
  }

  console.log(pc.bold('\nInstructions'));
  for (const i of INSTRUCTIONS) console.log(`  ${pc.bold(i.id.padEnd(20))} ${pc.dim(i.description)}`);

  console.log(pc.bold('\nPrompts'));
  for (const p of PROMPTS) console.log(`  ${pc.bold(p.id.padEnd(20))} ${pc.dim(p.description)}`);

  console.log('');
}
