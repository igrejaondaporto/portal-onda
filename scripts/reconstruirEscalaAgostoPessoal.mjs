/**
 * Reconstrução completa (não incremental) da escala de agosto/2026 da
 * Base Pessoal, a partir do texto exato que o dono do produto confirmou
 * célula a célula — substitui por completo tudo o que os scripts
 * anteriores tinham escrito de errado (Ceia em dias a mais, Contribua
 * a mais, e a função "Sala dos Voluntários" que não existe no texto
 * real — o bloco da cozinha também é "Acomodação", só muda o
 * "Arrumar").
 *
 * Cada `atribuicoes/{funcaoId}` é escrito por inteiro (não merge de
 * `pessoas`) para garantir que fica exatamente igual ao texto, sem
 * resíduo de tentativas anteriores.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/reconstruirEscalaAgostoPessoal.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();
const BASE = "pessoal";
const LIDER = "camila-pessoal";

// ── funções novas em falta + desativar a que não existe no texto real ──
const FUNCOES_NOVAS = [
  ["arrumar-hall", "Arrumar Hall", "", "durante", "arrumar"],
  ["arrumar-recepcao", "Arrumar Recepção", "", "durante", "arrumar"],
  ["arrumar-auditorio", "Arrumar Auditório", "", "durante", "arrumar"],
  ["arrumar-cozinha", "Arrumar Cozinha", "", "durante", "arrumar"],
  ["placas", "Placas", "", "durante", "caixa"],
];

// ── a escala, célula a célula, exatamente como confirmado ──
const DADOS = {
  "2026-08-02": {
    responsavel: LIDER,
    ceia: ["donta", "gessica", LIDER, "dani", "erika"],
    "arrumar-hall": ["donta"], hall: ["donta"],
    "arrumar-recepcao": ["gessica"], recepcao: ["gessica"],
    "arrumar-auditorio": [LIDER], "arrumar-cozinha": ["dani"], acomodacao: [LIDER, "dani"],
    cafe: ["erika"], drive: ["erika"], placas: ["erika"],
    contribua: ["donta", "gessica", LIDER, "dani"],
    visitantes: ["donta", "gessica", LIDER, "dani", "erika"],
    apelo: ["donta", "gessica", LIDER, "dani", "erika"],
  },
  "2026-08-09": {
    responsavel: "ravenna",
    ceia: [],
    "arrumar-hall": ["robson"], hall: ["robson"],
    "arrumar-recepcao": ["hans"], recepcao: ["hans"],
    "arrumar-auditorio": ["rose"], "arrumar-cozinha": ["miqueias"], acomodacao: ["rose", "miqueias"],
    cafe: ["ravenna"], drive: ["ravenna"], placas: [],
    contribua: ["robson", "hans", "rose", "miqueias", "ravenna"],
    visitantes: ["robson", "hans", "rose", "miqueias", "ravenna"],
    apelo: ["robson", "hans", "rose", "miqueias", "ravenna"],
  },
  "2026-08-16": {
    responsavel: "hans",
    ceia: [],
    "arrumar-hall": ["paulo"], hall: ["paulo"],
    "arrumar-recepcao": ["giovani"], recepcao: ["giovani"],
    "arrumar-auditorio": ["thiago"], "arrumar-cozinha": ["hans"], acomodacao: ["thiago", "hans"],
    cafe: ["jessica"], drive: ["jessica"], placas: [],
    contribua: ["paulo", "giovani", "thiago", "hans", "jessica"],
    visitantes: ["paulo", "giovani", "thiago", "hans", "jessica"],
    apelo: ["paulo", "giovani", "thiago", "hans", "jessica"],
  },
  "2026-08-23": {
    responsavel: "luis",
    ceia: [],
    "arrumar-hall": ["luis"], hall: ["luis"],
    "arrumar-recepcao": ["caroline"], recepcao: ["caroline"],
    "arrumar-auditorio": ["italo", "lunalva"], "arrumar-cozinha": ["robson"], acomodacao: ["italo", "robson"],
    cafe: ["camila-m"], drive: ["camila-m"], placas: ["camila-m", "lunalva"],
    contribua: ["luis", "caroline", "italo", "robson", "lunalva"],
    visitantes: ["luis", "caroline", "italo", "camila-m", "robson", "lunalva"],
    apelo: ["luis", "caroline", "italo", "camila-m", "robson", "lunalva"],
  },
  "2026-08-30": {
    responsavel: "gessica",
    ceia: [],
    "arrumar-hall": ["giovani"], hall: ["giovani"],
    "arrumar-recepcao": ["erika"], recepcao: ["erika"],
    "arrumar-auditorio": ["lunalva"], "arrumar-cozinha": ["donta"], acomodacao: ["lunalva", "donta"],
    cafe: ["gessica"], drive: ["gessica"], placas: ["gessica"],
    contribua: ["giovani", "erika", "lunalva", "donta"],
    visitantes: ["giovani", "erika", "lunalva", "donta", "gessica"],
    apelo: ["giovani", "erika", "lunalva", "donta", "gessica"],
  },
};

const NOMES_FUNCAO = {
  ceia: "Ceia", "arrumar-hall": "Arrumar Hall", hall: "Hall",
  "arrumar-recepcao": "Arrumar Recepção", recepcao: "Recepção",
  "arrumar-auditorio": "Arrumar Auditório", "arrumar-cozinha": "Arrumar Cozinha", acomodacao: "Acomodação",
  cafe: "Café", drive: "Mapa", placas: "Placas",
  contribua: "Contribua", visitantes: "Visitantes", apelo: "Apelo",
};

async function main() {
  console.log("1) Funções novas…");
  for (const [id, nome, descricao, fase, icone] of FUNCOES_NOVAS) {
    await db.doc(`bases/${BASE}/funcoes/${id}`).set(
      { nome, descricao, fase, icone, eventoId: null, ativa: true, ordem: 0 }, { merge: true });
    console.log(`  ${id}: ${nome}`);
  }

  console.log("\n2) Desativar \"Sala dos Voluntários\" (não existe no texto real)…");
  await db.doc(`bases/${BASE}/funcoes/sala-voluntarios`).set({ ativa: false }, { merge: true });

  console.log("\n3) Reescrever escala + atribuições, dia a dia…");
  for (const [eventoId, dia] of Object.entries(DADOS)) {
    const todasAsFuncoes = Object.keys(NOMES_FUNCAO);
    const pessoas = [...new Set(todasAsFuncoes.flatMap((f) => dia[f] || []))];

    await db.doc(`eventos/${eventoId}/escalas/${BASE}`).set(
      { baseId: BASE, liderEscala: dia.responsavel, pessoas }, { merge: true });

    for (const funcaoId of todasAsFuncoes) {
      await db.doc(`eventos/${eventoId}/atribuicoes/${funcaoId}`).set({
        baseId: BASE, funcaoId, pessoas: dia[funcaoId] || [], nomeFuncao: NOMES_FUNCAO[funcaoId],
        atualizadoPor: LIDER, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }); // merge:true só para não perder outros campos do doc; pessoas é sempre substituído por inteiro
    }
    console.log(`  ${eventoId}: ${pessoas.length} pessoas, responsável ${dia.responsavel}`);
  }

  console.log("\nPronto.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
