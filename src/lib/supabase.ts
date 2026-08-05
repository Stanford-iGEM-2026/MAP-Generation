import type { TableName } from '@shared/localGuest';
import {
  GUEST_SESSION,
  GUEST_USER,
  type GuestSession,
  type GuestUser,
} from '@shared/localGuest';

export const isSupabaseConfigMissing = false;
export const ssoProvider = null;
export const accountUrl = '';
export const ssoManaged = false;

export function ssoClaims(_user: GuestUser | null) {
  return undefined;
}

type Filter =
  | { type: 'eq'; column: string; value: unknown }
  | { type: 'in'; column: string; values: unknown[] };

type Order = { column: string; ascending: boolean };

// Local DB rows are loosely shaped; keep parity with the old supabase client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryResult = { data: any; error: { message: string } | null };

function apiBase() {
  return import.meta.env.BASE_URL.replace(/\/$/, '');
}

class BrowserQueryBuilder implements PromiseLike<QueryResult> {
  private table: TableName;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitCount: number | null = null;
  private referencedLimit = false;
  private selectClause: string | null = null;
  private wantSingle = false;
  private wantMaybeSingle = false;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' =
    'select';
  private payload: unknown = null;
  private onConflict: string | null = null;

  constructor(table: TableName) {
    this.table = table;
  }

  select(columns = '*') {
    this.selectClause = columns;
    if (
      this.action !== 'insert' &&
      this.action !== 'update' &&
      this.action !== 'upsert'
    ) {
      this.action = 'select';
    }
    return this;
  }

  insert(values: unknown) {
    this.action = 'insert';
    this.payload = values;
    return this;
  }

  update(values: unknown) {
    this.action = 'update';
    this.payload = values;
    return this;
  }

  upsert(
    values: unknown,
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

  limit(count: number, opts?: { referencedTable?: string }) {
    if (opts?.referencedTable) this.referencedLimit = true;
    else this.limitCount = count;
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
    return this as unknown as BrowserQueryBuilder & PromiseLike<QueryResult>;
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
    const response = await fetch(`${apiBase()}/api/local-db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: this.table,
        action: this.action,
        filters: this.filters,
        orders: this.orders,
        limitCount: this.limitCount,
        referencedLimit: this.referencedLimit,
        selectClause: this.selectClause,
        wantSingle: this.wantSingle,
        wantMaybeSingle: this.wantMaybeSingle,
        payload: this.payload,
        onConflict: this.onConflict,
      }),
    });
    return (await response.json()) as QueryResult;
  }
}

class BrowserStorageBucket {
  constructor(private bucket: string) {}

  async upload(
    objectPath: string,
    body: Blob | File | ArrayBuffer | Uint8Array | string,
    options?: { contentType?: string; upsert?: boolean },
  ) {
    const form = new FormData();
    form.set('bucket', this.bucket);
    form.set('path', objectPath);
    form.set('upsert', String(options?.upsert ?? true));
    let file: Blob;
    if (typeof body === 'string') {
      file = new Blob([body], { type: options?.contentType });
    } else if (body instanceof ArrayBuffer) {
      file = new Blob([body], { type: options?.contentType });
    } else if (ArrayBuffer.isView(body)) {
      file = new Blob([body], { type: options?.contentType });
    } else {
      file = body;
    }
    form.set('file', file);
    const response = await fetch(`${apiBase()}/api/local-storage/_op`, {
      method: 'POST',
      body: form,
    });
    return (await response.json()) as QueryResult;
  }

  async download(objectPath: string) {
    const url = `${apiBase()}/api/local-storage/${this.bucket}/${objectPath
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    const response = await fetch(url);
    if (!response.ok) {
      return { data: null, error: { message: 'Object not found' } };
    }
    return { data: await response.blob(), error: null };
  }

  async exists(objectPath: string) {
    const result = await this.download(objectPath);
    return { data: result.data != null && !result.error, error: null };
  }

  async remove(paths: string[]) {
    const response = await fetch(`${apiBase()}/api/local-storage/_op`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'remove', bucket: this.bucket, paths }),
    });
    return response.json();
  }

  async list(
    folder = '',
    _opts?: { search?: string; limit?: number; offset?: number },
  ) {
    const response = await fetch(`${apiBase()}/api/local-storage/_op`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'list', bucket: this.bucket, folder }),
    });
    const result = await response.json();
    let data = result.data ?? [];
    if (_opts?.search) {
      data = data.filter((f: { name: string }) =>
        f.name.includes(_opts.search!),
      );
    }
    if (_opts?.limit != null) {
      data = data.slice(_opts.offset ?? 0, (_opts.offset ?? 0) + _opts.limit);
    }
    return { ...result, data };
  }

  async createSignedUrl(objectPath: string, _expiresIn: number) {
    return {
      data: {
        signedUrl: `${apiBase()}/api/local-storage/${this.bucket}/${objectPath
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
      },
      error: null,
    };
  }

  async createSignedUrls(paths: string[], _expiresIn: number) {
    return {
      data: paths.map((p) => ({
        signedUrl: `${apiBase()}/api/local-storage/${this.bucket}/${p
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
        path: p,
        error: null,
      })),
      error: null,
    };
  }
}

class Channel {
  on() {
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

export const supabase = {
  from(table: TableName) {
    return new BrowserQueryBuilder(table);
  },
  storage: {
    from(bucket: string) {
      return new BrowserStorageBucket(bucket);
    },
  },
  auth: {
    async getSession() {
      return { data: { session: GUEST_SESSION }, error: null };
    },
    async getUser() {
      return { data: { user: GUEST_USER }, error: null };
    },
    async refreshSession() {
      return { data: { session: GUEST_SESSION }, error: null };
    },
    onAuthStateChange(
      cb: (event: string, session: GuestSession | null) => void,
    ) {
      queueMicrotask(() => cb('INITIAL_SESSION', GUEST_SESSION));
      return {
        data: { subscription: { unsubscribe() {} } },
      };
    },
    async signOut() {
      return { error: null };
    },
    async signInWithPassword() {
      return {
        data: { session: GUEST_SESSION, user: GUEST_USER },
        error: null,
      };
    },
    async signUp() {
      return {
        data: { session: GUEST_SESSION, user: GUEST_USER },
        error: null,
      };
    },
    async signInWithOtp() {
      return { data: {}, error: null };
    },
    async verifyOtp() {
      return {
        data: { session: GUEST_SESSION, user: GUEST_USER },
        error: null,
      };
    },
    async resetPasswordForEmail() {
      return { data: {}, error: null };
    },
    async updateUser() {
      return { data: { user: GUEST_USER }, error: null };
    },
    async signInWithOAuth() {
      return { data: { url: '/', provider: 'local' }, error: null };
    },
  },
  channel(_name: string) {
    return new Channel();
  },
  removeChannel(_channel: Channel) {},
};

export type User = GuestUser;
export type Session = GuestSession;
export type Provider = string;
