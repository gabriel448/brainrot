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


-- ============================================================
--  ASSETS 3D  (tela de gerenciamento dos modelos do jogo)
-- ============================================================

create table if not exists public.assets (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  area        text,                                  -- ex: 'Área 1 - Madeira'
  category    text,                                  -- ex: 'Base/Cenário'
  priority    text        not null default 'Média',  -- Alta | Média | Baixa
  status      text        not null default 'Não iniciado', -- Não iniciado | Fazendo | Revisão | Pronto
  asset_id    text,                                  -- rbxassetid (quando pronto)
  assigned_to text,                                  -- responsável
  notes       text,                                  -- observações livres
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.assets enable row level security;

drop policy if exists "acesso total anon" on public.assets;
create policy "acesso total anon"
  on public.assets
  for all
  to anon
  using (true)
  with check (true);

alter publication supabase_realtime add table public.assets;