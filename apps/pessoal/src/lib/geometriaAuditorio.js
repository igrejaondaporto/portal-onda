/**
 * Geometria pura do mapa do auditório — porte 1:1 das contas do
 * protótipo (painel-base-pessoal ok.html), sem nenhum acesso a DOM ou
 * Firestore. Recebe a `planta` (bases/pessoal/acomodacao/planta) e
 * devolve números; quem desenha é MapaAuditorio.jsx.
 *
 * Assume o mesmo número de lugares em todas as fileiras (é o que a
 * planta semeada tem hoje — 12x12). Se um dia uma fileira precisar de
 * um número diferente de lugares, esta conta tem de mudar; não é o
 * caso agora.
 */

// viewBox fixo — o mesmo do protótipo. `geometria` da planta ainda não
// afina isto (débito consciente, ver CLAUDE.md desta base); os valores
// aqui são os que já bateram certo com as fotografias do auditório.
export const VW = 1140;
export const VH = 2310;
const CX = VW / 2;
const YA = 694, YL = 1988; // y da fileira A (frente) e L (fundo)
const WA = 556, WL = 982;  // largura da fileira A e L
const CURVA = 22;

export function fileirasDaPlanta(planta) {
  return planta?.fileiras ?? [];
}

export function lugaresPorFileira(planta) {
  return planta?.fileiras?.[0]?.lugares ?? 12;
}

/** Estado de cada lugar antes de qualquer culto começar — reservados e
 *  bloqueios permanentes vêm da planta, o resto é "livre". Usado tanto
 *  para criar o doc do culto (useMapaAcomodacao) como para desenhar o
 *  mapa antes desse doc existir (ninguém do Drive abriu ainda hoje). */
export function estadoInicialLugares(planta) {
  const fileiras = fileirasDaPlanta(planta);
  const ns = lugaresPorFileira(planta);
  const reservados = new Set(planta?.reservados ?? []);
  const bloqueados = new Set(planta?.bloqueiosPermanentes ?? []);
  const lugares = {};
  fileiras.forEach((f) => {
    for (let j = 1; j <= ns; j++) {
      const id = `${f.id}${j}`;
      lugares[id] = reservados.has(id) ? "reservado" : bloqueados.has(id) ? "bloqueado" : "livre";
    }
  });
  return lugares;
}

/** Posição vertical (y), largura (w) e "progresso" (p, 0=frente..1=fundo) de uma fileira. */
function linha(i, totalFileiras) {
  const t = totalFileiras > 1 ? i / (totalFileiras - 1) : 0;
  const p = Math.pow(t, 1.2);
  return { y: YA + (YL - YA) * p, w: WA + (WL - WA) * p, p };
}

/** Posição (x,y) e tamanho (sw,sh) do lugar j da fileira i. */
export function posicaoLugar(i, j, totalFileiras, ns) {
  const L = linha(i, totalFileiras);
  const passo = L.w / ns;
  const x = CX - L.w / 2 + passo * j + passo / 2;
  const u = ns > 1 ? j / (ns - 1) : 0.5;
  const arco = -CURVA * (1 - Math.pow(2 * u - 1, 2)) * (0.5 + 0.5 * L.p);
  const sw = passo * 0.86, sh = sw * 1.13;
  return { x, y: L.y + arco, sw, sh };
}

/** Todos os lugares da planta, já com id ("A1"), posição e tamanho — calculado uma
 *  vez por planta (useMemo no componente), nunca por toque. */
export function gerarLugares(planta) {
  const fileiras = fileirasDaPlanta(planta);
  const ns = lugaresPorFileira(planta);
  const total = fileiras.length;
  const lugares = [];
  fileiras.forEach((f, i) => {
    for (let j = 0; j < ns; j++) {
      const { x, y, sw, sh } = posicaoLugar(i, j, total, ns);
      lugares.push({ id: `${f.id}${j + 1}`, fileira: f.id, indice: j, x, y, sw, sh });
    }
  });
  return lugares;
}

/** Rótulos (círculo com a letra) dos dois lados de cada fileira. */
export function gerarRotulosFileira(planta) {
  const fileiras = fileirasDaPlanta(planta);
  const total = fileiras.length;
  return fileiras.map((f, i) => {
    const L = linha(i, total);
    return { fileira: f.id, y: L.y - 2, xEsq: CX - L.w / 2 - 34, xDir: CX + L.w / 2 + 34 };
  });
}

/** Números de lugar ao longo da fileira do fundo (mais perto de quem entra). */
export function gerarNumerosFundo(planta) {
  const fileiras = fileirasDaPlanta(planta);
  const ns = lugaresPorFileira(planta);
  const total = fileiras.length;
  if (!total) return [];
  const L = linha(total - 1, total);
  const numeros = [];
  for (let j = 0; j < ns; j++) {
    const p = posicaoLugar(total - 1, j, total, ns);
    numeros.push({ x: p.x, y: L.y + 118, numero: j + 1 });
  }
  return numeros;
}

/** Degraus das duas escadas laterais, uma por fileira. */
export function gerarEscadas(planta) {
  const fileiras = fileirasDaPlanta(planta);
  const total = fileiras.length;
  const degraus = [];
  for (let lado = 0; lado < 2; lado++) {
    const dir = lado ? 1 : -1;
    for (let k = 0; k < total; k++) {
      const L1 = linha(k, total), L2 = linha(Math.min(k + 1, total - 1), total);
      const xi1 = CX + dir * (L1.w / 2 + 26), xi2 = CX + dir * (L2.w / 2 + 26);
      const xo1 = CX + dir * (L1.w / 2 + 96), xo2 = CX + dir * (L2.w / 2 + 108);
      const y1 = L1.y - 26, y2 = k === total - 1 ? L2.y + 104 : L2.y - 26;
      degraus.push({ lado: dir, pontos: `M${xi1},${y1} L${xo1},${y1} L${xo2},${y2} L${xi2},${y2} Z`, xo2, y2 });
    }
  }
  return degraus;
}

/** Placa "ENTRADA", uma de cada lado, junto às duas últimas fileiras. */
export function gerarEntradas(planta) {
  const fileiras = fileirasDaPlanta(planta);
  const total = fileiras.length;
  if (total < 2) return [];
  return [-1, 1].map((dir) => {
    const a = linha(Math.max(total - 3, 0), total), b = linha(total - 1, total);
    const p1 = { x: CX + dir * (a.w / 2 + 64), y: a.y }, p2 = { x: CX + dir * (b.w / 2 + 64), y: b.y + 46 };
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2 + (p2.y - p1.y) * 0.55 + 42;
    let angulo = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
    if (dir < 0) angulo += 180;
    return { x: mx, y: my, angulo };
  });
}

// Meio do telão (rect y=316, altura=164, em Cenario) — o enquadramento
// inicial corta-o a meio, pedido explícito de quem usa o mapa.
const TOPO_ENQUADRAMENTO = 316 + 164 / 2;
// Folga abaixo da etiqueta "ENTRADA" (altura própria 42px, mais a
// rotação) até ao fim do chão desenhado — dá para a fileira L e a
// entrada aparecerem inteiras, sem sobrar chão vazio a mais.
const FOLGA_FUNDO = 90;

/** Enquadramento inicial (e mínimo — não se afasta mais do que isto):
 *  do meio do telão até logo abaixo da etiqueta ENTRADA. Em coordenadas
 *  do desenho, não em pixels — useZoomPan converte para o wrap real. */
export function enquadramentoInicial(planta) {
  const entradas = gerarEntradas(planta);
  const fundo = entradas.length ? Math.max(...entradas.map((e) => e.y)) + FOLGA_FUNDO : VH * 0.95;
  return { topo: TOPO_ENQUADRAMENTO, fundo };
}

/** Procura o melhor bloco de N lugares seguidos livres — fileiras da
 *  frente primeiro, depois o mais próximo do centro da fileira.
 *  Função pura, testável sem React/Firestore. */
export function melhorBloco(planta, lugaresEstado, n) {
  const fileiras = fileirasDaPlanta(planta);
  const ns = lugaresPorFileira(planta);
  let melhor = null;
  fileiras.forEach((f, fi) => {
    for (let s = 1; s <= ns - n + 1; s++) {
      const ids = [];
      for (let k = 0; k < n; k++) {
        const id = `${f.id}${s + k}`;
        if (lugaresEstado[id] !== "livre") break;
        ids.push(id);
      }
      if (ids.length < n) continue;
      const centro = Math.abs(s + (n - 1) / 2 - (ns + 1) / 2);
      const pontuacao = fi * 2.2 + centro * 1.6;
      if (!melhor || pontuacao < melhor.pontuacao) melhor = { ids, pontuacao };
    }
  });
  return melhor ? melhor.ids : null;
}

/** Maior bloco de lugares livres seguidos numa fileira, usado na dica viva. */
export function maiorBlocoLivre(planta, lugaresEstado) {
  const fileiras = fileirasDaPlanta(planta);
  const ns = lugaresPorFileira(planta);
  let melhor = null;
  fileiras.forEach((f) => {
    let r = 0;
    for (let i = 1; i <= ns; i++) {
      if (lugaresEstado[`${f.id}${i}`] === "livre") {
        r++;
        if (!melhor || r > melhor.n) melhor = { fileira: f.id, n: r };
      } else r = 0;
    }
  });
  return melhor;
}
