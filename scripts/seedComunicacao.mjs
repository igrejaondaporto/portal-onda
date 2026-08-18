/**
 * Cria bases/comunicacao e os seus ministérios — sem pessoas nem
 * equipamentos: isso o líder adiciona pelo próprio painel (Adicionar
 * voluntário / Painel do líder → Equipamentos → Novo), nunca por
 * script (são dados reais de pessoas e bens, não configuração).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedComunicacao.mjs
 *
 * Repetir não duplica (usa merge nos ministérios pelo slug, e no
 * documento da base).
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

// horaChegada fica null de propósito — o líder define no Painel
// (Definições da base), como as outras bases já permitem.
const BASE = {
  nome: "Comunicação", slug: "comunicacao", cor: "#001ED1",
  horaChegada: null, horaCulto: "10:30",
  local: "Casa do Povo de Vermoim, Maia", ativa: true,
  ministeriosAtivos: true,
  slaDiasMinimos: 10,
};

// Do organograma partilhado pelo líder — cores só para distinguir
// visualmente, sem significado. Ordem "0" fica reservada nas outras
// bases para o ministério-Responsável; a Comunicação não tem esse
// papel rotativo (ver apps/comunicacao/CLAUDE.md), por isso a ordem
// aqui é só a ordem de exibição.
const MINISTERIOS = [
  { id: "captacao-edicao", nome: "Captação e Edição", cor: "#0092D4", ordem: 1 },
  { id: "unvt",            nome: "UNVT",               cor: "#7B5CFF", ordem: 2 },
  { id: "social-media",    nome: "Social Media",        cor: "#FF2E88", ordem: 3 },
  { id: "storymaker",      nome: "Storymaker",          cor: "#F5A300", ordem: 4 },
  { id: "redacao-design",  nome: "Redação e Design",    cor: "#00A88F", ordem: 5 },
  { id: "fotografia",      nome: "Fotografia",          cor: "#0019BE", ordem: 6 },
];

async function main() {
  await db.doc("bases/comunicacao").set(BASE, { merge: true });

  const lote = db.batch();
  for (const m of MINISTERIOS) {
    lote.set(db.doc(`bases/comunicacao/ministerios/${m.id}`), {
      nome: m.nome, cor: m.cor, ordem: m.ordem, ativo: true,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await lote.commit();

  console.log("bases/comunicacao criada/atualizada, com 6 ministérios.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
