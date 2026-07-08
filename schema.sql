-- ============================================================
--  Execute isto no Supabase: SQL Editor -> New query -> Run
-- ============================================================

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  member_id    text        not null,
  title        text        not null,
  done         boolean     not null default false,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

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