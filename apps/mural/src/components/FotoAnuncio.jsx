/** Miniatura de um anúncio (42px, a mesma caixa de sempre — `.bola`)
 *  para as listas (Mural, Os meus, Painel). Mostra a primeira foto do
 *  ANÚNCIO — nunca do autor, são coisas diferentes (a pessoa tem o
 *  avatar dela junto ao nome, ver MiniAvatar.jsx). Sem foto, um ícone
 *  neutro em vez de uma letra colorida — uma letra parece um avatar,
 *  e este espaço é do produto, não da pessoa. */
/** `onExpandir(foto)`, se vier — a miniatura fica clicável e abre a
 *  foto em ecrã cheio (ImagemExpandida, partilhado), sem abrir o
 *  anúncio: a linha inteira já abre o anúncio ao clicar; a foto em si
 *  clica para expandir, por isso o próprio clique pára de se
 *  propagar (senão abriam os dois ao mesmo tempo). Sem foto, não há
 *  nada para expandir — fica sem onClick. */
export default function FotoAnuncio({ anuncio, estilo, onExpandir }) {
  const foto = anuncio.fotos?.[0];
  if (foto) {
    return (
      <span
        className="bola"
        style={{ backgroundImage: `url(${foto})`, cursor: onExpandir ? "zoom-in" : undefined, ...estilo }}
        onClick={onExpandir ? (e) => { e.stopPropagation(); onExpandir(foto); } : undefined}
      />
    );
  }
  return (
    <span className="bola semFotoMini" style={estilo} aria-label="Sem foto">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.5 6h3l1 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    </span>
  );
}
