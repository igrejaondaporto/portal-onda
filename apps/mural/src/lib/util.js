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

export const CATEGORIAS = {
  ofereco: [
    { id: "venda", nome: "Venda" },
    { id: "doacao", nome: "Doação" },
    { id: "arrendamento", nome: "Arrendamento" },
    { id: "emprego", nome: "Emprego" },
    { id: "outros", nome: "Outros" },
  ],
  procuro: [
    { id: "objetos", nome: "Objetos" },
    { id: "servicos", nome: "Serviços" },
    { id: "boleias", nome: "Boleias" },
    { id: "emprego", nome: "Emprego" },
    { id: "outros", nome: "Outros" },
  ],
};

export const ESTADOS = {
  disponivel: { classe: "disp", nome: "Disponível" },
  reservado: { classe: "res", nome: "Reservado" },
  vendido: { classe: "vend", nome: "Vendido" },
};

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

