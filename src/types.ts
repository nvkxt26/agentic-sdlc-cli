/**
 * Shared types for the agentic-workflow CLI.
 */

/** Logical reasoning tiers. Each maps to a concrete default model + fallbacks. */
export type ModelTier =
  | 'reasoning-max'
  | 'reasoning-high'
  | 'coding'
  | 'balanced'
  | 'light';

/** A persona-based agent (orchestrator or SDLC role). */
export interface AgentDefinition {
  /** kebab-case id, also the installed file stem. */
  id: string;
  /** Human readable name. */
  name: string;
  /** Short description shown in `list`. */
  description: string;
  /** Default reasoning tier for this agent. */
  tier: ModelTier;
  /** Source template file, relative to templates/. */
  template: string;
  /** Installed file name under .github/agents/. */
  outFile: string;
  /** Order in the SDLC workflow (orchestrator = 0). */
  order: number;
}

/** A specialized, single-task skill. May ship deterministic scripts. */
export interface SkillDefinition {
  /** kebab-case id, also the installed folder name. */
  id: string;
  /** Human readable name. */
  name: string;
  /** Short description shown in `list`. */
  description: string;
  /** Default reasoning tier for this skill. */
  tier: ModelTier;
  /** Source template folder, relative to templates/skills/. */
  templateDir: string;
  /** Deterministic helper scripts shipped with the skill (relative to its folder). */
  scripts: string[];
  /** Environment variables this skill needs to run. */
  requiresEnv: string[];
  /** Whether the skill can run standalone (default true). */
  standalone: boolean;
}

/** A reusable instruction file applied to the workspace. */
export interface InstructionDefinition {
  id: string;
  description: string;
  template: string;
  outFile: string;
}

/** A prompt file (entry-point workflow trigger). */
export interface PromptDefinition {
  id: string;
  description: string;
  template: string;
  outFile: string;
}

/** Persisted CLI configuration written at install time. */
export interface AgenticConfig {
  /** Schema version. */
  version: string;
  /** Where per-ticket docs folders are created (default `docs`). */
  docsDir: string;
  /** Default code-review loop iterations. */
  reviewLoops: number;
  /** Default output mode: 'comments' (default) or 'code'. */
  defaultOutputMode: 'comments' | 'code';
  /** Names of env vars the install expects to be set. */
  envVars: string[];
  /** Per-agent / per-skill model tier overrides. */
  modelOverrides: Record<string, ModelTier>;
}
