import { randomUUID } from 'node:crypto';
import { createFileRoute } from '@tanstack/react-router';
import { imageStoragePath } from '@shared/imageRefs';
import {
  isRecord,
  isUnauthorizedError,
  json,
  methodNotAllowed,
  preflight,
  requireUser,
} from '@/server/api';
import { getAnonSupabaseClient } from '@/server/supabaseClient';
import { traceOutline } from '@/server/outlineTrace';

export const Route = createFileRoute('/api/outline-tracer')({
  server: {
    handlers: {
      GET: methodNotAllowed,
      OPTIONS: preflight,
      POST: async ({ request }) => {
        let user;
        try {
          user = await requireUser(request);
        } catch (err) {
          if (isUnauthorizedError(err)) {
            return json({ error: 'Unauthorized' }, 401);
          }
          throw err;
        }

        const body: unknown = await request.json().catch(() => null);
        if (
          !isRecord(body) ||
          typeof body.conversationId !== 'string' ||
          typeof body.imageId !== 'string'
        ) {
          return json({ error: 'invalid_request' }, 400);
        }
        const { conversationId, imageId } = body;

        const supabaseClient = getAnonSupabaseClient();

        // The `user_id` filter both scopes and authorizes the lookup — a
        // returned row necessarily belongs to this user.
        const { data: conversation, error: conversationError } =
          await supabaseClient
            .from('conversations')
            .select('id, user_id')
            .eq('id', conversationId)
            .eq('user_id', user.id)
            .single();
        if (conversationError || !conversation) {
          return json({ error: 'conversation_not_found' }, 404);
        }

        const { data: imageBlob, error: downloadError } =
          await supabaseClient.storage
            .from('images')
            .download(imageStoragePath(user.id, conversationId, imageId));
        if (downloadError || !imageBlob) {
          return json({ error: 'image_not_found' }, 404);
        }

        let traced;
        try {
          const bytes = new Uint8Array(await imageBlob.arrayBuffer());
          traced = await traceOutline(bytes);
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : 'trace_failed' },
            422,
          );
        }

        const outlineId = randomUUID();
        const filename = `${outlineId}.svg`;
        const { error: uploadError } = await supabaseClient.storage
          .from('outlines')
          .upload(`${user.id}/${conversationId}/${filename}`, traced.svg, {
            contentType: 'image/svg+xml',
          });
        if (uploadError) {
          return json({ error: 'upload_failed' }, 500);
        }

        return json({
          outlineId,
          filename,
          points: traced.points,
          width: traced.width,
          height: traced.height,
          complex: traced.complex,
          svg: traced.svg,
        });
      },
    },
  },
});
