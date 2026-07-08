# 🎮 Quadro de Tarefas — Projeto Roblox

Site simples para gerenciar tarefas entre os 4 integrantes do projeto.
Cada integrante tem um painel com **nome + função**, uma aba de **tarefas ativas** e
outra de **concluídas**. Qualquer um pode adicionar tarefa em qualquer painel,
marcar como concluída (vai pra aba "Concluídas") ou remover pela lixeira.
Tudo sincroniza em tempo real via Supabase.

## Como colocar no ar (3 passos)

### 1. Criar o banco no Supabase
1. Crie um projeto grátis em <https://supabase.com>.
2. Vá em **SQL Editor → New query**, cole o conteúdo de [`schema.sql`](schema.sql) e clique em **Run**.
3. Vá em **Project Settings → API** e copie a **Project URL** e a chave **anon public**.

### 2. Configurar o site
1. Copie [`.env.example`](.env.example) para um arquivo chamado **`.env`** e preencha
   `SUPABASE_URL` e `SUPABASE_ANON_KEY` com os valores do passo anterior.
   - `SUPABASE_URL` é a **Project URL** (`https://xxxxx.supabase.co`), **não** a string
     de conexão do banco (aquela tem a senha e não é usada aqui).
2. Edite a lista `MEMBERS` em [`config.js`](config.js) com o **nome**, a **função** e a
   **cor** de cada integrante.

O `.env` fica no `.gitignore` (não vai pro git). O `build.js` lê o `.env` e gera o
`env.js`, que é onde o site lê as credenciais.

### 3. Publicar na Vercel
1. Suba este repositório para o GitHub (o `.env` **não** sobe — é o esperado).
2. Em <https://vercel.com>, clique **Add New → Project** e importe o repositório.
3. Em **Settings → Environment Variables**, adicione `SUPABASE_URL` e `SUPABASE_ANON_KEY`
   com os mesmos valores do `.env`.
4. Clique **Deploy**. A Vercel roda `node build.js` (definido no `vercel.json`), que gera
   o `env.js` com as variáveis. Pronto ✅

### Testar localmente
```bash
npm run build     # gera o env.js a partir do .env
npx serve         # abre um servidor estático (ou qualquer outro)
```

## Arquivos
| Arquivo | O que é |
|---|---|
| `index.html` | estrutura da página |
| `styles.css` | aparência |
| `app.js` | lógica (carregar, adicionar, concluir, remover) |
| `config.js` | os 4 integrantes (nome, função, cor) |
| `.env` | **suas credenciais do Supabase** (não vai pro git) |
| `build.js` | gera o `env.js` a partir do `.env` / variáveis da Vercel |
| `schema.sql` | tabela do banco (rode no Supabase) |
