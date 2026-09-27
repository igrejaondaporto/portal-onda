/**
 * Testa ministeriosComGente (apps/comunicacao/src/lib/modelo.js) —
 * sem Firestore, sem React, sem rede.
 *
 *   npm run teste:ministerios
 *
 * Reproduz o pedido do líder da Comunicação: só Storymaker, Fotografia
 * e Responsável aparecem por omissão na Escala; ele precisa de
 * autonomia para juntar um dos outros quatro (Captação e Edição, UNVT,
 * Social Media, Redação e Design) a um culto em concreto, sem mudar o
 * padrão dos outros domingos.
 */
import { ministeriosDaEscala, ministeriosComGente } from "../apps/comunicacao/src/lib/sugestor.js";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) { console.log(`  ✓ ${nome}`); return; }
  falhas++;
  console.log(`  ✗ ${nome}\n      esperado ${b}\n      obtido   ${a}`);
}
const nomes = (lista) => lista.map((m) => m.nome);

const MIN = [
  { id: "storymaker", nome: "Storymaker" },
  { id: "fotografia", nome: "Fotografia" },
  { id: "captacao", nome: "Captação e Edição" },
  { id: "unvt", nome: "UNVT" },
  { id: "social", nome: "Social Media" },
  { id: "redacao", nome: "Redação e Design" },
  { id: "resp1", nome: "Responsável" },
];
const lugar = (ministerioId, pessoas) => ({ ministerioId, pessoas });

console.log("\nSem culto nenhum: só os 3 de sempre");
conferir("ministeriosDaEscala sozinho", nomes(ministeriosDaEscala(MIN)), ["Storymaker", "Fotografia", "Responsável"]);
conferir("ministeriosComGente sem eventos", nomes(ministeriosComGente(MIN, [])), ["Storymaker", "Fotografia", "Responsável"]);

console.log("\nUm culto normal, sem extras");
{
  const ev = { escala: { lugares: [lugar("storymaker", ["ana"]), lugar("fotografia", [])] } };
  conferir("continuam só os 3", nomes(ministeriosComGente(MIN, ev)), ["Storymaker", "Fotografia", "Responsável"]);
}

console.log("\nO líder juntou 'Social Media' a este culto, com gente");
{
  const ev = { escala: { lugares: [lugar("storymaker", ["ana"]), lugar("social", ["bruno"])] } };
  conferir("Social Media aparece no fim", nomes(ministeriosComGente(MIN, ev)), ["Storymaker", "Fotografia", "Responsável", "Social Media"]);
}

console.log("\nUm ministério extra SEM ninguém não aparece — mesmo padrão dos 3 fixos vazios");
{
  const ev = { escala: { lugares: [lugar("social", [null]), lugar("social", [])] } };
  conferir("lugar todo vazio (null) não conta", nomes(ministeriosComGente(MIN, [ev])), ["Storymaker", "Fotografia", "Responsável"]);
}

console.log("\nA tabela do mês: um culto com extra, outro sem");
{
  const evA = { escala: { lugares: [lugar("unvt", ["carlos"])] } };
  const evB = { escala: { lugares: [lugar("storymaker", ["ana"])] } };
  conferir("UNVT entra para o mês inteiro (mesmo só um domingo o ter)",
    nomes(ministeriosComGente(MIN, [evA, evB])), ["Storymaker", "Fotografia", "Responsável", "UNVT"]);
}

console.log("\nUm evento único (não array) funciona igual a [evento]");
{
  const ev = { escala: { lugares: [lugar("redacao", ["diana"])] } };
  conferir("evento solto == [evento]", ministeriosComGente(MIN, ev), ministeriosComGente(MIN, [ev]));
}

console.log("\nEvento sem escala nenhuma (culto novo, nunca editado) não rebenta");
conferir("evento={} não tem extras", nomes(ministeriosComGente(MIN, {})), ["Storymaker", "Fotografia", "Responsável"]);
conferir("evento=undefined não tem extras", nomes(ministeriosComGente(MIN, undefined)), ["Storymaker", "Fotografia", "Responsável"]);

console.log(falhas ? `\n${falhas} falha(s)\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
