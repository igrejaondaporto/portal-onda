/**
 * Wiki da Comunicação — só leitura e busca no cliente. Sem editor no
 * app nesta fase (dívida consciente, ver CLAUDE.md desta base): o
 * conteúdo entra por fora (Firestore direto), o app só mostra.
 * Coleção pequena o suficiente para não precisar do índice separado
 * que a Técnica usa (wikiIndice) — lê-se bases/comunicacao/artigos
 * inteira de uma vez.
 */
import { onSnapshot, orderBy, query, where } from "firebase/firestore";
import { cArtigos } from "./modelo";

export function ouvirArtigos(cb) {
  const q = query(cArtigos(), where("ativo", "==", true), orderBy("ordem"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

const CATEGORIAS = [
  ["passo", "Passo a passo"],
  ["duvida", "Dúvidas"],
  ["artigo", "Artigos"],
];

function normalizar(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Agrupa por categoria, filtra por busca (título/resumo), na ordem
 *  fixa acima — não pela quantidade de itens, pra não saltar de
 *  posição sempre que alguém publica. */
export function agruparPorCategoria(artigos, busca) {
  const alvo = normalizar(busca);
  const filtrados = alvo
    ? artigos.filter((a) => normalizar(a.titulo).includes(alvo) || normalizar(a.resumo).includes(alvo))
    : artigos;
  return CATEGORIAS
    .map(([chave, nome]) => ({ chave, nome, itens: filtrados.filter((a) => a.categoria === chave) }))
    .filter((g) => g.itens.length > 0);
}
