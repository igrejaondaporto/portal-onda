/**
 * Os dois textos de WhatsApp da enquete de indisponibilidade — o que se
 * manda ao grupo quando a enquete abre, e o lembrete a quem ainda não
 * respondeu — agora com o texto do líder por cima do texto de fábrica.
 *
 * Antes eram frases fixas dentro do código de cada base (oito cópias,
 * iguais exceto o endereço no fim). O líder pediu para as poder escrever
 * à maneira dele: "isso dá autonomia para que o líder faça da maneira
 * que quer". Um texto que muda todos os meses (os meses, os prazos)
 * não se guarda como frase pronta — guarda-se como MODELO, com marcas
 * entre chavetas que o portal preenche na hora de enviar.
 *
 * Sem Firestore, sem React: dá para correr com um `node` e dados
 * inventados (`npm run teste:mensagens`).
 */

/** Marcas que cada texto aceita, e o que fazem. É daqui que o editor
 *  tira os botões de inserir e a validação — uma só fonte. */
export const MARCAS = {
  enquete: [
    { chave: "meses", rotulo: "Mês", exemplo: "outubro e novembro",
      ajuda: "o mês da enquete — ou os dois, se abriste dois de uma vez" },
    { chave: "prazos", rotulo: "Prazo", exemplo: "até 28 de setembro",
      ajuda: "o prazo para responder; com dois meses lista um prazo por linha" },
  ],
  lembrete: [
    { chave: "nome", rotulo: "Nome", exemplo: "Ana",
      ajuda: "o primeiro nome de quem vai receber" },
  ],
};

/** Ninguém escreve mais do que isto num WhatsApp de aviso, e um texto
 *  enorme rebenta o link `wa.me` (vai todo no endereço). */
export const LIMITE = 1200;

/** "2026-10" → "outubro" */
export function nomeDoMes(mes) {
  const [ano, m] = String(mes).split("-");
  return new Date(Number(ano), Number(m) - 1, 1).toLocaleDateString("pt-PT", { month: "long" });
}

/** "2026-09-28" → "28 de setembro". Lê os números do texto em vez de
 *  `new Date("2026-09-28")`, que é meia-noite UTC e, num fuso a oeste
 *  de Greenwich, aparece como o dia anterior. */
export function dataPorExtensoTexto(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    .toLocaleDateString("pt-PT", { day: "numeric", month: "long" });
}

/** O texto de fábrica — o que o líder vê no editor enquanto não
 *  escrever o dele, e para onde "Voltar ao texto original" o leva.
 *  Dois, porque o português muda com o número de enquetes
 *  ("já está aberta a enquete" / "já estão abertas as enquetes"). */
export function modeloPadraoEnquete(quantas, dominio) {
  const rodape = `\n\n${dominio} 🙏`;
  if (quantas <= 1) {
    return `Pessoal, já está aberta a enquete de indisponibilidades de {meses}! Se não tiveres nenhuma, basta tocar em "Não tenho indisponibilidades" no Início do portal. Prazo: {prazos}.${rodape}`;
  }
  return `Pessoal, já estão abertas as enquetes de indisponibilidade de {meses}! Se não tiveres nenhuma, basta tocar em "Não tenho indisponibilidades" no Início do portal — vai pedir os dois meses seguidos.\n\nPrazos:\n{prazos}${rodape}`;
}

export const MODELO_PADRAO_LEMBRETE =
  "Olá {nome}, ainda não recebi a tua resposta à enquete de indisponibilidades. Podes responder no Início do portal? 🙏";

/** Troca `{marca}` pelo valor. Usa uma FUNÇÃO como substituto, nunca uma
 *  frase: numa frase, um "$&" ou "$1" escrito pelo líder seria
 *  interpretado como instrução do replace e sairia lixo no WhatsApp. */
function preencher(modelo, valores) {
  return String(modelo).replace(/\{(\w+)\}/g, (inteira, chave) =>
    Object.prototype.hasOwnProperty.call(valores, chave) ? valores[chave] : inteira);
}

/** @param enquetes [{ mes:"2026-10", prazo:"2026-09-28" }] — uma ou mais */
export function valoresDaEnquete(enquetes) {
  const lista = Array.isArray(enquetes) ? enquetes : [enquetes];
  const meses = lista.map((e) => nomeDoMes(e.mes)).join(" e ");
  const prazos = lista.length === 1
    ? `até ${dataPorExtensoTexto(lista[0].prazo)}`
    : lista.map((e) => `${nomeDoMes(e.mes)}: até ${dataPorExtensoTexto(e.prazo)}`).join("\n");
  return { meses, prazos };
}

/** O texto que vai para o WhatsApp. `personalizado` é o que o líder
 *  guardou (ou null); sem ele, vale o de fábrica. */
export function textoEnquete(personalizado, enquetes, dominio) {
  const lista = Array.isArray(enquetes) ? enquetes : [enquetes];
  const modelo = personalizado || modeloPadraoEnquete(lista.length, dominio);
  return preencher(modelo, valoresDaEnquete(lista));
}

export function textoLembrete(personalizado, pessoa) {
  const primeiroNome = String(pessoa?.nome || "").trim().split(/\s+/)[0] || "";
  return preencher(personalizado || MODELO_PADRAO_LEMBRETE, { nome: primeiroNome });
}

/** Marcas escritas que não existem — `{mes}` em vez de `{meses}`. Se
 *  passassem, o grupo inteiro recebia "{mes}" à letra. */
export function marcasDesconhecidas(modelo, tipo) {
  const validas = new Set(MARCAS[tipo].map((m) => m.chave));
  const achadas = [...String(modelo).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  return [...new Set(achadas.filter((c) => !validas.has(c)))];
}

/** O que gravar: `null` quando o líder voltou ao texto de fábrica (ou
 *  esvaziou a caixa), para as melhorias futuras do texto de fábrica
 *  lhe chegarem sozinhas em vez de ficarem presas a uma cópia velha. */
export function paraGuardar(texto, padrao) {
  const limpo = String(texto).replace(/\r\n/g, "\n").trim();
  if (!limpo || limpo === String(padrao).trim()) return null;
  return limpo;
}
