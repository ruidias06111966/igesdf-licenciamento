create table public.validacao_execucoes (
  id uuid primary key default gen_random_uuid(),
  executado_em timestamptz not null default now(),
  executado_por text,
  total_problemas integer not null default 0,
  total_itens integer not null default 0,
  resumo jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

grant all on public.validacao_execucoes to service_role;

alter table public.validacao_execucoes enable row level security;

create index validacao_execucoes_data_idx on public.validacao_execucoes (executado_em desc);