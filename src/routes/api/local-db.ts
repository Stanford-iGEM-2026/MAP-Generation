import { createFileRoute } from '@tanstack/react-router';
import { createLocalClient } from '@/server/localDb/client';
import type { TableName } from '@shared/localGuest';
import { corsHeaders, json, methodNotAllowed, preflight } from '@/server/api';

type QueryPlan = {
  table: TableName;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  filters: Array<
    | { type: 'eq'; column: string; value: unknown }
    | { type: 'in'; column: string; values: unknown[] }
  >;
  orders: Array<{ column: string; ascending: boolean }>;
  limitCount: number | null;
  referencedLimit: boolean;
  selectClause: string | null;
  wantSingle: boolean;
  wantMaybeSingle: boolean;
  payload: unknown;
  onConflict: string | null;
};

function runPlan(plan: QueryPlan) {
  const client = createLocalClient();
  let q = client.from(plan.table);

  if (plan.action === 'insert') q = q.insert(plan.payload as never);
  else if (plan.action === 'update') q = q.update(plan.payload as never);
  else if (plan.action === 'delete') q = q.delete();
  else if (plan.action === 'upsert') {
    q = q.upsert(plan.payload as never, {
      onConflict: plan.onConflict ?? undefined,
    });
  }

  if (plan.selectClause != null) q = q.select(plan.selectClause);

  for (const f of plan.filters) {
    if (f.type === 'eq') q = q.eq(f.column, f.value);
    else if (f.type === 'in') q = q.in(f.column, f.values);
  }
  for (const o of plan.orders) {
    q = q.order(o.column, { ascending: o.ascending });
  }
  if (plan.limitCount != null) q = q.limit(plan.limitCount);
  if (plan.referencedLimit)
    q = q.limit(1, { referencedTable: 'first_message' });
  if (plan.wantSingle) q = q.single();
  if (plan.wantMaybeSingle) q = q.maybeSingle();

  return q;
}

export const Route = createFileRoute('/api/local-db')({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request }) => {
        try {
          const plan = (await request.json()) as QueryPlan;
          const result = await runPlan(plan);
          return json(result);
        } catch (error) {
          return json(
            {
              data: null,
              error: {
                message:
                  error instanceof Error ? error.message : 'Local DB error',
              },
            },
            500,
          );
        }
      },
      GET: () => methodNotAllowed(),
    },
  },
});

// silence unused import if tree-shaken oddly
void corsHeaders;
