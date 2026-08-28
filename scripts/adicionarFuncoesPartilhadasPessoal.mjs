/**
 * Acrescenta as funções partilhadas por toda a gente que serve no
 * culto (aparecem em todas as colunas da folha, não só numa pessoa):
 * Ceia, Contribua, Visitantes, Apelo. Cria o catálogo e atribui cada
 * uma a TODOS os que já estão em escala.pessoas de cada um dos 5
 * domingos de agosto/2026 — não muda quem está em Hall/Recepção/
 * Acomodação/Sala dos Voluntários/Café/Mapa, só acrescenta estas 4
 * por cima.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/adicionarFuncoesPartilhadasPessoal.mjs
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();
const BASE = "pessoal";
const LIDER = "camila-pessoal";

const FUNCOES = [
  ["ceia", "Ceia", "Apoio na preparação e distribuição da Ceia, quando houver.", "durante", "chavena"],
  ["contribua", "Contribua", "Acompanha o momento da oferta/generosidade do culto.", "durante", "caixa"],
  ["visitantes", "Visitantes", "Auxilia nos momentos de integração dos visitantes, entregando os flyers amarelos.", "durante", "pessoas"],
  ["apelo", "Apelo", "Apoia entregando os flyers roxos e ora por quem responde ao chamado.", "durante", "coracao"],
];

const EVENTOS = ["2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23", "2026-08-30"];

async function main() {
  console.log("1) Funções partilhadas…");
  for (const [id, nome, descricao, fase, icone] of FUNCOES) {
    await db.doc(`bases/${BASE}/funcoes/${id}`).set(
      { nome, descricao, fase, icone, eventoId: null, ativa: true, ordem: 0 }, { merge: true });
    console.log(`  ${id}: ${nome}`);
  }

  console.log("\n2) Atribuir a toda a gente escalada, culto a culto…");
  for (const eventoId of EVENTOS) {
    const escala = await db.doc(`eventos/${eventoId}/escalas/${BASE}`).get();
    if (!escala.exists) { console.log(`  ⚠️  ${eventoId}: sem escala, salto.`); continue; }
    const pessoas = escala.data().pessoas || [];
    for (const [id, nome] of FUNCOES) {
      await db.doc(`eventos/${eventoId}/atribuicoes/${id}`).set({
        baseId: BASE, funcaoId: id, pessoas, nomeFuncao: nome,
        atualizadoPor: LIDER, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    console.log(`  ${eventoId}: ${pessoas.length} pessoas em Ceia/Contribua/Visitantes/Apelo`);
  }

  console.log("\nPronto.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
