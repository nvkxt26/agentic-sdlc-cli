/**
 * Shared types for the agentic-sdlc CLI.
 */

/** Logical reasoning tiers. Each maps to a concrete default model + fallbacks. */
export type ModelTier =
  | 'reasoning-max'
  | 'reasoning-high'
  | 'coding'
  | 'balanced'
  | 'light';

/**
 * Supported AI coding agents. Each provider maps the same logical components
 * (agents/skills/instructions/prompts) to its own directory layout, frontmatter
 * format, and model naming. See {@link ./providers.ts}.
 */
export type ProviderId = 'copilot' | 'claude';

/**
 * Provider-neutral capability an agent needs. Each provider translates these to
 * its own tool names (e.g. `read` → Copilot `codebase`, Claude `Read`).
 */
export type Capability =
  | 'read'
  | 'edit'
  | 'run'
  | 'search'
  | 'usages'
  | 'fetch'
  | 'tests'
  | 'changes'
  | 'todos'
  | 'subagents';

/** A persona-based agent (orchestrator or SDLC role). */
export interface AgentDefinition {
  /** kebab-case id, also the installed file stem. */
  id: string;
  /** Human readable name. */
  name: string;
  /** Short description shown in `list` and rendered into provider frontmatter. */
  description: string;
  /** Default reasoning tier for this agent. */
  tier: ModelTier;
  /** Provider-neutral capabilities; each provider maps these to real tool names. */
  capabilities: Capability[];
  /** Source template file (body only, no frontmatter), relative to templates/. */
  template: string;
  /** Installed file stem (extension is provider-specific). */
  outFile: string;
  /** Order in the SDLC workflow (orchestrator = 0). */
  order: number;
  /**
   * A top-level agent the user drives directly (orchestrator, mimir,
   * epic-planner). Persona roles are sub-agents delegated to by the
   * orchestrator.
   */
  primary?: boolean;
  /**
   * ids of the other agents this one is allowed to delegate to as in-process
   * subagents (i.e. via the host's Task/agent tool, same repo). Used to build
   * Copilot's `agents:` frontmatter allowlist, which restricts which custom
   * agents can be invoked as a subagent and is required for the `model:`
   * pin on the target agent to actually take effect. Omit for agents that
   * never delegate locally (e.g. epic-planner only reaches peer repos via the
   * repo-bridge skill, not a local subagent call).
   */
  subagents?: string[];
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
  /** Source template file (body only), relative to templates/. */
  template: string;
  /** Installed file stem. */
  outFile: string;
  /** Install only at the workspace root (cross-repo rules), not per repo. */
  workspaceOnly?: boolean;
}

/** A prompt file (entry-point workflow trigger). */
export interface PromptDefinition {
  id: string;
  description: string;
  /** Default reasoning tier used to resolve the prompt's model. */
  tier: ModelTier;
  /** Capabilities the prompt needs, mapped to per-provider tool names. */
  capabilities: Capability[];
  /** Source template file (body only), relative to templates/. */
  template: string;
  /** Installed file stem (extension is provider-specific). */
  outFile: string;
  /** Install only at the workspace root (cross-repo entry points), not per repo. */
  workspaceOnly?: boolean;
}

/** Persisted CLI configuration written at install time. */
export interface AgenticConfig {
  /** Schema version. */
  version: string;
  /** Target AI provider(s) to scaffold customizations for (default `['copilot']`). */
  providers: ProviderId[];
  /** Where per-ticket docs folders are created (default `docs`). */
  docsDir: string;
  /** Where generated codebase context lives (default `.agentic/context`). Git-ignored. */
  contextDir?: string;
  /** Where the token-saving cache store lives (default `.agentic/cache`). Git-ignored. */
  cacheDir?: string;
  /**
   * Shared cross-repo context registry, relative to the workspace root
   * (default `.agentic/registry`). Repos publish their context here so peer
   * repos' agents can consult it. Git-ignored.
   */
  registryDir?: string;
  /** Default code-review loop iterations. */
  reviewLoops: number;
  /** Names of env vars the install expects to be set. */
  envVars: string[];
  /** Per-agent / per-skill model tier overrides. */
  modelOverrides: Record<string, ModelTier>;
  /**
   * Whether `init` should git-ignore generated Copilot workspace customizations
   * under `.github/agentic-sdlc/` plus `.vscode/settings.json`. Default `true`;
   * disable with `init --no-gitignore-sdlc`.
   */
  gitignoreSdlc?: boolean;
  /**
   * Whether `init` installs the per-provider model-usage logger (records which
   * model each agent runs on to `.agentic/logs/model-usage.log`). Claude Code
   * logs the actual resolved model; Copilot logs the intended (configured)
   * model. Default `true`; disable with `init --no-model-logging`.
   */
  modelLogging?: boolean;
}

/**
 * Workspace configuration (`.agentic-workspace.json`) written at the root of a
 * folder that contains several repos. Enables workspace-level agents (e.g. the
 * epic planner) and a shared cross-repo context registry.
 */
export interface WorkspaceConfig {
  /** Schema version. */
  version: string;
  /** Target AI provider(s) for workspace-level customizations. */
  providers: ProviderId[];
  /** Shared context registry dir, relative to the workspace root. Git-ignored. */
  registryDir: string;
  /** Where per-epic docs folders are created at the workspace root (default `docs`). */
  docsDir: string;
  /** Member repos discovered / configured under this workspace. */
  repos: WorkspaceRepo[];
}

/** A member repository of a workspace. */
export interface WorkspaceRepo {
  /** Display name (usually the directory name). */
  name: string;
  /** Path relative to the workspace root (or absolute). */
  path: string;
}
