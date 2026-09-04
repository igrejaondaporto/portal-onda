/**
 * Migração única: converte o campo `historico` (forma antiga,
 * [{tom, datas}]) para `usoPorCulto` (forma nova, {eventoId: tom} —
 * ver CLAUDE.md desta base e functions/index.js,
 * registarUsoVersaoLouvor) nos documentos que o backfill anterior
 * (scripts/backfillIndiceCantoresLouvor.mjs) já tinha escrito.
 *
 * Sem perda de dados: todo `historico` gravado até agora tinha
 * `datas: []` (o backfill nunca inventou culto nenhum), por isso a
 * conversão é sempre para `usoPorCulto: {}` — não há nenhum eventoId
 * real para preservar. Se algum dia isto rodar depois de já existir
 * uso real gravado à moda antiga, precisa de ser revisto (não é o
 * caso agora).
 *
 * FieldValue.delete() para tirar o campo velho — sem isto ficava lá
 * morto, e um dia alguém a olhar para o Firestore ia perguntar-se
 * porque é que a versão tem os dois campos.
 *
 *   node scripts/migrarUsoPorCultoLouvor.mjs           (mostra o que faria)
 *   node scripts/migrarUsoPorCultoLouvor.mjs --write   (grava a sério)
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "louvor";
const GRAVAR = process.argv.includes("--write");

async function main() {
  const escritas = [];

  const musicasSnap = await db.collection(`bases/${BASE}/musicas`).get();
  for (const m of musicasSnap.docs) {
    const versoesSnap = await db.collection(`bases/${BASE}/musicas/${m.id}/versoes`).get();
    for (const v of versoesSnap.docs) {
      if (v.data().historico === undefined) continue;
      const comDatas = (v.data().historico || []).filter((h) => (h.datas || []).length > 0);
      if (comDatas.length) {
        console.log(`AVISO: ${m.data().titulo} / ${v.data().nome} tem datas reais — a rever à mão:`, JSON.stringify(comDatas));
        continue;
      }
      escritas.push({ ref: v.ref, tipo: "versao", nome: `${m.data().titulo} / ${v.data().nome}` });
    }
  }

  const indiceSnap = await db.collection(`bases/${BASE}/indiceCantores`).get();
  for (const doc of indiceSnap.docs) {
    const musicas = doc.data().musicas || [];
    if (!musicas.some((mu) => mu.historico !== undefined)) continue;
    escritas.push({ ref: doc.ref, tipo: "indice", nome: doc.data().nome, musicas });
  }

  console.log(`Versões a migrar: ${escritas.filter((e) => e.tipo === "versao").length}`);
  console.log(`Índices a migrar: ${escritas.filter((e) => e.tipo === "indice").length}`);

  if (GRAVAR) {
    for (const e of escritas) {
      if (e.tipo === "versao") {
        await e.ref.set({ usoPorCulto: {}, historico: admin.firestore.FieldValue.delete() }, { merge: true });
      } else {
        const musicas = e.musicas.map((mu) => {
          const { historico, ...resto } = mu;
          return { ...resto, usoPorCulto: {} };
        });
        await e.ref.set({ musicas }, { merge: true });
      }
    }
    console.log("\nGravado.");
  } else {
    console.log("\n(modo simulação — corre com --write para gravar a sério)");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
