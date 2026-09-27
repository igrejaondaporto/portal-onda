/**
 * Testa resultadoDaEscalaAtual (apps/tecnica/src/lib/sugestor.js) —
 * sem Firestore, sem React, sem rede.
 *
 *   npm run teste:escala-atual
 *
 * Reproduz o relato do líder: publicou a escala de outubro, alguém
 * avisou que afinal não pode servir num culto já escalado, e "Gerar
 * sugestão" só sabia propor o mês inteiro do zero — nunca carregar o
 * que já estava no ar para uma correção pontual.
 */
import { resultadoDaEscalaAtual, chaveSlot } from "../apps/tecnica/src/lib/sugestor.js";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) { console.log(`  ✓ ${nome}`); return; }
  falhas++;
  console.log(`  ✗ ${nome}\n      esperado ${b}\n      obtido   ${a}`);
}

const MIN = [
  { id: "responsavel", nome: "Responsável", ordem: 0 },
  { id: "audio", nome: "Áudio", ordem: 1 },
  { id: "iluminacao", nome: "Iluminação", ordem: 2 },
];
const DOMINGOS = [{ id: "2026-10-04" }, { id: "2026-10-11" }];

console.log("\nA escala já publicada carrega tal e qual está");
{
  const escalas = {
    "2026-10-04": { lugares: [
      { ministerioId: "responsavel", titularId: "julio", aprendizId: null },
      { ministerioId: "audio", titularId: "kairan", aprendizId: "carlos" },
    ] },
    "2026-10-11": { lugares: [
      { ministerioId: "responsavel", titularId: "diogo", aprendizId: null },
    ] },
  };
  const { resultado, contagemMes } = resultadoDaEscalaAtual(DOMINGOS, MIN, escalas);
  conferir("Responsável de 04/10 é o Julio",
    resultado[chaveSlot("2026-10-04", "responsavel")].titularId, "julio");
  conferir("Áudio de 04/10 tem titular e aprendiz",
    [resultado[chaveSlot("2026-10-04", "audio")].titularId, resultado[chaveSlot("2026-10-04", "audio")].aprendizId],
    ["kairan", "carlos"]);
  conferir("Iluminação de 04/10 (sem lugar guardado) fica 'por definir', não 'sem candidato'",
    resultado[chaveSlot("2026-10-04", "iluminacao")], { titularId: null, aprendizId: null, travado: false, motivoTravado: null, semCandidato: false });
  conferir("Responsável de 11/10 é o Diogo", resultado[chaveSlot("2026-10-11", "responsavel")].titularId, "diogo");
  conferir("nunca vem com 🔒 — não há 'forçado' sobre uma escolha já publicada",
    Object.values(resultado).every((r) => r.travado === false && r.motivoTravado === null), true);
  conferir("a contagem do mês reflete quem já está escalado (Julio 1×, Kairan 1×, Carlos 1×, Diogo 1×)",
    contagemMes, { julio: 1, kairan: 1, carlos: 1, diogo: 1 });
}

console.log("\nUm domingo sem escala nenhuma (culto novo, nunca editado) não rebenta");
{
  const { resultado, contagemMes } = resultadoDaEscalaAtual(DOMINGOS, MIN, {});
  conferir("todos os lugares ficam 'por definir'",
    Object.values(resultado).every((r) => r.titularId === null && r.aprendizId === null), true);
  conferir("ninguém é contado", contagemMes, {});
}

console.log("\nAparece a mesma forma que gerarSugestao produz — a tabela reutiliza o mesmo código");
{
  const { resultado } = resultadoDaEscalaAtual(DOMINGOS, MIN, {});
  const chaves = Object.keys(resultado[chaveSlot("2026-10-04", "responsavel")]).sort();
  conferir("as chaves batem com o que gerarSugestao produz por slot",
    chaves, ["aprendizId", "motivoTravado", "semCandidato", "titularId", "travado"]);
}

console.log(falhas ? `\n${falhas} falha(s)\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
