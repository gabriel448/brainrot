-- ============================================================
--  Execute isto no Supabase: SQL Editor -> New query -> Run
-- ============================================================

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  member_id    text        not null,   -- painel/integrante dono da tarefa
  title        text        not null,
  description  text,                    -- detalhes (só aparecem no modal)
  assigned_by  text,                    -- id do integrante que atribuiu
  done         boolean     not null default false,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- Caso a tabela já exista sem estas colunas, adiciona (idempotente):
alter table public.tasks add column if not exists description text;
alter table public.tasks add column if not exists assigned_by text;

-- Ativa a segurança por linha e libera o acesso para o site (chave anon).
-- Como é uma ferramenta interna de um time pequeno, liberamos tudo para o
-- papel "anon". Se quiser mais controle depois, dá pra restringir aqui.
alter table public.tasks enable row level security;

drop policy if exists "acesso total anon" on public.tasks;
create policy "acesso total anon"
  on public.tasks
  for all
  to anon
  using (true)
  with check (true);

-- Necessário para a sincronização em tempo real
alter publication supabase_realtime add table public.tasks;