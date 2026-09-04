import { dataPorExtenso } from "@portal/shared/lib/data.js";

/**
 * Vista só de leitura de UMA versão — o nome dela é o título (a
 * versão É o cantor, ver CLAUDE.md desta base), com todos os tons já
 * usados e as datas de cada uso. Aberta de dois sítios: ao tocar
 * numa versão dentro de SheetMusicaDetalhe (contexto já é a música,
 * sem onVerMusicaCompleta — "Fechar" já volta para lá), e ao tocar
 * numa música dentro do Histórico por cantor (Biblioteca.jsx) — aqui
 * abre-se direto na versão do cantor, sem passar pela tela com todas
 * as versões, mas com "Ver música completa" como saída para quem
 * quiser lá chegar mesmo assim (pedido do líder).
 */
export default function SheetVersaoDetalhe({ titulo, artista, nomeVersao, tom, historico, onFechar, onVerMusicaCompleta }) {
  const historicoOrdenado = [...(historico || [])].sort((a, b) => (b.datas?.length || 0) - (a.datas?.length || 0));

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2 style={{ textAlign: "center" }}>{nomeVersao}</h2>
        <p className="sb2" style={{ textAlign: "center" }}>{titulo}{artista ? ` · ${artista}` : ""}</p>
        {tom && <p className="ds" style={{ textAlign: "center", marginTop: 4 }}>Tom atual: {tom}</p>}

        <div className="sect">
          <div className="cabecalho"><h3>Tons já usados</h3></div>
          {!historicoOrdenado.length && <div className="vaz">Ainda sem uso registado.</div>}
          {historicoOrdenado.map((h) => (
            <div className="linha" key={h.tom} style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <p className="nmt">Tom {h.tom}</p>
                <p className="ds">
                  {(h.datas || []).length
                    ? [...h.datas].sort().reverse().map((d) => dataPorExtenso(d)).join(" · ")
                    : "sem culto registado ainda"}
                </p>
              </div>
              <span className="tag cinz">{(h.datas || []).length}×</span>
            </div>
          ))}
        </div>

        {onVerMusicaCompleta && (
          <button className="btn full" style={{ marginTop: 16 }} onClick={onVerMusicaCompleta}>
            Ver música completa
          </button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
