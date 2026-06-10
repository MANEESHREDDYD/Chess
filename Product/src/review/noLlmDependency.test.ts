import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

describe('Game Review Pro dependencies', () => {
  it('does not add LLM or agent SDK dependencies', () => {
    const deps = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    };

    expect(deps).not.toHaveProperty('openai');
    expect(deps).not.toHaveProperty('@anthropic-ai/sdk');
    expect(deps).not.toHaveProperty('@google/generative-ai');
    expect(deps).not.toHaveProperty('langchain');
    expect(deps).not.toHaveProperty('llamaindex');
  });
});
