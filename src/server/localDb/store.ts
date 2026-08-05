import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { GUEST_USER_ID, GUEST_NAME, type TableName } from '@shared/localGuest';

export type { TableName };
export type Row = Record<string, unknown>;

export type LocalDatabase = Record<TableName, Row[]>;

// On Vercel, only /tmp is writable — use it so API routes don't crash.
// Note: serverless instances don't share /tmp; data is ephemeral per instance.
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'kele-local-data')
  : path.resolve(process.cwd(), '.local-data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const STORAGE_DIR = path.join(DATA_DIR, 'storage');

const EMPTY_DB: LocalDatabase = {
  conversations: [],
  messages: [],
  meshes: [],
  images: [],
  previews: [],
  profiles: [],
  prompts: [],
};

let cache: LocalDatabase | null = null;
let writeChain: Promise<void> = Promise.resolve();

function ensureDirs() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function seedProfile(db: LocalDatabase) {
  if (db.profiles.some((p) => p.user_id === GUEST_USER_ID)) return;
  const now = new Date().toISOString();
  db.profiles.push({
    id: randomUUID(),
    user_id: GUEST_USER_ID,
    full_name: GUEST_NAME,
    avatar_path: null,
    notifications_enabled: false,
    created_at: now,
    updated_at: now,
  });
}

function loadDb(): LocalDatabase {
  if (cache) return cache;
  ensureDirs();
  if (!fs.existsSync(DB_PATH)) {
    cache = structuredClone(EMPTY_DB);
    seedProfile(cache);
    fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
    return cache;
  }
  const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) as LocalDatabase;
  cache = { ...structuredClone(EMPTY_DB), ...parsed };
  for (const key of Object.keys(EMPTY_DB) as TableName[]) {
    if (!Array.isArray(cache[key])) cache[key] = [];
  }
  seedProfile(cache);
  return cache;
}

function persist() {
  const snapshot = cache;
  if (!snapshot) return;
  writeChain = writeChain.then(() => {
    ensureDirs();
    fs.writeFileSync(DB_PATH, JSON.stringify(snapshot, null, 2));
  });
  return writeChain;
}

export function getDb(): LocalDatabase {
  return loadDb();
}

export async function mutateDb<T>(fn: (db: LocalDatabase) => T): Promise<T> {
  const db = loadDb();
  const result = fn(db);
  await persist();
  return result;
}

function storagePath(bucket: string, objectPath: string) {
  const safe = objectPath.replace(/^\/+/, '').replace(/\.\./g, '');
  return path.join(STORAGE_DIR, bucket, safe);
}

export async function storageUpload(
  bucket: string,
  objectPath: string,
  body: Buffer | Uint8Array | ArrayBuffer | Blob | string,
  _options?: { contentType?: string; upsert?: boolean },
) {
  const filePath = storagePath(bucket, objectPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let buffer: Buffer;
  if (typeof body === 'string') {
    buffer = Buffer.from(body);
  } else if (body instanceof ArrayBuffer) {
    buffer = Buffer.from(body);
  } else if (ArrayBuffer.isView(body)) {
    buffer = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  } else if (typeof Blob !== 'undefined' && body instanceof Blob) {
    buffer = Buffer.from(await body.arrayBuffer());
  } else {
    buffer = Buffer.from(body as unknown as ArrayBuffer);
  }
  fs.writeFileSync(filePath, buffer);
  return { path: objectPath };
}

export function storageDownload(
  bucket: string,
  objectPath: string,
): {
  data: Blob | null;
  error: { message: string } | null;
} {
  const filePath = storagePath(bucket, objectPath);
  if (!fs.existsSync(filePath)) {
    return { data: null, error: { message: 'Object not found' } };
  }
  const buffer = fs.readFileSync(filePath);
  return {
    data: new Blob([new Uint8Array(buffer)]),
    error: null,
  };
}

export function storageReadFile(bucket: string, objectPath: string) {
  const filePath = storagePath(bucket, objectPath);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export function storageRemove(
  bucket: string,
  paths: string[],
): {
  data: string[] | null;
  error: { message: string } | null;
} {
  for (const objectPath of paths) {
    const filePath = storagePath(bucket, objectPath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  return { data: paths, error: null };
}

export function storageList(
  bucket: string,
  folder = '',
): {
  data: { name: string }[] | null;
  error: { message: string } | null;
} {
  const dir = storagePath(bucket, folder);
  if (!fs.existsSync(dir)) return { data: [], error: null };
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => ({ name: d.name }));
  return { data: names, error: null };
}

export function signedUrlFor(bucket: string, objectPath: string) {
  const encoded = objectPath
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/');
  return `/api/local-storage/${bucket}/${encoded}`;
}
