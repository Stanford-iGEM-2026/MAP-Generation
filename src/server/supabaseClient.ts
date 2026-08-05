import { createLocalClient, type LocalClient } from './localDb/client';

export type SupabaseClient = LocalClient;

export function getAnonSupabaseClient(_options?: {
  global?: { headers?: Record<string, string> };
}) {
  return createLocalClient(_options);
}

export function getServiceRoleSupabaseClient(_options?: {
  global?: { headers?: Record<string, string> };
}) {
  return createLocalClient(_options);
}
