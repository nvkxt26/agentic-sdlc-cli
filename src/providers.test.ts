import { describe, expect, it } from 'vitest';
import {
  COPILOT_AGENTIC_SDLC_AGENTS_DIR,
  COPILOT_AGENTIC_SDLC_INSTRUCTIONS_DIR,
  COPILOT_AGENTIC_SDLC_PROMPTS_DIR,
  COPILOT_AGENTIC_SDLC_SKILLS_DIR,
  getProvider,
} from './providers.js';

describe('provider layout', () => {
  it('keeps Copilot always-on instructions in .github while moving customizations under agentic-sdlc', () => {
    const provider = getProvider('copilot');

    expect(provider.alwaysOnFile).toBe('.github/copilot-instructions.md');
    expect(provider.agentsDir).toBe(COPILOT_AGENTIC_SDLC_AGENTS_DIR);
    expect(provider.promptsDir).toBe(COPILOT_AGENTIC_SDLC_PROMPTS_DIR);
    expect(provider.instructionsDir).toBe(COPILOT_AGENTIC_SDLC_INSTRUCTIONS_DIR);
    expect(provider.skillsDir).toBe(COPILOT_AGENTIC_SDLC_SKILLS_DIR);
  });
});