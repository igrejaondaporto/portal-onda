/**
 * Corrige a colisão de identidade entre a "Camila" da Base Pessoal
 * (líder, criada por scripts/seedPessoal.mjs) e a "Camila" real que já
 * servia na Base de Apoio — as duas usaram o mesmo id ("camila"), e
 * como a identidade/PIN são globais (pessoas/{id}/privado/auth), o
 * seed da Pessoal e o próprio primeiro login (troca de PIN) ACABARAM
 * POR REESCREVER o PIN e o "bases" da Camila real da Apoio.
 *
 * O que este script faz:
 *   1. Move a líder da Pessoal para um id novo, sem colisão: "camila-pessoal".
 *   2. Apaga o registo antigo colidente em bases/pessoal/pessoas/camila.
 *   3. Repõe a Camila real da Apoio: tira "pessoal" do bases{} dela e
 *      dá-lhe um PIN novo (a antiga já não é recuperável — foi
 *      sobrescrita, o hash não guarda o valor original).
 *
 * Depois de correr, é preciso avisar a Camila da Apoio do novo PIN.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/corrigirColisaoCamila.mjs
 */
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const hash = (pin) => {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
};

const NOVO_ID_LIDER_PESSOAL = "camila-pessoal";
const PIN_LIDER_PESSOAL = "647539"; // o mesmo que ela já escolheu — só muda de "casa"
const PIN_NOVO_APOIO = "5190"; // provisório para a Camila real da Apoio, 4 dígitos (voluntária)

async function main() {
  console.log("A corrigir a colisão de identidade da Camila…\n");

  const baseRef = db.doc(`bases/pessoal/pessoas/camila`);
  const baseSnap = await baseRef.get();
  if (!baseSnap.exists) {
    console.log("bases/pessoal/pessoas/camila já não existe — talvez já tenha sido corrigido antes.");
  } else {
    const dados = baseSnap.data();

    // 1. Recriar a líder da Pessoal com id novo, sem colisão.
    await db.doc(`bases/pessoal/pessoas/${NOVO_ID_LIDER_PESSOAL}`).set(dados);
    await db.doc(`pessoas/${NOVO_ID_LIDER_PESSOAL}`).set(
      { nome: dados.nome, foto: dados.foto ?? null, bases: { pessoal: true } });
    await db.doc(`pessoas/${NOVO_ID_LIDER_PESSOAL}/privado/auth`).set({
      pinHash: hash(PIN_LIDER_PESSOAL), provisorio: true,
      falhas: 0, jaBloqueou: false, bloqueadoAte: null,
    });
    console.log(`líder da Pessoal recriada em bases/pessoal/pessoas/${NOVO_ID_LIDER_PESSOAL}`);

    // 2. Apagar o registo antigo (base-scoped) e o segredo órfão que o
    // seed original (com o bug do caminho) tinha deixado para trás.
    await baseRef.delete();
    await db.doc(`bases/pessoal/pessoas/camila/privado/auth`).delete().catch(() => {});
    console.log("registo antigo bases/pessoal/pessoas/camila apagado");
  }

  // 3. Repor a Camila real da Apoio: tirar "pessoal" da lista de bases
  // dela e dar-lhe um PIN novo (o antigo foi sobrescrito, é
  // irrecuperável — o hash nunca guarda o valor em claro).
  const globalRef = db.doc(`pessoas/camila`);
  const globalSnap = await globalRef.get();
  if (globalSnap.exists) {
    await globalRef.update({ "bases.pessoal": admin.firestore.FieldValue.delete() });
    await db.doc(`pessoas/camila/privado/auth`).set({
      pinHash: hash(PIN_NOVO_APOIO), provisorio: true,
      falhas: 0, jaBloqueou: false, bloqueadoAte: null,
      pinDigitos: admin.firestore.FieldValue.delete(),
    }, { merge: true });
    console.log(`Camila da Apoio reposta — bases.pessoal removido, PIN novo: ${PIN_NOVO_APOIO}`);
  } else {
    console.log("pessoas/camila (global) não existe — nada a repor.");
  }

  console.log("\n── RESUMO ─────────────────────────────────────");
  console.log(`Líder da Pessoal agora entra como "${NOVO_ID_LIDER_PESSOAL}", PIN ${PIN_LIDER_PESSOAL} (o mesmo de antes).`);
  console.log(`A Camila da Apoio precisa do PIN novo: ${PIN_NOVO_APOIO} (avisa-a — a app pede para trocar no 1º acesso).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
