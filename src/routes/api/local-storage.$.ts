import { createFileRoute } from '@tanstack/react-router';
import {
  storageReadFile,
  storageUpload,
  storageRemove,
  storageList,
  signedUrlFor,
} from '@/server/localDb/store';
import { corsHeaders, json, methodNotAllowed, preflight } from '@/server/api';

export const Route = createFileRoute('/api/local-storage/$')({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: ({ params }) => {
        const splat = params._splat ?? '';
        const slash = splat.indexOf('/');
        if (slash < 0) {
          return new Response('Not Found', { status: 404 });
        }
        const bucket = decodeURIComponent(splat.slice(0, slash));
        const objectPath = splat
          .slice(slash + 1)
          .split('/')
          .map((p) => decodeURIComponent(p))
          .join('/');
        const file = storageReadFile(bucket, objectPath);
        if (!file) return new Response('Not Found', { status: 404 });
        return new Response(file, {
          headers: {
            ...corsHeaders,
            'content-type': 'application/octet-stream',
            'cache-control': 'no-store',
          },
        });
      },
      POST: async ({ request, params }) => {
        const splat = params._splat ?? '';
        // ops: upload | remove | list | signed-url under /api/local-storage/_op
        if (splat === '_op') {
          const contentType = request.headers.get('content-type') ?? '';
          if (contentType.includes('multipart/form-data')) {
            const form = await request.formData();
            const bucket = String(form.get('bucket') ?? '');
            const objectPath = String(form.get('path') ?? '');
            const file = form.get('file');
            if (!bucket || !objectPath || !(file instanceof Blob)) {
              return json({ error: 'invalid_upload' }, 400);
            }
            await storageUpload(bucket, objectPath, file, {
              upsert: form.get('upsert') === 'true',
              contentType: file.type || undefined,
            });
            return json({ data: { path: objectPath }, error: null });
          }

          const body = (await request.json()) as {
            op: string;
            bucket: string;
            path?: string;
            paths?: string[];
            folder?: string;
          };

          if (body.op === 'remove') {
            return json(storageRemove(body.bucket, body.paths ?? []));
          }
          if (body.op === 'list') {
            return json(storageList(body.bucket, body.folder ?? ''));
          }
          if (body.op === 'signed-url' && body.path) {
            return json({
              data: { signedUrl: signedUrlFor(body.bucket, body.path) },
              error: null,
            });
          }
          if (body.op === 'signed-urls') {
            return json({
              data: (body.paths ?? []).map((p) => ({
                signedUrl: signedUrlFor(body.bucket, p),
                path: p,
                error: null,
              })),
              error: null,
            });
          }
          return json({ error: 'unknown_op' }, 400);
        }
        return json({ error: 'not_found' }, 404);
      },
      PUT: () => methodNotAllowed(),
    },
  },
});
