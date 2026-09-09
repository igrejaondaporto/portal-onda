/**
 * Ordem do culto: PDF do pastor → estrutura.
 *
 * Vive à parte do `index.js` pela mesma razão do `estadoEquipamento.js`:
 * sem `firebase-admin` pelo meio, dá para correr com um `node` e um PDF
 * de mentira. As Cloud Functions não têm emulador neste repositório e o
 * `npm run smoke` só chama a `dadosEntrada` — se isto não for testável
 * sozinho, não é testável de todo.
 *
 * O PDF não traz tabelas: traz pedaços de texto com coordenadas. Juntar
 * por altura (o `y`) devolve a linha; o que a linha NÃO diz é onde
 * acaba uma coluna e começa a outra. Para os momentos isso não faz
 * falta, porque o formato ("09:30 Louvor 25 min …") desambigua sozinho.
 * Para os avisos faz toda a falta, e foi aí que a versão anterior se
 * perdeu: procurava uma data em qualquer sítio da linha e usava o que
 * estivesse à esquerda dela como nome. Numa grelha de seis colunas
 *
 *     Evento | Informações | Detalhes | Materiais | O que usar? | Momento
 *     CONF26 | 27-28/11    |          | Video + BG| BG          | Avisos
 *
 * isso dava "CONF26 27" de nome (a data "28/11" foi encontrada no meio
 * do intervalo "27-28/11") e engolia as três linhas seguintes inteiras,
 * porque "26/set", "20/set" e "No final do culto" não são DD/MM e a
 * regra não pegava. Quatro avisos no papel, um só na app, e esse mal.
 *
 * Agora usa-se o `x`: a linha de cabeçalho da grelha diz onde começa a
 * coluna "Informações", e tudo o que estiver à esquerda desse ponto é a
 * coluna "Evento". É o único sítio de onde o nome pode vir, seja qual
 * for o que estiver escrito nas outras colunas.
 */

/** Junta glifos partidos pelo extrator de texto: "09 : 30" → "09:30",
 *  "14 / 08" → "14/08", "sexta - feira" → "sexta-feira". */
export function normalizar(linha) {
  return linha
    .replace(/(\d)\s*:\s*(\d)/g, "$1:$2")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1/$2")
    // só entre minúsculas: "sexta - feira" é uma palavra partida,
    // "40 min - Pr. Nuno" são duas células da grelha (projeção "-" e
    // responsável). Colar a segunda tirava o espaço a seguir a "min" e
    // a linha deixava de bater com o formato de momento — o momento
    // desaparecia da ordem sem erro nenhum.
    .replace(/([a-zà-ú])\s+-\s+([a-zà-ú])/g, "$1-$2")
    .replace(/\s+,/g, ",");
}

/**
 * PDF → linhas. Cada linha traz o texto já normalizado E os pedaços
 * com o `x` de cada um, porque a grelha dos avisos precisa de saber
 * em que coluna cada palavra caiu.
 *
 * @param bytes       Uint8Array do PDF
 * @param getDocument o `getDocument` do pdfjs-dist (injetado para este
 *                    módulo não obrigar quem só quer testar `analisar`
 *                    a carregar o pdfjs inteiro)
 */
export async function linhasDoPdf(bytes, getDocument) {
  const pdf = await getDocument({ data: bytes, disableFontFace: true, useSystemFonts: true }).promise;
  const linhas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const conteudo = await (await pdf.getPage(p)).getTextContent();
    const porY = new Map();
    for (const it of conteudo.items) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5]);          // agrupa pela altura
      const chave = [...porY.keys()].find((k) => Math.abs(k - y) <= 3) ?? y;
      if (!porY.has(chave)) porY.set(chave, []);
      porY.get(chave).push({ x: it.transform[4], w: it.width ?? 0, s: it.str });
    }
    [...porY.entries()].sort((a, b) => b[0] - a[0]).forEach(([, itens]) => {
      const ordenados = juntarColados(itens.sort((a, b) => a.x - b.x));
      const texto = normalizar(ordenados.map((i) => i.s).join(" ").replace(/\s+/g, " ").trim());
      if (texto) linhas.push({ texto, itens: ordenados });
    });
  }
  return linhas;
}

/** O extrator parte uma palavra em vários pedaços quando lhe apetece
 *  ("Informa" + "ções"). Junta os que estão colados, para o centro de
 *  cada célula ser o centro do texto todo e não o de meia palavra. */
function juntarColados(itens) {
  const saida = [];
  for (const it of itens) {
    const ultimo = saida.at(-1);
    if (ultimo && it.x - (ultimo.x + ultimo.w) < 1.2) {
      ultimo.s += it.s;
      ultimo.w = it.x + it.w - ultimo.x;
    } else {
      saida.push({ ...it });
    }
  }
  return saida;
}

const centro = (it) => it.x + it.w / 2;

const RESP = /(Pr(?:\.|a\.)?\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wáéíóúâêôãõçÁÉÍÓÚ.]*|Base\s+[A-Z]\w+|Banda|Projeç[ãa]o|Sonoplastia|Diaconia|Louvor)\s*$/;
const DETALHE = /(Ilumina[çc][ãa]o:\s*.+|TODOS OS VOLUNT[ÁA]RIOS)\s*$/i;

/** Cabeçalho da grelha de avisos: a linha que tem "Evento" e
 *  "Informações" lado a lado. É ela que fixa as colunas. */
const ehCabecalhoDaGrelha = (linha) =>
  /\bEvento\b/i.test(linha.texto) && /\bInforma[çc][õo]es\b/i.test(linha.texto);

/** Onde a grelha acaba: um momento da ordem ("09:30 …") ou o banner de
 *  outra secção. Sem isto, tudo o que viesse depois da tabela virava
 *  aviso. */
const fimDaGrelha = (linha) =>
  /^\d{1,2}:\d{2}\b/.test(linha.texto) ||
  /^(ORDEM|AVISOS|EQUIPA|OBSERVA|NOTAS|MOMENTO)/i.test(linha.texto);

/** A data só serve ao interruptor "criar culto especial" no ecrã de
 *  revisão, e por isso só se aceita quando é inequívoca: DD/MM em
 *  números. "26/set" e "No final do culto" ficam sem data — o líder
 *  escreve-a à mão se quiser criar o culto. Num intervalo ("27-28/11")
 *  vale o último dia, que é quando o evento acaba. */
function dataDoTexto(texto) {
  const m = String(texto).match(/(\d{1,2})\s*\/\s*(\d{1,2})(?!\s*\/?\d{3})/);
  if (!m) return null;
  const dia = Number(m[1]), mes = Number(m[2]);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

/**
 * Os avisos, coluna a coluna. O nome vem SEMPRE da coluna "Evento" —
 * é o que o líder pediu ver na app, e é a única célula que a grelha
 * garante preenchida em todas as linhas.
 */
export function avisosDaGrelha(linhas) {
  const avisos = [];
  for (let i = 0; i < linhas.length; i++) {
    if (!ehCabecalhoDaGrelha(linhas[i])) continue;

    // A fronteira é o MEIO CAMINHO entre o centro do rótulo "Evento" e
    // o centro do rótulo "Informações", não o início do segundo.
    //
    // Porquê: as células da grelha vêm centradas. Um texto largo como
    // "No final do culto" fica centrado na sua coluna e começa à
    // ESQUERDA do rótulo "Informações", que é curto. Cortar no início
    // do rótulo dava-lhe o nome "STORE No final do culto". Cortar a
    // meio dos dois centros aguenta qualquer largura de célula, desde
    // que o texto esteja centrado (ou alinhado) na coluna dele.
    const cabecalho = linhas[i].itens;
    const evento = cabecalho.find((it) => /^Evento\b/i.test(it.s.trim()));
    const info = cabecalho.find((it) => /^Informa[çc]/i.test(it.s.trim()));
    if (!evento || !info) continue;
    const limite = (centro(evento) + centro(info)) / 2;

    let vazias = 0;
    for (let j = i + 1; j < linhas.length && vazias < 2; j++) {
      if (fimDaGrelha(linhas[j])) break;
      const nome = linhas[j].itens.filter((it) => centro(it) < limite)
        .map((it) => it.s).join(" ").replace(/\s+/g, " ").trim();
      // célula "Evento" vazia = continuação de uma linha que quebrou,
      // não um aviso novo. Duas seguidas e damos a grelha por acabada.
      if (!nome) { vazias++; continue; }
      vazias = 0;
      const resto = linhas[j].itens.filter((it) => centro(it) >= limite)
        .map((it) => it.s).join(" ").replace(/\s+/g, " ").trim();
      avisos.push({ nome, data: dataDoTexto(resto), info: resto || null });
      i = j;
    }
  }
  return avisos;
}

export function analisar(linhas) {
  const momentos = [];
  let titulo = null, dataFicheiro = null;

  for (const { texto } of linhas) {
    const t = texto.match(/ORDEM CULTO ([A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)\s*(\d{2}\/\d{2})/i);
    if (t) { titulo = t[1].trim(); dataFicheiro = t[2]; }

    const m = texto.match(/^(\d{1,2}:\d{2})\s+(.+?)\s+(\d+)\s*min\s+(.*)$/);
    if (!m) continue;
    let resto = m[4].trim(), detalhe = null, responsavel = null;
    const d = resto.match(DETALHE);
    if (d) { detalhe = d[1].trim(); resto = resto.slice(0, d.index).trim(); }
    const r = resto.match(RESP);
    if (r) { responsavel = r[1].trim(); resto = resto.slice(0, r.index).trim(); }
    momentos.push({ hora: m[1], momento: m[2].trim(), minutos: +m[3],
      projecao: resto === "-" ? null : resto || null, responsavel, detalhe });
  }

  let fim = null;
  if (momentos.length) {
    const u = momentos.at(-1), [h, mi] = u.hora.split(":").map(Number);
    const t = h * 60 + mi + u.minutos;
    fim = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }
  return { titulo, dataFicheiro, momentos, avisos: avisosDaGrelha(linhas),
    inicio: momentos[0]?.hora ?? null, fim };
}
