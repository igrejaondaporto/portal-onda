/**
 * Testa candidatosParaEditar (apps/tecnica/src/lib/sugestor.js) — sem
 * Firestore, sem React, sem rede.
 *
 *   npm run teste:candidatos
 *
 * Reproduz o relato do líder: fechou a enquete de outubro/novembro,
 * marcou-se indisponível no Encontro de Mulheres (09/10), e ao editar
 * a célula do Responsável desse dia continuava a ver-se a si próprio
 * na lista.
 */
import { candidatosParaEditar, chaveSlot } from "../apps/tecnica/src/lib/sugestor.js";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) { console.log(`  ✓ ${nome}`); return; }
  falhas++;
  console.log(`  ✗ ${nome}\n      esperado ${b}\n      obtido   ${a}`);
}
const nomes = (lista) => lista.map((p) => p.nome);

const MIN = [
  { id: "responsavel", nome: "Responsável", ordem: 0 },
  { id: "audio", nome: "Áudio", ordem: 1 },
  { id: "iluminacao", nome: "Iluminação", ordem: 2 },
];
const VOL = [
  { id: "julio", nome: "Julio", ministerios: { responsavel: "titular", audio: "titular" } },
  { id: "diogo", nome: "Diogo", ministerios: { responsavel: "titular" } },
  { id: "jorge", nome: "Jorge", ministerios: { responsavel: "titular" } },
  { id: "kairan", nome: "Kairan", ministerios: { audio: "titular" } },
  { id: "carlos", nome: "Carlos", ministerios: { audio: "aprendiz" } },
  { id: "vinicius", nome: "Vinicius", ministerios: { audio: "aprendiz", iluminacao: "titular" } },
];
const DIA = "2026-10-09";
const base = { voluntarios: VOL, ministerios: MIN, domingoId: DIA };

console.log("\nO relato: Julio marcou-se indisponível no Encontro de Mulheres");
{
  const indisponibilidades = { julio: new Set([DIA]) };
  const cands = candidatosParaEditar({ ...base, resultado: {}, indisponibilidades, ministerioId: "responsavel", nivel: "titular" });
  conferir("Julio some da lista, ficam Diogo e Jorge", nomes(cands), ["Diogo", "Jorge"]);
}

console.log("\nA pessoa já selecionada na célula fica sempre visível");
{
  // Julio ficou selecionado ANTES de se marcar indisponível — a opção
  // continua lá (para o aviso vermelho ter um nome a apontar), mas
  // ninguém mais indisponível aparece como escolha nova.
  const indisponibilidades = { julio: new Set([DIA]) };
  const cands = candidatosParaEditar({ ...base, resultado: {}, indisponibilidades, ministerioId: "responsavel", nivel: "titular", atual: "julio" });
  conferir("Julio continua na lista, é o atual", nomes(cands), ["Julio", "Diogo", "Jorge"]);
}

console.log("\nDuplo agendamento no mesmo domingo (Áudio já tem o Kairan)");
{
  const resultado = { [chaveSlot(DIA, "audio")]: { titularId: "kairan" } };
  const cands = candidatosParaEditar({ ...base, resultado, indisponibilidades: {}, ministerioId: "iluminacao", nivel: "titular" });
  conferir("Kairan não está apto à Iluminação (nível), Vinicius sim", nomes(cands), ["Vinicius"]);

  const resultado2 = { [chaveSlot(DIA, "iluminacao")]: { titularId: "vinicius" } };
  const candsAudio = candidatosParaEditar({ ...base, resultado: resultado2, indisponibilidades: {}, ministerioId: "audio", nivel: "aprendiz" });
  conferir("Vinicius já está na Iluminação esse dia — some da lista de aprendiz do Áudio", nomes(candsAudio), ["Carlos"]);
}

console.log("\nResponsável acumula com um ministério operacional — nunca entra na conta de \"já ocupado\"");
{
  // Julio já é titular do Áudio esse dia — ainda assim pode ser Responsável
  const resultado = { [chaveSlot(DIA, "audio")]: { titularId: "julio" } };
  const cands = candidatosParaEditar({ ...base, resultado, indisponibilidades: {}, ministerioId: "responsavel", nivel: "titular" });
  conferir("Julio continua candidato a Responsável mesmo já sendo titular do Áudio", nomes(cands), ["Julio", "Diogo", "Jorge"]);

  // e o inverso: já é Responsável, continua elegível para o Áudio
  const resultado2 = { [chaveSlot(DIA, "responsavel")]: { titularId: "julio" } };
  const candsAudio = candidatosParaEditar({ ...base, resultado: resultado2, indisponibilidades: {}, ministerioId: "audio", nivel: "titular" });
  conferir("Julio continua candidato ao Áudio mesmo já sendo Responsável", nomes(candsAudio), ["Julio", "Kairan"]);
}

console.log("\nA própria célula nunca conta contra si mesma");
{
  // Julio já é o titular DESTA MESMA célula (Áudio) — reabrir o
  // dropdown dele não pode filtrá-lo por "já está no Áudio esse dia"
  const resultado = { [chaveSlot(DIA, "audio")]: { titularId: "julio" } };
  const cands = candidatosParaEditar({ ...base, resultado, indisponibilidades: {}, ministerioId: "audio", nivel: "titular", atual: "julio" });
  conferir("Julio continua na sua própria lista de Áudio", nomes(cands), ["Julio", "Kairan"]);
}

console.log("\nAprendiz nunca é o próprio titular do slot");
{
  const cands = candidatosParaEditar({ ...base, resultado: {}, indisponibilidades: {}, ministerioId: "audio", nivel: "aprendiz", excluirId: "kairan" });
  conferir("excluirId tira o titular da lista de aprendizes", nomes(cands), ["Carlos", "Vinicius"]);
}

console.log(falhas ? `\n${falhas} falha(s)\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
