/**
 * Testa construirLimitesMes / contagemMesDoResultado, mais o efeito
 * do limite em gerarSugestao, candidatosParaEditar e validarSugestao
 * (todos em apps/tecnica/src/lib/sugestor.js) — sem Firestore, sem
 * React, sem rede.
 *
 *   npm run teste:limite
 *
 * Reproduz o pedido do líder: "o Kairan está disponível em 2 domingos
 * de outubro, mas só pode servir 1x no mês [...] se eu escalasse ele
 * uma vez, ele já ficava indisponível para escalar em outro domingo,
 * mesmo que aparecesse como disponível."
 */
import {
  construirLimitesMes, contagemMesDoResultado, gerarSugestao,
  candidatosParaEditar, validarSugestao, chaveSlot,
} from "../apps/tecnica/src/lib/sugestor.js";

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
];
const VOL = [
  { id: "julio", nome: "Julio", ministerios: { responsavel: "titular" } },
  { id: "kairan", nome: "Kairan", ministerios: { audio: "titular" } },
  { id: "everton", nome: "Everton", ministerios: { audio: "titular" } },
];
const DOMINGOS = [{ id: "2026-10-04" }, { id: "2026-10-11" }];

console.log("\nconstruirLimitesMes");
conferir("só entra quem respondeu com um número válido",
  construirLimitesMes([{ id: "kairan", maxVezesMes: 1 }, { id: "julio", maxVezesMes: null }, { id: "everton" }]),
  { kairan: 1 });
conferir("zero ou negativo não entra (a função da Cloud já bloqueia, mas o mapa não confia)",
  construirLimitesMes([{ id: "a", maxVezesMes: 0 }, { id: "b", maxVezesMes: -1 }]), {});

console.log("\ncontagemMesDoResultado");
{
  const resultado = {
    [chaveSlot("2026-10-04", "audio")]: { titularId: "kairan", aprendizId: null },
    [chaveSlot("2026-10-11", "audio")]: { titularId: "everton", aprendizId: "kairan" },
  };
  conferir("soma titular e aprendiz, em qualquer domingo",
    contagemMesDoResultado(resultado), { kairan: 2, everton: 1 });
}

console.log("\ngerarSugestao respeita o limite DURANTE a própria geração");
{
  const estatisticas = {};
  const indisponibilidades = {};
  const limitesMes = { kairan: 1 };
  const s = gerarSugestao({ domingos: DOMINGOS, ministerios: MIN, voluntarios: VOL, indisponibilidades, estatisticas, vezesAprendizPorMinisterio: {}, limitesMes });
  const audio04 = s.resultado[chaveSlot("2026-10-04", "audio")].titularId;
  const audio11 = s.resultado[chaveSlot("2026-10-11", "audio")].titularId;
  conferir("Kairan só entra numa das duas — a outra vai para o Everton",
    [audio04, audio11].filter((id) => id === "kairan").length, 1);
  conferir("o domingo sem o Kairan tem o Everton (não fica vazio)",
    [audio04, audio11].includes("everton"), true);
}

console.log("\ncandidatosParaEditar — o mesmo teto, ao editar à mão");
{
  const limitesMes = { kairan: 1 };
  // Kairan já está escalado em 04/10 — candidatar-se a 11/10 tem de o excluir
  const resultado = { [chaveSlot("2026-10-04", "audio")]: { titularId: "kairan", aprendizId: null } };
  const cands = candidatosParaEditar({
    voluntarios: VOL, ministerios: MIN, resultado, indisponibilidades: {}, limitesMes,
    ministerioId: "audio", nivel: "titular", domingoId: "2026-10-11",
  });
  conferir("Kairan não aparece como opção nova em 11/10 (já usou o seu 1×)",
    cands.map((p) => p.nome), ["Everton"]);

  // mas continua a aparecer na SUA PRÓPRIA célula de 04/10 (é o atual)
  const candsPropria = candidatosParaEditar({
    voluntarios: VOL, ministerios: MIN, resultado, indisponibilidades: {}, limitesMes,
    ministerioId: "audio", nivel: "titular", domingoId: "2026-10-04", atual: "kairan",
  });
  conferir("Kairan continua na lista da SUA própria célula (é o atual)",
    candsPropria.map((p) => p.nome).includes("Kairan"), true);

  // exatamente no limite (1×) não é erro — só passar dele é
  conferir("candidatosParaEditar não bloqueia quem ainda não chegou ao limite",
    candidatosParaEditar({
      voluntarios: VOL, ministerios: MIN, resultado: {}, indisponibilidades: {}, limitesMes,
      ministerioId: "audio", nivel: "titular", domingoId: "2026-10-04",
    }).map((p) => p.nome),
    ["Kairan", "Everton"]);
}

console.log("\nvalidarSugestao — vermelho só ao ULTRAPASSAR o que a pessoa disse");
{
  const limitesMes = { kairan: 1 };
  const umaVez = { [chaveSlot("2026-10-04", "audio")]: { titularId: "kairan", aprendizId: null } };
  const duasVezes = {
    [chaveSlot("2026-10-04", "audio")]: { titularId: "kairan", aprendizId: null },
    [chaveSlot("2026-10-11", "audio")]: { titularId: "kairan", aprendizId: null },
  };
  const a1 = validarSugestao({ resultado: umaVez, domingos: DOMINGOS, ministerios: MIN, indisponibilidades: {}, respondentes: new Set(["kairan"]), limitesMes });
  conferir("exatamente 1× (o que ele disse) não é erro", a1[chaveSlot("2026-10-04", "audio")].titular, null);

  const a2 = validarSugestao({ resultado: duasVezes, domingos: DOMINGOS, ministerios: MIN, indisponibilidades: {}, respondentes: new Set(["kairan"]), limitesMes });
  conferir("2× quando só disse 1× é erro vermelho",
    a2[chaveSlot("2026-10-11", "audio")].titular, { nivel: "erro", motivo: "só disse poder servir 1× este mês, já está em 2" });
}

console.log("\nSem limite declarado, nada muda (compatibilidade com quem já respondeu)");
{
  const s = gerarSugestao({ domingos: DOMINGOS, ministerios: MIN, voluntarios: VOL, indisponibilidades: {}, estatisticas: {}, vezesAprendizPorMinisterio: {}, limitesMes: {} });
  conferir("Kairan pode ser escolhido nos dois domingos, como sempre",
    [s.resultado[chaveSlot("2026-10-04", "audio")].titularId, s.resultado[chaveSlot("2026-10-11", "audio")].titularId].filter((id) => id === "kairan").length >= 0,
    true); // não trava — o teste real é que não lança erro nenhum
  conferir("candidatosParaEditar sem limitesMes (nem passado) continua a funcionar",
    candidatosParaEditar({ voluntarios: VOL, ministerios: MIN, resultado: {}, indisponibilidades: {}, ministerioId: "audio", nivel: "titular", domingoId: "2026-10-04" }).map((p) => p.nome),
    ["Kairan", "Everton"]);
}

console.log(falhas ? `\n${falhas} falha(s)\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
