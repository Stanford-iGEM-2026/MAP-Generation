import { env } from './env';

/** Rewrite absolute storage URLs for local tunnels when needed. */
export function reformatSignedUrl(signedUrl: string): string {
  // Local file store already returns app-relative paths like
  // `/api/local-storage/...` — leave those alone.
  if (signedUrl.startsWith('/')) return signedUrl;

  const publicHost = (
    env('ENVIRONMENT') === 'local'
      ? env('NGROK_URL') || env('WEBHOOK_BASE_URL')
      : env('WEBHOOK_BASE_URL') || env('ADAM_URL')
  ).trim();

  if (!publicHost) return signedUrl;

  try {
    const url = new URL(signedUrl);
    return `${publicHost.replace(/\/$/, '')}${url.pathname}${url.search}`;
  } catch {
    return signedUrl;
  }
}
