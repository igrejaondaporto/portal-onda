/**
 * Testa os textos de WhatsApp da enquete (packages/shared/src/lib/
 * mensagensEnquete.js) — sem Firestore, sem React, sem rede.
 *
 *   npm run teste:mensagens
 *
 * Os textos de referência são os que as oito bases produziam antes de
 * o líder os poder mudar. Foram comparados byte a byte com a função
 * antiga de cada base antes de ela sair do código (8 bases × 4 casos,
 * nenhuma diferença). Se um destes testes falhar depois de mexeres no
 * texto de fábrica de propósito, atualiza aqui a frase — o que este
 * teste protege é "sem querer".
 */
import {
  textoEnquete, textoLembrete, marcasDesconhecidas, paraGuardar,
  modeloPadraoEnquete, dataPorExtensoTexto, MODELO_PADRAO_LEMBRETE, MARCAS, LIMITE,
} from "../packages/shared/src/lib/mensagensEnquete.js";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) { console.log(`  ✓ ${nome}`); return; }
  falhas++;
  console.log(`  ✗ ${nome}\n      esperado ${b}\n      obtido   ${a}`);
}

const D = "tecnica.igrejaonda.pt";
const outubro = { mes: "2026-10", prazo: "2026-09-28" };
const novembro = { mes: "2026-11", prazo: "2026-09-28" };

console.log("\nTexto de fábrica — o que as bases já produziam");
conferir("uma enquete",
  textoEnquete(null, [outubro], D),
  'Pessoal, já está aberta a enquete de indisponibilidades de outubro! Se não tiveres nenhuma, basta tocar em "Não tenho indisponibilidades" no Início do portal. Prazo: até 28 de setembro.\n\ntecnica.igrejaonda.pt 🙏');
conferir("duas enquetes",
  textoEnquete(null, [outubro, novembro], D),
  'Pessoal, já estão abertas as enquetes de indisponibilidade de outubro e novembro! Se não tiveres nenhuma, basta tocar em "Não tenho indisponibilidades" no Início do portal — vai pedir os dois meses seguidos.\n\nPrazos:\noutubro: até 28 de setembro\nnovembro: até 28 de setembro\n\ntecnica.igrejaonda.pt 🙏');
conferir("objeto solto em vez de lista (como a Comunicação o passa)",
  textoEnquete(null, outubro, D), textoEnquete(null, [outubro], D));
conferir("lembrete",
  textoLembrete(null, { nome: "Ana Silva" }),
  "Olá Ana, ainda não recebi a tua resposta à enquete de indisponibilidades. Podes responder no Início do portal? 🙏");

console.log("\nTexto do líder");
conferir("o modelo dele manda, com as marcas preenchidas",
  textoEnquete("Boas! Enquete de {meses} aberta. {prazos}", [outubro, novembro], D),
  "Boas! Enquete de outubro e novembro aberta. outubro: até 28 de setembro\nnovembro: até 28 de setembro");
conferir("uma enquete: {prazos} é só o prazo",
  textoEnquete("Prazo {prazos}", [outubro], D), "Prazo até 28 de setembro");
conferir("a mesma marca duas vezes",
  textoEnquete("{meses}, sim, {meses}!", [outubro], D), "outubro, sim, outubro!");
conferir("sem marcas nenhumas também vale (texto fixo)",
  textoEnquete("Enquete aberta, respondam!", [outubro], D), "Enquete aberta, respondam!");
conferir("lembrete personalizado",
  textoLembrete("{nome}, falta a tua resposta 🙏", { nome: "Rui Costa" }), "Rui, falta a tua resposta 🙏");
conferir("nome vazio não parte nada", textoLembrete("Olá {nome}!", { nome: "" }), "Olá !");
conferir("'$&' e '$1' escritos pelo líder saem à letra (não são instruções do replace)",
  textoEnquete("Custa $& ou $1 — {meses}", [outubro], D), "Custa $& ou $1 — outubro");

console.log("\nMarcas");
conferir("uma marca inventada é apanhada",
  marcasDesconhecidas("Enquete de {mes} até {prazos} {foo}", "enquete"), ["mes", "foo"]);
conferir("marcas certas não dão erro", marcasDesconhecidas("{meses} {prazos}", "enquete"), []);
conferir("{nome} não é marca da enquete (só do lembrete)", marcasDesconhecidas("{nome}", "enquete"), ["nome"]);
conferir("o lembrete só conhece {nome}", marcasDesconhecidas("{nome} {meses}", "lembrete"), ["meses"]);
conferir("a mesma marca errada não repete", marcasDesconhecidas("{x} {x}", "enquete"), ["x"]);
conferir("os botões do editor vêm de MARCAS", MARCAS.enquete.map((m) => m.chave), ["meses", "prazos"]);

console.log("\nO que se grava");
conferir("igual ao de fábrica → null (para herdar melhorias futuras)",
  paraGuardar(modeloPadraoEnquete(1, D), modeloPadraoEnquete(1, D)), null);
conferir("igual ao de fábrica, com espaços e quebras a mais → null",
  paraGuardar(`  ${MODELO_PADRAO_LEMBRETE}\n\n`, MODELO_PADRAO_LEMBRETE), null);
conferir("caixa vazia → null (volta ao de fábrica)", paraGuardar("   \n ", MODELO_PADRAO_LEMBRETE), null);
conferir("diferente → o texto dele, aparado", paraGuardar("  Olá {nome}!  ", MODELO_PADRAO_LEMBRETE), "Olá {nome}!");
conferir("quebras de linha do Windows normalizam", paraGuardar("a\r\nb", "x"), "a\nb");

console.log("\nDatas");
conferir("28 de setembro", dataPorExtensoTexto("2026-09-28"), "28 de setembro");
conferir("1 de janeiro (o dia não escorrega)", dataPorExtensoTexto("2027-01-01"), "1 de janeiro");
conferir("vazio", dataPorExtensoTexto(""), "");
conferir("o limite cabe no wa.me", LIMITE <= 1500, true);
conferir("o texto de fábrica cabe no limite", modeloPadraoEnquete(2, D).length < LIMITE, true);

console.log(falhas ? `\n${falhas} falha(s)\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
