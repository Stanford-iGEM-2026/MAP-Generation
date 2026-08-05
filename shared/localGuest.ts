/** Fixed guest identity — no signup / login. */
export const GUEST_USER_ID = '00000000-0000-4000-8000-000000000001';
export const GUEST_EMAIL = 'guest@localhost';
export const GUEST_NAME = 'Guest';

export type GuestUser = {
  id: string;
  email: string;
  user_metadata: { full_name: string };
  app_metadata: Record<string, unknown>;
  identities: never[];
  aud: string;
  created_at: string;
  updated_at?: string;
  role?: string;
  is_anonymous?: boolean;
};

export type GuestSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'bearer';
  user: GuestUser;
};

export const GUEST_USER: GuestUser = {
  id: GUEST_USER_ID,
  email: GUEST_EMAIL,
  user_metadata: { full_name: GUEST_NAME },
  app_metadata: {},
  identities: [],
  aud: 'authenticated',
  created_at: '2020-01-01T00:00:00.000Z',
  role: 'authenticated',
};

export const GUEST_TOKEN = 'local-guest-token';

export const GUEST_SESSION: GuestSession = {
  access_token: GUEST_TOKEN,
  refresh_token: GUEST_TOKEN,
  expires_in: 60 * 60 * 24 * 365,
  token_type: 'bearer',
  user: GUEST_USER,
};

export type TableName =
  | 'conversations'
  | 'messages'
  | 'meshes'
  | 'images'
  | 'previews'
  | 'profiles'
  | 'prompts';
