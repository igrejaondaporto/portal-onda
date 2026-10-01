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
};

/** O filtro de categoria guarda o TIPO junto ("ofereco:venda") —
 *  "servicos"/"emprego"/"boleias"/"outros" existem dos dois lados
 *  com sentidos opostos ("Faço serviços" ≠ "Preciso de um serviço"),
 *  e em "Tudo" a folha do filtro mostra os dois grupos de uma vez. */
export const chaveCategoria = (tipo, categoriaId) => `${tipo}:${categoriaId}`;
export function bateCategoria(anuncio, chave) {
  return chave === "todas" || chave === chaveCategoria(anuncio.tipo, anuncio.categoria);
}
export function nomeDaChave(chave) {
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

