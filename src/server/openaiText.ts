import OpenAI from 'openai';
import { requiredEnv } from './env';

type OpenAIContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | {
          type: 'image_url';
          image_url: { url: string };
        }
    >;

function getOpenAI() {
  return new OpenAI({ apiKey: requiredEnv('OPENAI_API_KEY') });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readText(data: unknown): string {
  if (!isRecord(data)) throw new Error('openai response missing body');
  const choices = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('openai response missing choices');
  }
  const message = isRecord(choices[0]) ? choices[0].message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('openai response missing text content');
  }
  return content.trim();
}

/** Lightweight text completion for titles / prompt helpers. */
export async function createOpenAIText({
  model,
  system,
  content,
  maxTokens,
}: {
  model: string;
  system: string;
  content: OpenAIContent;
  maxTokens: number;
}): Promise<string> {
  const openai = getOpenAI();
  const userContent =
    typeof content === 'string'
      ? content
      : content.map((part) =>
          part.type === 'text'
            ? { type: 'text' as const, text: part.text }
            : {
                type: 'image_url' as const,
                image_url: part.image_url,
              },
        );

  const response = await openai.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
  });

  return readText(response);
}
