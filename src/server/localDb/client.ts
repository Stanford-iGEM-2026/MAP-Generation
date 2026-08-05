import { randomUUID } from 'node:crypto';
import {
  getDb,
  mutateDb,
  type Row,
  type TableName,
  storageDownload,
  storageList,
  storageRemove,
  storageReadFile,
  storageUpload,
  signedUrlFor,
} from './store';
import {
  GUEST_SESSION,
  GUEST_USER,
  type GuestSession,
  type GuestUser,
} from '@shared/localGuest';

type Filter =
  | { type: 'eq'; column: string; value: unknown }
  | { type: 'in'; column: string; values: unknown[] };

type Order = { column: string; ascending: boolean };

// Local DB rows are loosely shaped; keep parity with the old supabase client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryResult = { data: any; error: { message: string } | null };

function applyFilters(rows: Row[], filters: Filter[]) {
  return rows.filter((row) =>
    filters.every((f) => {
      if (f.type === 'eq') return row[f.column] === f.value;
      if (f.type === 'in') return f.values.includes(row[f.column]);
      return true;
    }),
  );
}

function applyOrder(rows: Row[], orders: Order[]) {
  if (orders.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      const av = a[order.column];
      const bv = b[order.column];
      if (av === bv) continue;
      if (av == null) return order.ascending ? -1 : 1;
      if (bv == null) return order.ascending ? 1 : -1;
      if (av < bv) return order.ascending ? -1 : 1;
      if (av > bv) return order.ascending ? 1 : -1;
    }
    return 0;
  });
}

function defaultsFor(table: TableName, row: Row): Row {
  const now = new Date().toISOString();
  const withId = { id: randomUUID(), ...row };
  switch (table) {
    case 'conversations':
      return {
        privacy: 'private',
        type: 'parametric',
        settings: null,
        current_message_leaf_id: null,
        title: 'New Conversation',
        created_at: now,
        updated_at: now,
        ...withId,
      };
    case 'messages':
      return {
        content: null,
        metadata: {},
        parts: [],
        rating: 0,
        parent_message_id: null,
        created_at: now,
        ...withId,
      };
    case 'meshes':
      return {
        file_type: 'glb',
        images: null,
        prompt: {},
        status: 'pending',
        created_at: now,
        ...withId,
      };
    case 'images':
      return {
        image_generation_call_id: null,
        prompt: {},
        status: 'pending',
        created_at: now,
        ...withId,
      };
    case 'previews':
      return {
        status: 'pending',
        created_at: now,
        updated_at: now,
        ...withId,
      };
    case 'profiles':
      return {
        avatar_path: null,
        notifications_enabled: false,
        full_name: 'Guest',
        created_at: now,
        updated_at: now,
        ...withId,
      };
    case 'prompts':
      return {
        type: 'chat',
        created_at: now,
        ...withId,
      };
    default:
      return withId;
  }
}

/** Emulate the old Postgres trigger that advances the conversation leaf. */
function advanceLeaf(db: ReturnType<typeof getDb>, message: Row) {
  const conversationId = message.conversation_id;
  if (typeof conversationId !== 'string' || typeof message.id !== 'string') {
    return;
  }
  const conv = db.conversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.current_message_leaf_id = message.id;
    conv.updated_at = new Date().toISOString();
  }
}

function projectRow(row: Row, select: string | null): Row {
  if (!select || select === '*') return { ...row };
  // Nested history select: `*, first_message:messages(parts), messagesCount:messages(count)`
  if (select.includes('first_message:messages')) {
    const db = getDb();
    const messages = db.messages
      .filter((m) => m.conversation_id === row.id)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    return {
      ...row,
      first_message: messages.slice(0, 1).map((m) => ({ parts: m.parts })),
      messagesCount: [{ count: messages.length }],
    };
  }
  const cols = select.split(',').map((c) => c.trim());
  const out: Row = {};
  for (const col of cols) {
    if (col === '*') Object.assign(out, row);
    else out[col] = row[col];
  }
  return out;
}

export class QueryBuilder implements PromiseLike<QueryResult> {
  private table: TableName;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitCount: number | null = null;
  private selectClause: string | null = null;
  private wantSingle = false;
  private wantMaybeSingle = false;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' =
    'select';
  private payload: Row | Row[] | null = null;
  private onConflict: string | null = null;

  constructor(table: TableName) {
    this.table = table;
  }

  select(columns = '*') {
    this.selectClause = columns;
    if (
      this.action === 'insert' ||
      this.action === 'update' ||
      this.action === 'upsert'
    ) {
      // keep mutating action; select after write returns rows
    } else {
      this.action = 'select';
    }
    return this;
  }

  insert(values: Row | Row[]) {
    this.action = 'insert';
    this.payload = values;
    return this;
  }

  update(values: Row) {
    this.action = 'update';
    this.payload = values;
    return this;
  }

  upsert(
    values: Row | Row[],
    opts?: { onConflict?: string; ignoreDuplicates?: boolean },
  ) {
    this.action = 'upsert';
    this.payload = values;
    this.onConflict = opts?.onConflict ?? 'id';
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ type: 'in', column, values });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(count: number, _opts?: { referencedTable?: string }) {
    // referencedTable limit is handled in projectRow for nested selects
    if (!_opts?.referencedTable) this.limitCount = count;
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantMaybeSingle = true;
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overrideTypes<_T = any>() {
    return this as unknown as QueryBuilder & PromiseLike<QueryResult>;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult> {
    try {
      if (this.action === 'select') {
        const db = getDb();
        let rows = applyOrder(
          applyFilters(db[this.table], this.filters),
          this.orders,
        );
        if (this.limitCount != null) rows = rows.slice(0, this.limitCount);
        const projected = rows.map((r) => projectRow(r, this.selectClause));
        return this.finalize(projected);
      }

      if (this.action === 'insert') {
        const values = Array.isArray(this.payload)
          ? this.payload
          : [this.payload!];
        const inserted = await mutateDb((db) => {
          const rows = values.map((v) => {
            const row = defaultsFor(this.table, v);
            db[this.table].push(row);
            if (this.table === 'messages') advanceLeaf(db, row);
            return projectRow(row, this.selectClause ?? '*');
          });
          return rows;
        });
        return this.finalize(inserted);
      }

      if (this.action === 'update') {
        const updated = await mutateDb((db) => {
          const matches = applyFilters(db[this.table], this.filters);
          for (const row of matches) {
            Object.assign(row, this.payload);
            if (this.table === 'conversations') {
              row.updated_at = new Date().toISOString();
            }
          }
          return matches.map((r) => projectRow(r, this.selectClause ?? '*'));
        });
        return this.finalize(updated);
      }

      if (this.action === 'upsert') {
        const values = Array.isArray(this.payload)
          ? this.payload
          : [this.payload!];
        const conflictKey = this.onConflict ?? 'id';
        const upserted = await mutateDb((db) => {
          const out: Row[] = [];
          for (const value of values) {
            const existing = db[this.table].find(
              (r) => r[conflictKey] === value[conflictKey],
            );
            if (existing) {
              Object.assign(existing, value);
              out.push(projectRow(existing, this.selectClause ?? '*'));
            } else {
              const row = defaultsFor(this.table, value);
              db[this.table].push(row);
              out.push(projectRow(row, this.selectClause ?? '*'));
            }
          }
          return out;
        });
        return this.finalize(upserted);
      }

      if (this.action === 'delete') {
        await mutateDb((db) => {
          const before = db[this.table];
          const remaining = before.filter(
            (row) => !applyFilters([row], this.filters).length,
          );
          // Cascade conversation deletes
          if (this.table === 'conversations') {
            const deletedIds = new Set(
              before
                .filter((row) => applyFilters([row], this.filters).length)
                .map((r) => r.id),
            );
            for (const related of [
              'messages',
              'meshes',
              'images',
              'previews',
            ] as TableName[]) {
              db[related] = db[related].filter(
                (r) => !deletedIds.has(r.conversation_id),
              );
            }
          }
          db[this.table] = remaining;
        });
        return { data: null, error: null };
      }

      return { data: null, error: { message: 'Unknown action' } };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Local DB error',
        },
      };
    }
  }

  private finalize(rows: Row[]): QueryResult {
    if (this.wantSingle) {
      if (rows.length === 0) {
        return {
          data: null,
          error: {
            message: 'JSON object requested, multiple (or no) rows returned',
          },
        };
      }
      return { data: rows[0], error: null };
    }
    if (this.wantMaybeSingle) {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }
}

class StorageBucket {
  constructor(private bucket: string) {}

  async upload(
    objectPath: string,
    body: Buffer | Uint8Array | ArrayBuffer | Blob | string,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<{
    data: { path: string } | null;
    error: { message: string } | null;
  }> {
    try {
      const data = await storageUpload(this.bucket, objectPath, body, options);
      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Upload failed',
        },
      };
    }
  }

  async download(objectPath: string): Promise<{
    data: Blob | null;
    error: { message: string } | null;
  }> {
    return storageDownload(this.bucket, objectPath);
  }

  async exists(objectPath: string): Promise<{
    data: boolean;
    error: { message: string } | null;
  }> {
    const file = storageReadFile(this.bucket, objectPath);
    return { data: file != null, error: null };
  }

  async remove(paths: string[]): Promise<{
    data: string[] | null;
    error: { message: string } | null;
  }> {
    return storageRemove(this.bucket, paths);
  }

  async list(
    folder = '',
    _opts?: { search?: string; limit?: number; offset?: number },
  ): Promise<{
    data: { name: string }[] | null;
    error: { message: string } | null;
  }> {
    const result = storageList(this.bucket, folder);
    let data = result.data ?? [];
    if (_opts?.search) {
      data = data.filter((f) => f.name.includes(_opts.search!));
    }
    if (_opts?.limit != null) {
      data = data.slice(_opts.offset ?? 0, (_opts.offset ?? 0) + _opts.limit);
    }
    return { data, error: result.error };
  }

  async createSignedUrl(
    objectPath: string,
    _expiresIn: number,
  ): Promise<{
    data: { signedUrl: string };
    error: { message: string } | null;
  }> {
    return {
      data: { signedUrl: signedUrlFor(this.bucket, objectPath) },
      error: null,
    };
  }

  async createSignedUrls(
    paths: string[],
    _expiresIn: number,
  ): Promise<{
    data: {
      signedUrl: string;
      path: string;
      error: null;
    }[];
    error: { message: string } | null;
  }> {
    return {
      data: paths.map((path) => ({
        signedUrl: signedUrlFor(this.bucket, path),
        path,
        error: null,
      })),
      error: null,
    };
  }
}

class Channel {
  constructor(private _name: string) {}
  on(_type: string, _filter: unknown, _cb?: unknown) {
    return this;
  }
  subscribe(cb?: (status: string) => void) {
    cb?.('SUBSCRIBED');
    return this;
  }
  async send(_payload?: unknown) {
    return 'ok';
  }
}

export function createLocalClient(_options?: {
  global?: { headers?: Record<string, string> };
}) {
  const channels = new Map<string, Channel>();

  return {
    from(table: TableName) {
      return new QueryBuilder(table);
    },
    storage: {
      from(bucket: string) {
        return new StorageBucket(bucket);
      },
    },
    auth: {
      async getSession(): Promise<{
        data: { session: GuestSession | null };
        error: { message: string } | null;
      }> {
        return { data: { session: GUEST_SESSION }, error: null };
      },
      async getUser(_token?: string): Promise<{
        data: { user: GuestUser | null };
        error: { message: string } | null;
      }> {
        return { data: { user: GUEST_USER }, error: null };
      },
      async refreshSession(): Promise<{
        data: { session: GuestSession | null };
        error: { message: string } | null;
      }> {
        return { data: { session: GUEST_SESSION }, error: null };
      },
      onAuthStateChange(
        cb: (event: string, session: GuestSession | null) => void,
      ) {
        cb('INITIAL_SESSION', GUEST_SESSION);
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        };
      },
      async signInWithPassword() {
        return {
          data: { session: GUEST_SESSION, user: GUEST_USER },
          error: null as { message: string } | null,
        };
      },
      async signUp() {
        return {
          data: { session: GUEST_SESSION, user: GUEST_USER },
          error: null as { message: string } | null,
        };
      },
      async signOut() {
        return { error: null as { message: string } | null };
      },
      async signInWithOtp() {
        return { data: {}, error: null as { message: string } | null };
      },
      async verifyOtp() {
        return {
          data: { session: GUEST_SESSION, user: GUEST_USER },
          error: null as { message: string } | null,
        };
      },
      async resetPasswordForEmail() {
        return { data: {}, error: null as { message: string } | null };
      },
      async updateUser() {
        return {
          data: { user: GUEST_USER },
          error: null as { message: string } | null,
        };
      },
      async signInWithOAuth() {
        return {
          data: { url: '/', provider: 'local' },
          error: null as { message: string } | null,
        };
      },
      async resend() {
        return { data: {}, error: null as { message: string } | null };
      },
      admin: {
        async deleteUser() {
          return { data: null, error: null as { message: string } | null };
        },
        async listUsers() {
          return {
            data: { users: [GUEST_USER] },
            error: null as { message: string } | null,
          };
        },
      },
    },
    channel(name: string) {
      let ch = channels.get(name);
      if (!ch) {
        ch = new Channel(name);
        channels.set(name, ch);
      }
      return ch;
    },
    removeChannel(channel: Channel) {
      for (const [name, ch] of channels) {
        if (ch === channel) channels.delete(name);
      }
    },
  };
}

export type LocalClient = ReturnType<typeof createLocalClient>;
