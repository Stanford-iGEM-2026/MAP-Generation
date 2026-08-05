import { createFileRoute } from '@tanstack/react-router';
import { createOpenAIText } from '@/server/openaiText';
import {
  isRecord,
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';

const PARAMETRIC_PROMPT =
  'Generate a short prompt for a microneedle array patch design. Vary the needle shape (conical, pyramidal, frustum-tipped), backing shape (circular, oval, rectangular), density/pitch, or target application area. Include dimensions when useful. Return only the prompt text.';
const MAX_EXISTING_TEXT_LENGTH = 2000;

export const Route = createFileRoute('/api/prompt-generator')({
  server: {
    handlers: {
      GET: methodNotAllowed,
      OPTIONS: preflight,
      POST: async ({ request }) => {
        try {
          await requireUser(request);
          const body = await request.json().catch(() => ({}));
          if (!isRecord(body)) {
            return json({ error: 'invalid_request' }, 400);
          }
          if (
            body.existingText !== undefined &&
            (typeof body.existingText !== 'string' ||
              body.existingText.length > MAX_EXISTING_TEXT_LENGTH)
          ) {
            return json({ error: 'invalid_existing_text' }, 400);
          }
          const existingText = body.existingText;
          const content = existingText
            ? `${PARAMETRIC_PROMPT}\n\nImprove this existing prompt while preserving its intent:\n${existingText}`
            : PARAMETRIC_PROMPT;
          const prompt = await createOpenAIText({
            model: 'gpt-4o-mini',
            maxTokens: 200,
            system:
              'You write concise microneedle array patch design prompts. Return only the prompt text, no quotes or explanation.',
            content,
          });
          return json({ prompt });
        } catch (err) {
          return json(
            {
              error: isUnauthorizedError(err)
                ? 'Unauthorized'
                : 'prompt_failed',
            },
            isUnauthorizedError(err) ? 401 : 500,
          );
        }
      },
    },
  },
});
