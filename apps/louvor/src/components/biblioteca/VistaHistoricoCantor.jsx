import { useEffect, useState } from "react";
import { ouvirIndiceCantor } from "../../lib/biblioteca";
import { dataPorExtenso } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";

/**
 * Histórico por cantor — vista cheia dentro de Biblioteca, não um
 * sheet (pedido do líder: "todas as infos vão ficar pequenas dentro
 * apenas dessa janela que abre"). Lê bases/louvor/indiceCantores/
 * {pessoaId}, um documento só (ver lib/biblioteca.js e
 * functions/index.js, registarUsoVersaoLouvor) — sem query nenhuma.
 *
 * O cantor É a versão: cada entrada em indice.musicas é uma versão
 * cujo nome bate com uma pessoa da base (nome completo ou só o
 * primeiro nome) — quem cria ou edita uma versão com o nome de
 * alguém já a faz aparecer aqui, mesmo antes de essa versão ser
 * usada num culto (nesse caso o historico vem com datas:[] — tom
 * sincronizado, ainda sem uso registado).
 *
 * Duas formas de consultar a "pasta" do cantor: por música (todos os
 * tons já usados em cada versão dela) e por culto (cada domingo em
 * que alguma das versões dela foi tocada, com o tom de cada uma) —
 * o eventoId de um domingo já É a data ISO, por isso dataPorExtenso
 * aplica-se direto, sem precisar de ir buscar o evento.
 */
export default function VistaHistoricoCantor({ voluntarios, onVoltar, onAbrirMusica }) {
  const [cantor, setCantor] = useState(null);
  const [vista, setVista] = useState("musica"); // "musica" | "culto"
  const [indice, setIndice] = useState(null);

  useEffect(() => {
    if (!cantor) { setIndice(null); return; }
    return ouvirIndiceCantor(cantor.id, setIndice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantor?.id]);

  const musicas = [...(indice?.musicas || [])].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));

  const porCulto = (() => {
    const porData = {};
    musicas.forEach((m) => {
      (m.historico || []).forEach((h) => {
        (h.datas || []).forEach((eventoId) => {
          (porData[eventoId] ??= []).push({ musicaId: m.musicaId, titulo: m.titulo, tom: h.tom });
        });
      });
    });
    return Object.entries(porData).sort((a, b) => b[0].localeCompare(a[0]));
  })();

  return (
    <div>
      <div className="linha" style={{ border: 0, padding: "0 0 6px", cursor: "pointer" }} onClick={cantor ? () => setCantor(null) : onVoltar}>
        <span className="seta" style={{ transform: "scaleX(-1)" }}>›</span>
        <div style={{ flex: 1 }}><p className="nmt">{cantor ? "Trocar cantor" : "Voltar à Biblioteca"}</p></div>
      </div>
      <h3>Histórico por cantor</h3>

      {!cantor ? (
        <>
          <p className="sb2">Escolhe quem já tem versão com o nome dela, para ver todas as músicas e tons</p>
          {voluntarios.map((p) => (
            <div className="linha" style={{ cursor: "pointer" }} key={p.id} onClick={() => setCantor(p)}>
              <Avatar pessoa={p} tamanho={34} fonte={13} />
              <div style={{ flex: 1 }}><p className="nmt">{p.nome}</p></div>
              <span className="seta">›</span>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="linha" style={{ border: 0, padding: "10px 0" }}>
            <Avatar pessoa={cantor} tamanho={40} fonte={15} />
            <div style={{ flex: 1 }}><p className="nmt">{cantor.nome}</p></div>
          </div>

          <div className="subtabs">
            <button data-on={vista === "musica" ? 1 : 0} onClick={() => setVista("musica")}>Por música</button>
            <button data-on={vista === "culto" ? 1 : 0} onClick={() => setVista("culto")}>Por culto</button>
          </div>

          {vista === "musica" ? (
            <>
              <label className="rot" style={{ marginTop: 12 }}>
                {musicas.length ? `${musicas.length} versão${musicas.length === 1 ? "" : "ões"}` : "Ainda nenhuma versão"}
              </label>
              {!musicas.length && (
                <div className="vaz">Ainda não há nenhuma versão com o nome de {cantor.nome.split(" ")[0]}.</div>
              )}
              {musicas.map((m) => (
                <div className="linha" style={{ cursor: "pointer" }} key={`${m.musicaId}-${m.versaoId}`} onClick={() => onAbrirMusica(m.musicaId)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="nmt">{m.titulo}</p>
                    <p className="ds">{m.artista}{m.nomeVersao ? ` · versão "${m.nomeVersao}"` : ""}</p>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 150 }}>
                    {(m.historico || []).length
                      ? m.historico.map((h) => (
                          <span key={h.tom} className="tag cinz">{h.tom} · {(h.datas || []).length}×</span>
                        ))
                      : <span className="ds">sem uso ainda</span>}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <label className="rot" style={{ marginTop: 12 }}>
                {porCulto.length ? `${porCulto.length} culto${porCulto.length === 1 ? "" : "s"}` : "Ainda nenhum culto"}
              </label>
              {!porCulto.length && <div className="vaz">Ainda não há registo de nenhum culto.</div>}
              {porCulto.map(([eventoId, itens]) => (
                <div className="linha" style={{ alignItems: "flex-start" }} key={eventoId}>
                  <div style={{ flex: 1 }}>
                    <p className="nmt">{dataPorExtenso(eventoId)}</p>
                    {itens.map((it, i) => (
                      <p key={i} className="ds" style={{ cursor: "pointer" }} onClick={() => onAbrirMusica(it.musicaId)}>
                        {it.titulo} · tom {it.tom}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
