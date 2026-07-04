import pc from 'picocolors';
import { AGENTS, SKILLS, INSTRUCTIONS, PROMPTS } from '../registry.js';
import { TIER_LABEL } from '../models.js';
import { readConfig, defaultConfig } from '../config.js';
import { effectiveTier } from '../installer.js';
import { getProvider } from '../providers.js';

/** Print the catalog of agents and skills with their resolved models per provider. */
export async function listCommand(): Promise<void> {
  const config = (await readConfig(process.cwd())) ?? defaultConfig();
  const providerIds = config.providers?.length ? config.providers : ['copilot' as const];
  const providers = providerIds.map(getProvider);

  console.log(pc.bold('\nProviders: ') + providers.map((p) => pc.green(p.label)).join(', '));

  const modelsFor = (id: string, fallback: Parameters<typeof effectiveTier>[1]): string => {
    const tier = effectiveTier(id, fallback, config);
    return providers.map((p) => p.models[tier].primary).join(pc.dim(' | '));
  };

  console.log(pc.bold('\nSDLC Agents (workflow order)'));
  for (const a of [...AGENTS].sort((x, y) => x.order - y.order)) {
    const tier = effectiveTier(a.id, a.tier, config);
    const overridden = config.modelOverrides[a.id] ? pc.yellow(' (override)') : '';
    console.log(
      `  ${pc.cyan(String(a.order))}. ${pc.bold(a.id.padEnd(18))} ${pc.dim(
        TIER_LABEL[tier].padEnd(15),
      )} ${pc.green(modelsFor(a.id, a.tier))}${overridden}`,
    );
    console.log(`     ${pc.dim(a.description)}`);
  }

  console.log(pc.bold('\nSkills'));
  for (const s of SKILLS) {
    const tier = effectiveTier(s.id, s.tier, config);
    const mode = s.standalone ? 'standalone+workflow' : 'workflow';
    const env = s.requiresEnv.length ? ` env:[${s.requiresEnv.join(',')}]` : '';
    console.log(
      `  ${pc.bold(s.id.padEnd(14))} ${pc.dim(TIER_LABEL[tier].padEnd(15))} ${pc.green(
        modelsFor(s.id, s.tier),
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
