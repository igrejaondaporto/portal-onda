export const CORES = ["var(--azul)", "var(--ciano)", "var(--magenta)", "var(--verde)", "var(--laranja)", "var(--violeta)"];

/** Cor determinística por nome — a mesma pessoa fica sempre com a
 *  mesma cor, sem precisar de gravar nada. */
export function corPara(texto) {
  let h = 0;
  for (const c of String(texto || "?")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}

export function inicial(nome) {
  return (nome || "?").trim()[0]?.toUpperCase() || "?";
}

/** "Apoio" → "Base Apoio"; "Base Louvor" → "Base Louvor" (sem
 *  duplicar). O campo `bases/{id}.nome` não é consistente entre
 *  bases — algumas já gravam o nome com "Base" pela frente, outras
 *  não — por isso nunca se pode simplesmente prefixar às cegas. */
export function nomeBase(nome) {
  const n = String(nome || "").trim();
  return /^base\b/i.test(n) ? n : `Base ${n}`;
}

const DIA_MS = 24 * 60 * 60 * 1000;
export function relativo(timestamp) {
  const ms = timestamp?.toMillis?.() ?? (timestamp?.seconds ? timestamp.seconds * 1000 : null);
  if (!ms) return "";
  const dias = Math.floor((Date.now() - ms) / DIA_MS);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  if (dias < 7) return `há ${dias} dias`;
  const semanas = Math.round(dias / 7);
  if (semanas === 1) return "há 1 semana";
  if (dias < 30) return `há ${semanas} semanas`;
  return `há ${Math.round(dias / 30)} mês${dias >= 60 ? "es" : ""}`;
}

/** "Onde" (2026-10): a cidade do anúncio, ou — anúncios de antes, sem
 *  cidade — o nome da região antiga. O filtro é feito a partir disto,
 *  dos anúncios que existem, e cresce sozinho. */
export function lugarDe(a) {
  return a.cidade || REGIOES.find((r) => r.id === a.regiao)?.nome || "";
}
/** `lugar`: "todas" | "Maia" | "Maia||Pedrouços" */
export function bateLugar(a, lugar) {
  if (lugar === "todas") return true;
  const [cidade, freguesia] = lugar.split("||");
  return lugarDe(a) === cidade && (!freguesia || a.freguesia === freguesia);
}
export const nomeLugar = (lugar) => {
  const [cidade, freguesia] = String(lugar).split("||");
  return freguesia ? `${freguesia}, ${cidade}` : cidade;
};

export const REGIOES = [
  { id: "norte", nome: "Norte" },
  { id: "lisboa", nome: "Lisboa" },
  { id: "sines", nome: "Sines" },
];

/** Produtos e Serviços (2026-09, pedido do dono do produto): o mural é
 *  uma grelha 2×2 — natureza × tipo (Ofereço/Procuro). Serviços
 *  primeiro e aberto por omissão (2026-10, pedido). Cada um com a sua
 *  cor (mural.css, `data-natureza`): Serviços o azul de sempre,
 *  Produtos o lima do "Onda" do título. */
export const NATUREZAS = [
  { id: "servico", nome: "Serviços", sub: "trabalho, ajuda, boleias" },
  { id: "produto", nome: "Produtos", sub: "coisas: vender, dar, arrendar" },
];

/** As categorias de cada tipo, com a natureza a que pertencem. Os ids
 *  são os de sempre (os anúncios antigos continuam válidos) — só os
 *  nomes passaram a dizer o gesto ("Vendo", "Quero arrendar"). "outros"
 *  é o único que existe nos dois lados (`natureza: null`). A mesma
 *  lista vive em functions/mural.js (CATEGORIAS/CATEGORIAS_SERVICO),
 *  que é quem valida — mudar uma, mudar a outra. */
export const CATEGORIAS = {
  ofereco: [
    { id: "venda", nome: "Vendo", natureza: "produto" },
    { id: "doacao", nome: "Dou", natureza: "produto" },
    { id: "arrendamento", nome: "Arrendo", natureza: "produto" },
    { id: "servicos", nome: "Faço serviços", natureza: "servico" },
    { id: "emprego", nome: "Vaga de emprego", natureza: "servico" },
    { id: "boleias", nome: "Dou boleia", natureza: "servico" },
    { id: "outros", nome: "Outros", natureza: null },
  ],
  procuro: [
    { id: "objetos", nome: "Compro / preciso de", natureza: "produto" },
    { id: "arrendar", nome: "Quero arrendar", natureza: "produto" },
    { id: "servicos", nome: "Preciso de um serviço", natureza: "servico" },
    { id: "emprego", nome: "Procuro emprego", natureza: "servico" },
    { id: "boleias", nome: "Preciso de boleia", natureza: "servico" },
    { id: "outros", nome: "Outros", natureza: null },
  ],
};

/** As categorias de um quadrado (natureza × tipo), "Outros" no fim. */
export const categoriasDe = (natureza, tipo) =>
  (CATEGORIAS[tipo] ?? []).filter((c) => c.natureza === natureza || c.natureza === null);

/** A natureza de um anúncio: a gravada, ou (anúncios de antes de
 *  2026-09) a que a categoria diz — "outros" sem natureza fica em
 *  Produtos. Mesma regra de `naturezaDe` em functions/mural.js. */
export function naturezaDe(anuncio) {
  if (anuncio.natureza) return anuncio.natureza;
  return ["servicos", "emprego", "boleias"].includes(anuncio.categoria) ? "servico" : "produto";
}

export const ESTADOS = {
  disponivel: { classe: "disp", nome: "Disponível" },
  reservado: { classe: "res", nome: "Reservado" },
  vendido: { classe: "vend", nome: "Vendido" },
  // 2026-10: o dono tira-o do mural sem o apagar (e retoma quando quiser)
  pausado: { classe: "paus", nome: "Pausado" },
};

/** O texto do preço, como aparece na etiqueta do feed e no detalhe.
 *  Só preço (2026-10, pedido: "a etiqueta 'Domingos' não existe — ali
 *  tem de ser apenas sobre preços"): o campo é texto livre e há
 *  anúncios com "Domingos" ou "Pago" lá dentro. Sem nenhum algarismo,
 *  a etiqueta diz "A combinar" — e numa boleia, "Grátis" (é o normal
 *  entre irmãos da igreja). O Publicar já não deixa gravar texto sem
 *  valor (ver `precoValido`). */
export function textoPreco(a) {
  if (a.gratis) return "Grátis";
  const p = String(a.preco || "").trim();
  if (/\d/.test(p)) return p;
  return a.categoria === "boleias" ? "Grátis" : "A combinar";
}
/** Preço aceitável no Publicar: vazio (= a combinar), "a combinar", ou
 *  com pelo menos um algarismo ("15 €", "15 €/hora", "até 40 €"). */
export const precoValido = (p) => {
  const t = String(p || "").trim();
  return !t || /\d/.test(t) || /^a combinar$/i.test(t);
};

/** O preço é texto livre ("120 €", "320 €/mês", "1.200€", "15,50 €/h"),
 *  por isso para ordenar lê-se o primeiro número que lá estiver.
 *  Ponto seguido de 3 algarismos é separador de milhares (1.200),
 *  vírgula é decimal. Grátis = 0; sem número ("A combinar") = null. */
export function valorPreco(a) {
  if (a.gratis) return 0;
  const m = String(a.preco || "").match(/\d[\d.\s]*(,\d+)?/);
  if (!m) return null;
  const limpo = m[0].trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Ordenar (2026-10, pedido): "Mais baratos" põe os grátis primeiro e
 *  depois do menor para o maior valor; "A combinar" vai sempre para o
 *  fim. E em QUALQUER ordem os anúncios com foto vêm primeiro — é o
 *  incentivo a pôr foto (o Publicar diz isto a quem publica). */
export const ORDENS = [
  { id: "recentes", nome: "Mais recentes" },
  { id: "baratos", nome: "Mais baratos" },
  { id: "caros", nome: "Mais caros" },
];
export function ordenar(lista, ordem) {
  const temFoto = (a) => (a.fotos?.length ? 1 : 0);
  const quando = (a) => a.criadoEm?.toMillis?.() ?? (a.criadoEm?.seconds ? a.criadoEm.seconds * 1000 : 0);
  const porPreco = (a, b, sentido) => {
    const va = valorPreco(a), vb = valorPreco(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return sentido * (va - vb);
  };
  return [...lista].sort((a, b) =>
    temFoto(b) - temFoto(a)
    || (ordem === "baratos" ? porPreco(a, b, 1) : ordem === "caros" ? porPreco(a, b, -1) : 0)
    || quando(b) - quando(a));
}

/** O filtro de categoria guarda o TIPO junto ("ofereco:venda") —
 *  "servicos"/"emprego"/"boleias"/"outros" existem dos dois lados
 *  com sentidos opostos ("Faço serviços" ≠ "Preciso de um serviço"),
 *  e em "Tudo" a folha do filtro mostra os dois grupos de uma vez. */
export const chaveCategoria = (tipo, categoriaId) => `${tipo}:${categoriaId}`;
/** Em "Tudo" (Ofereço e Procuro juntos) o Filtro mostra TEMAS da
 *  natureza aberta, e não as categorias de cada lado (2026-10, pedido:
 *  "só os da própria categoria"): "Boleias" apanha "Dou boleia" e
 *  "Preciso de boleia". Cada tema junta as chaves `tipo:categoria`. */
export const TEMAS = {
  produto: [
    { id: "compraVenda", nome: "Compra e venda", chaves: ["ofereco:venda", "procuro:objetos"] },
    { id: "doacoes", nome: "Doações", chaves: ["ofereco:doacao"] },
    { id: "arrendamento", nome: "Arrendamento", chaves: ["ofereco:arrendamento", "procuro:arrendar"] },
    { id: "outrosProduto", nome: "Outros", chaves: ["ofereco:outros", "procuro:outros"] },
  ],
  servico: [
    { id: "servicos", nome: "Serviços", chaves: ["ofereco:servicos", "procuro:servicos"] },
    { id: "emprego", nome: "Emprego", chaves: ["ofereco:emprego", "procuro:emprego"] },
    { id: "boleias", nome: "Boleias", chaves: ["ofereco:boleias", "procuro:boleias"] },
    { id: "outrosServico", nome: "Outros", chaves: ["ofereco:outros", "procuro:outros"] },
  ],
};
const temaPorId = (id) => [...TEMAS.produto, ...TEMAS.servico].find((t) => t.id === id);

export function bateCategoria(anuncio, chave) {
  if (chave === "todas") return true;
  const propria = chaveCategoria(anuncio.tipo, anuncio.categoria);
  if (String(chave).startsWith("tema:")) return !!temaPorId(chave.slice(5))?.chaves.includes(propria);
  return chave === propria;
}
export function nomeDaChave(chave) {
  if (String(chave).startsWith("tema:")) return temaPorId(chave.slice(5))?.nome ?? "";
  const [tipo, id] = String(chave).split(":");
  if (id === "outros") return tipo === "procuro" ? "Procuro · Outros" : "Ofereço · Outros";
  return nomeCategoria(tipo, id);
}

export function nomeCategoria(tipo, categoriaId) {
  return CATEGORIAS[tipo]?.find((c) => c.id === categoriaId)?.nome || categoriaId;
}

/** Link do WhatsApp a partir de um telefone (já pedido a
 *  `pedirContactoAnuncio`, nunca gravado no anúncio em si — ver o
 *  comentário em functions/mural.js). Aceita qualquer formato comum
 *  em Portugal (com ou sem +351/espaços); o wa.me só entende dígitos. */
export function linkWhatsApp(telefone) {
  const digitos = String(telefone || "").replace(/\D/g, "");
  const comIndicativo = digitos.length > 9 ? digitos : `351${digitos}`;
  return `https://wa.me/${comIndicativo}`;
}

