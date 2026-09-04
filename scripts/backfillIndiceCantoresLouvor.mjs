/**
 * Backfill único: percorre TODAS as músicas/versões da Base Louvor e
 * sincroniza indiceCantores para as que já têm nome batendo com uma
 * pessoa ativa da base — mesma lógica de correspondência de
 * registarUsoVersaoLouvor (functions/index.js: nome completo ou só
 * o primeiro nome), sem eventoId (não inventa em que culto foi usada,
 * só liga nome+tom atual — pedido do líder, "mesmo sem ter o
 * histórico do culto que foi usado").
 *
 * Cobre também apelidos que a correspondência automática sozinha não
 * pega — mapa manual (ver APELIDOS abaixo), conferido à mão contra
 * bases/louvor/pessoas e bases/louvor/musicas em 2026-09 (ver PR do
 * Histórico por cantor). Reescreve o indiceCantores de quem for
 * encontrado por inteiro (não faz merge item a item no array
 * `musicas`) — de propósito: limpa também qualquer resto do modelo
 * antigo (historicoCantores por Lead da escala, já removido).
 *
 *   node scripts/backfillIndiceCantoresLouvor.mjs           (mostra o que faria)
 *   node scripts/backfillIndiceCantoresLouvor.mjs --write   (grava a sério)
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const BASE = "louvor";
const GRAVAR = process.argv.includes("--write");

// "Memy" ficou de fora de propósito — confirmado pelo líder (2026-09):
// "era uma vocal antiga", já não está na base, nem ativa nem inativa.
const APELIDOS = {
  "mari": "mariana turbuk",
  "cris": "cristiane torquato",
  "amanda 2": "amanda venâncio",
};
const GENERICOS = new Set(["original", "onda"]);

const norm = (s) => (s || "").trim().toLowerCase();
const primeiroNome = (s) => norm(s).split(" ")[0];

async function main() {
  const pessoasSnap = await db.collection(`bases/${BASE}/pessoas`).where("ativo", "==", true).get();
  const pessoas = pessoasSnap.docs.map((d) => ({ id: d.id, nome: d.data().nome }));

  function encontrarPessoa(nomeVersao) {
    const n = norm(nomeVersao);
    if (APELIDOS[n]) return pessoas.find((p) => norm(p.nome) === APELIDOS[n]);
    return pessoas.find((p) => norm(p.nome) === n || primeiroNome(p.nome) === n);
  }

  const musicasSnap = await db.collection(`bases/${BASE}/musicas`).get();
  const indicePorPessoa = {}; // pessoaId -> { nome, musicas: [...] }
  const naoResolvidos = new Map(); // nomeVersao -> quantas músicas
  let versoesResolvidas = 0;
  const escritasVersao = [];

  for (const m of musicasSnap.docs) {
    const versoesSnap = await db.collection(`bases/${BASE}/musicas/${m.id}/versoes`).get();
    for (const v of versoesSnap.docs) {
      const nomeVersao = (v.data().nome || "").trim();
      const tom = v.data().tom || null;
      if (!nomeVersao || GENERICOS.has(norm(nomeVersao)) || !tom) continue;

      const pessoa = encontrarPessoa(nomeVersao);
      if (!pessoa) {
        naoResolvidos.set(nomeVersao, (naoResolvidos.get(nomeVersao) || 0) + 1);
        continue;
      }

      const historicoExistente = v.data().historico || [];
      const jaTemEsteTom = historicoExistente.some((h) => h.tom === tom);
      const historico = jaTemEsteTom ? historicoExistente : [...historicoExistente, { tom, datas: [] }];
      if (!jaTemEsteTom) escritasVersao.push({ ref: v.ref, historico });

      const entrada = (indicePorPessoa[pessoa.id] ??= { nome: pessoa.nome, musicas: [] });
      entrada.musicas.push({
        musicaId: m.id, versaoId: v.id,
        titulo: m.data().titulo, artista: m.data().artista || "",
        nomeVersao, tom, historico,
      });
      versoesResolvidas++;
    }
  }

  console.log(`Versões resolvidas: ${versoesResolvidas}`);
  console.log(`Cantores encontrados: ${Object.keys(indicePorPessoa).length}`);
  for (const info of Object.values(indicePorPessoa)) {
    console.log(`  ${info.nome}: ${info.musicas.length} música(s) — ${info.musicas.map((m) => `"${m.titulo}" (${m.tom})`).join(", ")}`);
  }
  if (naoResolvidos.size) {
    console.log(`\nNomes de versão SEM pessoa correspondente (ficaram de fora):`);
    [...naoResolvidos.entries()].sort().forEach(([n, qtd]) => console.log(`  "${n}" — ${qtd}×`));
  }

  if (GRAVAR) {
    for (const { ref, historico } of escritasVersao) {
      await ref.set({ historico }, { merge: true });
    }
    for (const [id, info] of Object.entries(indicePorPessoa)) {
      await db.doc(`bases/${BASE}/indiceCantores/${id}`).set(info, { merge: true });
    }
    console.log("\nGravado.");
  } else {
    console.log("\n(modo simulação — corre com --write para gravar a sério)");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
