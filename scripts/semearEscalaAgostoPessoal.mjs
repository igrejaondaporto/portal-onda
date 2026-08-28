/**
 * Semeia a escala de agosto/2026 da Base Pessoal, a partir da folha
 * que o dono do produto já usava fora da app: 2 funções novas (Hall,
 * Sala dos Voluntários), 15 voluntários novos (só Pessoal) + 3
 * pessoas ligadas de outra base (Robson/Miqueias da Apoio, Hans da
 * Técnica — nunca criadas de novo, só ganham `bases.pessoal:true`,
 * mesma lógica seguida por criarVoluntario no fluxo "já existe"), os
 * 2 cultos que ainda não existiam (23 e 30/08), e a escala + as
 * atribuições de função de cada domingo. "Responsável pela equipa"
 * (a pessoa com *) vira `escala.liderEscala`, igual ao molde da Apoio.
 *
 * Idempotente: todas as escritas são merge:true ou set() sobre o
 * mesmo id — correr duas vezes não duplica nada. Passa cada pessoa
 * nova por garantirIdSemColisao antes de criar (CLAUDE.md raiz, #9).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/semearEscalaAgostoPessoal.mjs
 */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import admin from "firebase-admin";
import { garantirIdSemColisao } from "./lib/semearPessoaSegura.mjs";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();
const BASE = "pessoal";

const hash = (pin) => {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
};

// ── funções novas (as 4 da base já existem: cafe, drive, acomodacao,
// recepcao — recepcao faltava mesmo em produção, corrigido aqui de
// caminho) ──────────────────────────────────────────────────────
const FUNCOES_NOVAS = [
  ["recepcao", "Recepção", "Recebe à entrada e preenche o formulário", "durante", "porta"],
  ["hall", "Hall", "Recebe e organiza o hall de entrada.", "durante", "pessoas"],
  ["sala-voluntarios", "Sala dos Voluntários",
    "Prepara um ambiente confortável para a equipa de voluntários, com comes e bebes, antes do culto.",
    "durante", "coracao"],
];

// ── voluntários novos, só da Pessoal (PIN provisório 1234) ──────
const VOLUNTARIOS_NOVOS = [
  { id: "donta", nome: "Donta" }, { id: "paulo", nome: "Paulo" },
  { id: "luis", nome: "Luís" }, { id: "giovani", nome: "Giovani" },
  { id: "gessica", nome: "Géssica" }, { id: "caroline", nome: "Caroline" },
  { id: "erika", nome: "Érika" }, { id: "rose", nome: "Rose" },
  { id: "thiago", nome: "Thiago" }, { id: "italo", nome: "Ítalo" },
  { id: "lunalva", nome: "Lunalva" }, { id: "dani", nome: "Dani" },
  { id: "ravenna", nome: "Ravenna" }, { id: "jessica", nome: "Jéssica" },
  { id: "camila-m", nome: "Camila M." },
];

// ── pessoas que já existem noutra base — só ligar, nunca criar ──
const LIGACOES = [
  { id: "robson", deBase: "apoio" },
  { id: "miqueias", deBase: "apoio" },
  { id: "hans", deBase: "tecnica" },
];

// ── a escala em si, lida da folha (líder = camila-pessoal, já existe) ──
const LIDER = "camila-pessoal";
const ESCALA = {
  "2026-08-02": { hall: "donta", recepcao: "gessica", acomodacao: [LIDER], salaVoluntarios: "dani", cafe: "erika", responsavel: LIDER },
  "2026-08-09": { hall: "robson", recepcao: "hans", acomodacao: ["rose"], salaVoluntarios: "miqueias", cafe: "ravenna", responsavel: "ravenna" },
  "2026-08-16": { hall: "paulo", recepcao: "giovani", acomodacao: ["thiago"], salaVoluntarios: "hans", cafe: "jessica", responsavel: "hans" },
  "2026-08-23": { hall: "luis", recepcao: "caroline", acomodacao: ["italo", "lunalva"], salaVoluntarios: "robson", cafe: "camila-m", responsavel: "luis" },
  "2026-08-30": { hall: "giovani", recepcao: "erika", acomodacao: ["lunalva"], salaVoluntarios: "donta", cafe: "gessica", responsavel: "gessica" },
};

async function main() {
  console.log("1) Funções…");
  for (const [id, nome, descricao, fase, icone] of FUNCOES_NOVAS) {
    await db.doc(`bases/${BASE}/funcoes/${id}`).set(
      { nome, descricao, fase, icone, eventoId: null, ativa: true, ordem: 0 }, { merge: true });
    console.log(`  ${id}: ${nome}`);
  }

  console.log("\n2) Voluntários novos…");
  for (const v of VOLUNTARIOS_NOVOS) {
    await garantirIdSemColisao(db, v.id, BASE);
    await db.doc(`bases/${BASE}/pessoas/${v.id}`).set(
      { nome: v.nome, papel: "voluntario", ativo: true, foto: null, telefone: "" }, { merge: true });
    await db.doc(`pessoas/${v.id}`).set(
      { nome: v.nome, foto: null, bases: { [BASE]: true } }, { merge: true });
    const auth = await db.doc(`pessoas/${v.id}/privado/auth`).get();
    if (!auth.exists) {
      await db.doc(`pessoas/${v.id}/privado/auth`).set(
        { pinHash: hash("1234"), provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null });
    }
    console.log(`  ${v.id}: ${v.nome}`);
  }

  console.log("\n3) Ligar pessoas de outras bases (sem criar identidade nova)…");
  for (const l of LIGACOES) {
    const global = await db.doc(`pessoas/${l.id}`).get();
    if (!global.exists) { console.log(`  ⚠️  pessoas/${l.id} não existe — salto.`); continue; }
    const dados = global.data();
    await db.doc(`bases/${BASE}/pessoas/${l.id}`).set(
      { nome: dados.nome, papel: "voluntario", ativo: true, foto: dados.foto ?? null, telefone: "" }, { merge: true });
    await db.doc(`pessoas/${l.id}`).set({ bases: { [BASE]: true } }, { merge: true });
    console.log(`  ${l.id} (${dados.nome}, de ${l.deBase}) ligado à Pessoal`);
  }

  console.log("\n4) Eventos em falta…");
  for (const id of ["2026-08-23", "2026-08-30"]) {
    await db.doc(`eventos/${id}`).set(
      { data: id, tipo: null, horaCulto: "10:30", criadoEm: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true });
    console.log(`  ${id} garantido`);
  }

  console.log("\n5) Escala + atribuições por culto…");
  for (const [eventoId, dia] of Object.entries(ESCALA)) {
    const pessoas = [...new Set([dia.hall, dia.recepcao, ...dia.acomodacao, dia.salaVoluntarios, dia.cafe])];

    // aviso, não trava — quem serve noutra base (Robson/Miqueias/Hans)
    // pode já estar escalado lá nesse mesmo domingo; este script
    // escreve direto (sem passar pela Cloud Function), por isso não
    // marca "indisponível" sozinho do lado da outra base.
    for (const l of LIGACOES) {
      if (!pessoas.includes(l.id)) continue;
      const outraEscala = await db.doc(`eventos/${eventoId}/escalas/${l.deBase}`).get();
      if (outraEscala.exists && (outraEscala.data().pessoas || []).includes(l.id)) {
        console.log(`  ⚠️  ${l.id} já está escalado em ${l.deBase} neste mesmo culto (${eventoId}) — confirma se é mesmo intencional.`);
      }
    }

    await db.doc(`eventos/${eventoId}/escalas/${BASE}`).set(
      { baseId: BASE, liderEscala: dia.responsavel, pessoas }, { merge: true });

    const atribuicoes = [
      ["hall", "Hall", [dia.hall]],
      ["recepcao", "Recepção", [dia.recepcao]],
      ["acomodacao", "Acomodação", dia.acomodacao],
      ["sala-voluntarios", "Sala dos Voluntários", [dia.salaVoluntarios]],
      ["cafe", "Café", [dia.cafe]],
      ["drive", "Mapa", [dia.cafe]], // quem faz Café também opera o Mapa/Contagem nesse culto
    ];
    for (const [funcaoId, nomeFuncao, pessoasFuncao] of atribuicoes) {
      await db.doc(`eventos/${eventoId}/atribuicoes/${funcaoId}`).set({
        baseId: BASE, funcaoId, pessoas: pessoasFuncao, nomeFuncao,
        atualizadoPor: LIDER, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    console.log(`  ${eventoId}: ${pessoas.length} pessoas, responsável ${dia.responsavel}`);
  }

  console.log("\nPronto.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
