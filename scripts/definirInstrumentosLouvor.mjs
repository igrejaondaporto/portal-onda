/**
 * Preenche `instrumentos` (papéis que a pessoa toca — vocal/teclado/
 * guitarra/baixo/bateria) nos 19 voluntários reais da base Louvor,
 * criados em 2026-09-02 via Painel do líder → Adicionar (ver memória
 * de sessão `project_louvor_voluntarios_reais.md`). Mesmo write que
 * `editarVoluntario` faz (`set({instrumentos}, {merge:true})`) — só
 * mais rápido para aplicar aos 19 de uma vez do que passar pelo
 * formulário pessoa a pessoa.
 *
 * A lista veio de capturas de ecrã de outra app ("Onda Sounds
 * Porto") que o utilizador colou no chat — "Worship Leader"/"Back"/
 * "Co-Lead" mapeiam para vocal (são papéis de canto nessa app);
 * "Violão" mapeia para guitarra (não há violão separado aqui);
 * "Mesa de som" (Kairan) não tem papel correspondente nos 5 fixos
 * desta base, por isso fica de fora — sinalizado ao utilizador.
 * Cheila e Julio Cursino não tinham função nenhuma nas capturas,
 * ficam sem instrumentos (caem no bloco "Sem instrumento definido"
 * da escala).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/definirInstrumentosLouvor.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const MAPA = {
  "Adriel": ["guitarra", "bateria", "vocal"],
  "Amanda Gabriele de Souza Venâncio": ["vocal"],
  "Anderson Marins": ["bateria"],
  "Clayton Guedes": ["baixo", "bateria"],
  "Cristiane Torquato": ["vocal"],
  "Daniel Echebarrena": ["baixo"],
  "Danillo de Souza Faria": ["baixo"],
  "Edgard Medeiros": ["teclado"],
  "Evertan Sora": ["guitarra", "vocal"],
  "Felipe Johnatan Juvino de Santana": ["baixo"],
  "Gabriel Medeiros Nunes de Oliveira": ["baixo", "teclado"],
  "Jonas Hertz": ["guitarra"],
  "Kairan Moraes": ["guitarra"], // tocava também Mesa de som — sem papel correspondente aqui
  "Keylla Soares": ["vocal"],
  "Mariana Turbuk": ["vocal"],
  "Samuel Torquato": ["bateria"],
  "Tai Trindade": ["guitarra", "vocal"],
};

async function main() {
  console.log("A preencher instrumentos dos voluntários da Louvor…\n");
  const snap = await db.collection("bases/louvor/pessoas").where("ativo", "==", true).get();
  const porNome = new Map(snap.docs.map((d) => [d.data().nome, d.ref]));

  for (const [nome, instrumentos] of Object.entries(MAPA)) {
    const ref = porNome.get(nome);
    if (!ref) { console.log(`⚠️  não encontrado: ${nome}`); continue; }
    await ref.set({ instrumentos }, { merge: true });
    console.log(`✓ ${nome} → ${instrumentos.join(", ")}`);
  }

  const semDados = [...porNome.keys()].filter((n) => !(n in MAPA));
  if (semDados.length) {
    console.log(`\nSem instrumentos definidos (sem função nas capturas de ecrã): ${semDados.join(", ")}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
