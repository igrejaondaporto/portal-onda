/**
 * Confere as Cloud Functions públicas (sem PIN) logo a seguir a um
 * deploy — dadosEntrada é o que carrega a grelha "Toca no teu nome",
 * a primeira coisa que qualquer pessoa vê. Um erro de sintaxe passa
 * no `node --check`, mas só um erro em runtime (como `.exists()` em
 * vez de `.exists` no Admin SDK) aparece mesmo a chamar a função.
 *
 * Uso: node scripts/smoke-functions.mjs
 */
const REGIAO = "europe-west1";
const PROJETO = "painel-onda";
const BASES = ["apoio", "tecnica", "backstage", "comunicacao"];

async function chamarDadosEntrada(baseId) {
  const r = await fetch(`https://${REGIAO}-${PROJETO}.cloudfunctions.net/dadosEntrada`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { baseId } }),
  });
  const corpo = await r.json();
  if (!r.ok || corpo.error) {
    throw new Error(`dadosEntrada(${baseId}) falhou: HTTP ${r.status} — ${JSON.stringify(corpo.error ?? corpo)}`);
  }
  const pessoas = corpo.result?.pessoas;
  if (!Array.isArray(pessoas)) {
    throw new Error(`dadosEntrada(${baseId}) devolveu algo sem "pessoas": ${JSON.stringify(corpo).slice(0, 200)}`);
  }
  return pessoas.length;
}

let falhou = false;
for (const baseId of BASES) {
  try {
    const n = await chamarDadosEntrada(baseId);
    console.log(`✔ dadosEntrada(${baseId}): ${n} pessoas`);
  } catch (e) {
    falhou = true;
    console.error(`✘ ${e.message}`);
  }
}

if (falhou) {
  console.error("\nSmoke test falhou — não dês o deploy por terminado.");
  process.exit(1);
}
console.log("\nTudo certo.");
