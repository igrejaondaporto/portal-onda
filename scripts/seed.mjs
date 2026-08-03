/**
 * Semeia a base de dados: base, voluntários, funções, domingos do ano
 * e a escala de agosto que já existia na folha do Google.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. npm run seed
 *
 * Corre uma vez. Repetir não duplica (usa merge), mas repõe os PINs.
 */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "apoio";
const ANO = 2026;
// fixo de propósito — mais fácil de comunicar à equipa, e o
// `provisorio:true` obriga a trocar logo no primeiro acesso.
const PIN_PADRAO = { lider_base: "123456", voluntario: "1234" };
const hash = (pin) => {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
};

const PESSOAS = [
  { id: "alan", nome: "Alan", papel: "lider_base" },
  { id: "pessanha", nome: "L. Pessanha" }, { id: "diego", nome: "Diego" },
  { id: "clara", nome: "Clara" },          { id: "robson", nome: "Robson" },
  { id: "heitor", nome: "Heitor" },        { id: "joao", nome: "João" },
  { id: "duarte", nome: "Duarte" },        { id: "mariana", nome: "Mariana" },
  { id: "breno", nome: "Breno" },          { id: "miqueias", nome: "Miqueias" },
  { id: "lucas", nome: "Lucas" },          { id: "camila", nome: "Camila" },
  { id: "elton", nome: "Elton" },          { id: "selinger", nome: "Selinger" },
  { id: "cezar", nome: "Cezar" },          { id: "vitor", nome: "Vitor" },
];

// O Alan substitui isto pelo texto real no Painel. Entra só para não nascer vazio.
const FUNCOES = [
  ["entrada", "Entrada e corredores", "pre", "porta"],
  ["wc-senhoras", "WC Senhoras", "pre", "gota"],
  ["wc-homens", "WC Homens", "pre", "gota"],
  ["auditorio-chao", "Auditório — chão", "pre", "mopa"],
  ["auditorio-cadeiras", "Auditório — cadeiras", "pre", "cadeiras"],
  ["amamentacao", "Sala de amamentação", "pre", "coracao"],
  ["copa", "Cozinha e copa", "pre", "chavena"],
  ["aroma", "Aromatização geral", "pre", "spray"],
  ["ronda-wc", "Ronda aos WC", "durante", "ronda"],
  ["apoio-entrada", "Apoio à entrada", "durante", "pessoas"],
  ["consumiveis", "Reposição de consumíveis", "durante", "caixa"],
  ["lixo", "Recolha de lixo final", "pos", "lixo"],
  ["arrumacao", "Arrumação final da sala", "pos", "arrumar"],
];

// da folha do Google: [voluntários..., líder de escala]
const ESCALA_AGOSTO = {
  "2026-08-02": { pessoas: ["pessanha", "diego", "alan", "clara", "robson"], lider: "alan" },
  "2026-08-09": { pessoas: ["heitor", "joao", "duarte", "mariana"], lider: "duarte" },
  "2026-08-16": { pessoas: ["breno", "robson", "miqueias", "alan"], lider: "miqueias" },
  "2026-08-23": { pessoas: ["lucas", "camila", "elton", "diego"], lider: "elton" },
  "2026-08-30": { pessoas: ["clara", "selinger", "cezar", "vitor"], lider: "cezar" },
};

const INVENTARIO = [
  ["Detergente multiusos", "Limpeza", 4, "un", 2], ["Lixívia", "Limpeza", 1, "L", 2],
  ["Desengordurante", "Limpeza", 3, "un", 1], ["Limpa-vidros", "Limpeza", 2, "un", 1],
  ["Panos de microfibra", "Limpeza", 9, "un", 4], ["Esfregões", "Limpeza", 6, "un", 3],
  ["Mopa", "Limpeza", 2, "un", 1], ["Vassoura", "Limpeza", 3, "un", 2],
  ["Papel higiénico", "WC", 5, "rolos", 12], ["Papel de mãos", "WC", 7, "pacotes", 4],
  ["Sabonete líquido", "WC", 3, "un", 2], ["Escova de sanita", "WC", 4, "un", 2],
  ["Ambientador spray", "WC", 2, "un", 2], ["Sacos do lixo 30L", "Consumíveis", 20, "un", 10],
  ["Sacos do lixo 100L", "Consumíveis", 3, "un", 10], ["Luvas descartáveis", "Consumíveis", 40, "un", 20],
  ["Toalhitas", "Consumíveis", 5, "pacotes", 3], ["Álcool gel", "Consumíveis", 2, "un", 2],
];

async function main() {
  console.log("A semear a base…\n");

  await db.doc(`bases/${BASE}`).set({
    nome: "Base de Apoio", slug: "apoio", cor: "#0019BE",
    horaChegada: "08:00", horaCulto: "10:30",
    local: "Casa do Povo de Vermoim, Maia", ativa: true,
  }, { merge: true });

  for (const p of PESSOAS) {
    const papel = p.papel || "voluntario";
    const pin = PIN_PADRAO[papel];
    await db.doc(`bases/${BASE}/pessoas/${p.id}`).set(
      { nome: p.nome, papel, ativo: true, foto: null, telefone: "" }, { merge: true });
    await db.doc(`bases/${BASE}/pessoas/${p.id}/privado/auth`).set(
      { pinHash: hash(pin), provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null });
  }
  console.log(`${PESSOAS.length} voluntários criados`);

  for (const [id, nome, fase, icone] of FUNCOES) {
    await db.doc(`bases/${BASE}/funcoes/${id}`).set(
      { nome, fase, icone, descricao: "", foto: null, eventoId: null, ativa: true, ordem: 0 },
      { merge: true });
  }
  console.log(`${FUNCOES.length} funções no catálogo`);

  for (const [nome, categoria, quantidade, unidade, minimo] of INVENTARIO) {
    const id = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-");
    await db.doc(`bases/${BASE}/inventario/${id}`).set(
      { nome, categoria, quantidade, unidade, minimo }, { merge: true });
  }
  console.log(`${INVENTARIO.length} itens no inventário`);

  let domingos = 0;
  for (let m = 0; m < 12; m++) {
    const dias = new Date(ANO, m + 1, 0).getDate();
    for (let d = 1; d <= dias; d++) {
      const data = new Date(Date.UTC(ANO, m, d));
      if (data.getUTCDay() !== 0) continue;
      const id = data.toISOString().slice(0, 10);
      await db.doc(`eventos/${id}`).set(
        { data: id, tipo: null, horaCulto: "10:30" }, { merge: true });
      domingos++;
    }
  }
  console.log(`${domingos} domingos de ${ANO} gerados`);

  for (const [evento, { pessoas, lider }] of Object.entries(ESCALA_AGOSTO)) {
    await db.doc(`eventos/${evento}/escalas/${BASE}`).set(
      { pessoas, liderEscala: lider, baseId: BASE }, { merge: true });
  }
  console.log(`escala de agosto carregada\n`);

  console.log("── CÓDIGO PROVISÓRIO ─────────────────────────");
  console.log(`  Voluntários:      ${PIN_PADRAO.voluntario}`);
  console.log(`  Líder da base:    ${PIN_PADRAO.lider_base}`);
  console.log("\nÉ o mesmo para todos. A app obriga a trocar por um código");
  console.log("próprio logo no primeiro acesso — não é preciso entregar nada.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
