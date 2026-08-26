/**
 * Semeia a Base Pessoal: base, líder, funções de catálogo (incluindo
 * "Drive" com id fixo — ver apps/pessoal/CLAUDE.md, "Função Drive") e
 * a planta de configuração do auditório para o módulo Acomodação.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedPessoal.mjs
 *
 * Corre uma vez. Repetir não duplica (usa merge), mas repõe os PINs.
 * Voluntários (além da líder) não entram aqui de propósito — a Camila
 * adiciona-os pela interface (ver CLAUDE-pessoal.md do briefing).
 */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "pessoal";
// fixo de propósito — mais fácil de comunicar, e o `provisorio:true`
// obriga a trocar logo no primeiro acesso.
const PIN_PADRAO = { lider_base: "123456", voluntario: "1234" };
const hash = (pin) => {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
};

const LIDER = { id: "camila", nome: "Camila", papel: "lider_base" };

// id fixo por função — "drive" é reservado (ver CLAUDE.md desta base):
// a regra de segurança do mapa de Acomodação aponta sempre a
// eventos/{evento}/atribuicoes/drive, sem lookup. Todas de fase
// "durante" — as quatro servem ao longo do culto, sem etapa pré/pós
// distinta (ver apps/pessoal/CLAUDE.md, "Pessoas por função" nos
// débitos conscientes — quantidades por defeito ainda por definir).
const FUNCOES = [
  ["cafe", "Café", "Prepara e serve; repõe consumíveis", "durante", "chavena"],
  ["drive", "Drive", "Marca os lugares no mapa do auditório", "durante", "mapa"],
  ["acomodacao", "Acomodação", "Leva as pessoas até o lugar indicado", "durante", "cadeiras"],
  ["recepcao", "Recepção", "Recebe à entrada e preenche o formulário", "durante", "porta"],
];

// 12 fileiras (A–L), 12 lugares cada, 144 total. A = frente/palco,
// L = fundo/entrada. Reservados fixos A1–A4 (ver apps/pessoal/CLAUDE.md
// e o protótipo original do módulo Acomodação).
const FILEIRAS = "ABCDEFGHIJKL".split("").map((id) => ({ id, label: id, lugares: 12 }));
const RESERVADOS = ["A1", "A2", "A3", "A4"];

async function main() {
  console.log("A semear a Base Pessoal…\n");

  await db.doc(`bases/${BASE}`).set({
    nome: "Base Pessoal", slug: BASE, cor: "#0019BE",
    horaChegada: "09:30", horaCulto: "10:00",
    local: "Casa do Povo de Vermoim, Maia", ativa: true,
  }, { merge: true });

  await db.doc(`bases/${BASE}/pessoas/${LIDER.id}`).set(
    { nome: LIDER.nome, papel: LIDER.papel, ativo: true, foto: null, telefone: "" }, { merge: true });
  await db.doc(`bases/${BASE}/pessoas/${LIDER.id}/privado/auth`).set(
    { pinHash: hash(PIN_PADRAO.lider_base), provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null });
  console.log(`líder ${LIDER.nome} criada`);

  for (const [id, nome, descricao, fase, icone] of FUNCOES) {
    await db.doc(`bases/${BASE}/funcoes/${id}`).set(
      { nome, descricao, fase, icone, eventoId: null, ativa: true, ordem: 0 }, { merge: true });
  }
  console.log(`${FUNCOES.length} funções no catálogo (id "drive" reservado)`);

  await db.doc(`bases/${BASE}/acomodacao/planta`).set({
    fileiras: FILEIRAS,
    reservados: RESERVADOS,
    bloqueiosPermanentes: [],
    geometria: {
      raioInterno: 260, passoFileira: 42, anguloTotal: 100,
      escadaEsquerda: true, escadaDireita: true,
    },
    corInvertida: false,
    atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    atualizadoPor: LIDER.id,
  }, { merge: true });
  console.log("planta do auditório semeada (144 lugares, reservados A1–A4)\n");

  console.log("── CÓDIGO PROVISÓRIO ─────────────────────────");
  console.log(`  Líder da base:    ${PIN_PADRAO.lider_base}`);
  console.log("\nA app obriga a trocar por um código próprio logo no");
  console.log("primeiro acesso — não é preciso entregar mais nada.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
