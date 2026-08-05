import type { Model } from './types';

// Model ids persisted in conversation settings (and submitted by stale
// clients) outlive the picker catalog. Map retired ids to their successors
// so old conversations keep resolving to a routable, correctly priced model.
export const LEGACY_MODEL_IDS: Record<string, Model> = {
  'openai/gpt-5.5': 'openai/gpt-4o',
  'openai/gpt-5.6-sol': 'openai/gpt-4o',
  'anthropic/claude-fable-5': 'openai/gpt-4o',
  'anthropic/claude-opus-4.8': 'openai/gpt-4o',
  'anthropic/claude-sonnet-5': 'openai/gpt-4o',
  'anthropic/claude-sonnet-4.5': 'openai/gpt-4o',
  'google/gemini-3.1-pro-preview': 'openai/gpt-4o',
  'google/gemini-3.6-flash': 'openai/gpt-4o',
  'x-ai/grok-4.5': 'openai/gpt-4o',
  'moonshotai/kimi-k3': 'openai/gpt-4o',
  'z-ai/glm-5.2': 'openai/gpt-4o',
};

export function normalizeModelId(model: Model): Model {
  return LEGACY_MODEL_IDS[model] ?? model;
}

/** Strip `openai/` (or any provider) prefix for the OpenAI API model name. */
export function openAIApiModelId(modelId: string): string {
  const bare = modelId.includes('/')
    ? modelId.slice(modelId.lastIndexOf('/') + 1)
    : modelId;
  return bare;
}
