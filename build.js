// Gera o env.js a partir das variáveis de ambiente.
// Local: lê do arquivo .env  |  Vercel: lê das Environment Variables.
// Rode com:  npm run build   (a Vercel faz isso sozinha no deploy)

const fs = require("fs");
const path = require("path");

// Carrega o .env local (se existir), sem depender de nenhum pacote.
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";

if (!url || !key) {
  console.warn("⚠️  SUPABASE_URL ou SUPABASE_ANON_KEY não definidas — env.js sairá vazio.");
}

const out =
  "// Gerado por build.js — NÃO edite e NÃO commite este arquivo.\n" +
  "window.SUPABASE_URL = " + JSON.stringify(url) + ";\n" +
  "window.SUPABASE_ANON_KEY = " + JSON.stringify(key) + ";\n";

fs.writeFileSync(path.join(__dirname, "env.js"), out);
console.log("✅ env.js gerado.");
