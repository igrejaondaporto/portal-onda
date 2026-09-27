/**
 * Cria a base "Onda Tech Hub" (painel de triagem dos relatos de bug/
 * erro/melhoria, ver functions/relatos.js) e liga os 5 membros — todos
 * já voluntários na Técnica — sem duplicar o perfil deles (regra 9 do
 * CLAUDE.md raiz: "pessoa a servir em duas bases nunca nasce por seed
 * solto", mas aqui não há líder da ondatechhub ainda para usar o
 * caminho normal do Painel — "já é voluntário(a) noutra base?" —, por
 * isso o primeiro elo é sempre um script, como qualquer base nova).
 *
 * Corre uma vez. Repetir não duplica (usa merge/set determinístico) —
 * serve também para religar alguém se o campo `bases.ondatechhub`
 * alguma vez se perder.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/criarBaseOndaTechHub.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

// o Julio fica líder (para poder adicionar gente nova pelo Painel do
// líder, caminho normal, a partir de agora) — os outros quatro são
// pares: qualquer um dos 5 gere qualquer relato (ver exigeOndaTechHub
// em functions/relatos.js, que não olha para papel).
const MEMBROS = [
  { nome: "Julio", papel: "lider_base" },
  { nome: "Vitor", papel: "voluntario" },
  { nome: "Kairan", papel: "voluntario" },
  { nome: "Diogo", papel: "voluntario" },
  { nome: "Hans", papel: "voluntario" },
];

async function encontrarNaTecnica(nome) {
  const snap = await db.collection("bases/tecnica/pessoas").where("nome", "==", nome).get();
  const ativos = snap.docs.filter((d) => d.data().ativo !== false);
  if (ativos.length === 0) return { erro: `ninguém chamado "${nome}" ativo na Técnica` };
  if (ativos.length > 1) return { erro: `${ativos.length} pessoas chamadas "${nome}" na Técnica — resolve à mão` };
  return { id: ativos[0].id, dados: ativos[0].data() };
}

async function main() {
  console.log("A criar a base Onda Tech Hub…\n");

  await db.doc("bases/ondatechhub").set({
    nome: "Onda Tech Hub", cor: "#001ED1",
  }, { merge: true });
  console.log("bases/ondatechhub criado/confirmado\n");

  for (const { nome, papel } of MEMBROS) {
    const achado = await encontrarNaTecnica(nome);
    if (achado.erro) {
      console.log(`✗ ${nome}: ${achado.erro} — não ligado, corrige à mão`);
      continue;
    }
    const { id, dados } = achado;
    await db.doc(`bases/ondatechhub/pessoas/${id}`).set({
      nome: dados.nome, telefone: dados.telefone || "", papel, ativo: true,
      foto: dados.foto ?? null, genero: dados.genero ?? null,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.doc(`pessoas/${id}`).set({ bases: { ondatechhub: true } }, { merge: true });
    console.log(`✓ ${nome} (${id}) ligado ao Onda Tech Hub como ${papel}`);
  }

  console.log("\nPronto. O PIN de cada um continua o mesmo de sempre (é global, regra 2) — entram na app nova com ele.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
