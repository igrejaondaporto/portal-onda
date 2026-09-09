/**
 * Testa o analisador da ordem do culto (functions/ordemCultoPdf.js)
 * com linhas inventadas — sem PDF, sem Firestore, sem rede.
 *
 * As Cloud Functions não têm emulador neste repositório e o `npm run
 * smoke` só chama a `dadosEntrada`; sem isto, a única forma de saber
 * se o analisador ainda funciona era publicar e olhar.
 *
 *   npm run teste:ordem
 *
 * As linhas imitam o que o pdfjs devolve: cada pedaço de texto com o
 * `x` onde começa e a largura que ocupa. As coordenadas abaixo saíram
 * de um PDF a sério, impresso com a mesma grelha do modelo do pastor.
 */
import { analisar, avisosDaGrelha, normalizar } from "../functions/ordemCultoPdf.js";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) { console.log(`  ✓ ${nome}`); return; }
  falhas++;
  console.log(`  ✗ ${nome}\n      esperado ${b}\n      obtido   ${a}`);
}

/** Constrói uma linha a partir de células {texto, centro}: cada célula
 *  fica centrada no centro da coluna, como na grelha do PDF. */
const linha = (celulas) => {
  const itens = celulas.map(({ t, c }) => ({ x: c - t.length * 2.6, w: t.length * 5.2, s: t }));
  return { texto: normalizar(itens.map((i) => i.s).join(" ")), itens };
};

// centros das seis colunas, medidos no PDF real
const [EVENTO, INFO, DETALHES, MATERIAIS, USAR, MOMENTO] = [90, 250, 400, 520, 620, 700];

const cabecalho = linha([
  { t: "Evento", c: EVENTO }, { t: "Informações", c: INFO }, { t: "Detalhes", c: DETALHES },
  { t: "Materiais", c: MATERIAIS }, { t: "O que usar?", c: USAR }, { t: "Momento", c: MOMENTO },
]);
const fila = (evento, info, materiais) => linha([
  { t: evento, c: EVENTO }, { t: info, c: INFO },
  { t: materiais, c: MATERIAIS }, { t: "BG", c: USAR }, { t: "Avisos", c: MOMENTO },
]);

console.log("\nAvisos locais — o nome vem da coluna Evento");
{
  const linhas = [
    { texto: "AVISOS LOCAIS", itens: [{ x: 380, w: 90, s: "AVISOS LOCAIS" }] },
    cabecalho,
    fila("CONF26", "27-28/11", "Video + BG"),
    fila("CASA DE ORAÇÃO", "26/set", "Video + BG"),
    fila("BATISMOS", "20/set", "BG"),
    fila("STORE", "No final do culto", "Produto"),
  ];
  const avisos = avisosDaGrelha(linhas);
  conferir("os quatro avisos, e só o nome do evento",
    avisos.map((a) => a.nome), ["CONF26", "CASA DE ORAÇÃO", "BATISMOS", "STORE"]);
  conferir("data só quando é DD/MM inequívoco",
    avisos.map((a) => a.data), ["28/11", null, null, null]);
}

console.log("\nOnde a grelha acaba");
{
  const depois = [
    cabecalho, fila("CONF26", "27-28/11", "Video + BG"),
    { texto: "09:30 Abertura 5 min BG", itens: [{ x: 30, w: 20, s: "09:30 Abertura 5 min BG" }] },
    { texto: "NÃO SOU AVISO", itens: [{ x: 30, w: 20, s: "NÃO SOU AVISO" }] },
  ];
  conferir("um momento fecha a grelha", avisosDaGrelha(depois).map((a) => a.nome), ["CONF26"]);
  conferir("sem cabeçalho não há avisos", avisosDaGrelha([fila("CONF26", "27/11", "BG")]), []);
}

console.log("\nMomentos");
{
  const linhas = [
    { texto: "ORDEM CULTO DOMINGO 13/09", itens: [] },
    { texto: normalizar("10:06 Mensagem 40 min - Pr. Nuno"), itens: [] },
    { texto: "09:35 Louvor 25 min Letras Banda", itens: [] },
  ];
  const r = analisar(linhas);
  conferir("projeção '-' não cola no responsável (o momento sobrevive)",
    r.momentos.map((m) => [m.hora, m.projecao, m.responsavel]),
    [["10:06", null, "Pr. Nuno"], ["09:35", "Letras", "Banda"]]);
  conferir("sexta - feira continua a colar", normalizar("sexta - feira"), "sexta-feira");
  conferir("título e data do ficheiro", [r.titulo, r.dataFicheiro], ["DOMINGO", "13/09"]);
}

console.log(falhas ? `\n${falhas} falha(s)\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
