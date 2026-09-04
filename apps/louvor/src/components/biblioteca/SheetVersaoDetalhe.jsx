import { useState } from "react";
import { dataPorExtenso } from "@portal/shared/lib/data.js";
import { adicionarTomManual } from "../../lib/biblioteca";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import GradeTom from "./GradeTom";

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
 *
 * "+ Adicionar tom" (pedido do líder) grava em tonsConhecidos — um
 * tom declarado à mão, sem culto nenhum ligado — mostrado junto com
 * os tons que vêm de `historico` (derivados de usoPorCulto, esses
 * sim com datas reais), com "sem culto ainda" para os manuais.
 */
export default function SheetVersaoDetalhe({ musicaId, versaoId, titulo, artista, nomeVersao, tom, historico, tonsConhecidos, onFechar, onVerMusicaCompleta }) {
  const torrada = useTorrada();
  const [aAdicionarTom, setAAdicionarTom] = useState(false);
  const [novoTom, setNovoTom] = useState("");
  const [aGuardar, setAGuardar] = useState(false);

  const tonsComUso = new Set((historico || []).map((h) => h.tom));
  const tonsSoDeclarados = (tonsConhecidos || []).filter((t) => !tonsComUso.has(t));
  const linhas = [
    ...[...(historico || [])].sort((a, b) => (b.datas?.length || 0) - (a.datas?.length || 0)),
    ...tonsSoDeclarados.map((t) => ({ tom: t, datas: [] })),
  ];

  async function guardarNovoTom() {
    if (!novoTom) return;
    setAGuardar(true);
    try {
      await adicionarTomManual(musicaId, versaoId, novoTom);
      torrada("Tom adicionado");
      setAAdicionarTom(false);
      setNovoTom("");
    } catch (e) {
      torrada(e.message || "Não foi possível adicionar o tom.");
    } finally {
      setAGuardar(false);
    }
  }

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
          {!linhas.length && <div className="vaz">Ainda sem uso registado.</div>}
          {linhas.map((h) => (
            <div className="linha" key={h.tom} style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <p className="nmt">Tom {h.tom}</p>
                <p className="ds">
                  {(h.datas || []).length
                    ? h.datas.map((d) => dataPorExtenso(d)).join(" · ")
                    : "sem culto registado ainda"}
                </p>
              </div>
              <span className="tag cinz">{(h.datas || []).length}×</span>
            </div>
          ))}

          {aAdicionarTom ? (
            <div className="caixa" style={{ marginTop: 10 }}>
              <label className="rot">Novo tom</label>
              <GradeTom valor={novoTom} onEscolher={setNovoTom} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn full" style={{ flex: 1 }} disabled={aGuardar || !novoTom} onClick={guardarNovoTom}>
                  {aGuardar ? "A guardar…" : "Guardar"}
                </button>
                <button className="btn sec full" style={{ flex: 1 }} onClick={() => { setAAdicionarTom(false); setNovoTom(""); }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            musicaId && versaoId && (
              <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setAAdicionarTom(true)}>
                + Adicionar tom
              </button>
            )
          )}
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
