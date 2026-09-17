import { useEffect, useState } from "react";
import { ouvirMeusAnuncios, alterarEstadoAnuncio, renovarAnuncio, removerAnuncio, MAX_ATIVOS } from "../lib/anuncios.js";
import { ESTADOS, nomeCategoria } from "../lib/util.js";
import FotoAnuncio from "../components/FotoAnuncio.jsx";

export default function MeusAnuncios() {
  const [meus, setMeus] = useState([]);
  const [aTrabalhar, setATrabalhar] = useState(null);

  useEffect(() => ouvirMeusAnuncios(setMeus), []);
  const ativos = meus.filter((a) => a.ativo);
  const comAviso = ativos.filter((a) => a.pedirConfirmacao && a.estado !== "vendido");

  async function correr(id, fn) {
    setATrabalhar(id);
    await fn().catch(() => {});
    setATrabalhar(null);
  }

  return (
    <>
      {comAviso.map((a) => (
        <div key={a.id} className="caixa" style={{ borderColor: "var(--laranja)", borderWidth: 1.5 }}>
          <span className="cap" style={{ color: "var(--laranja)" }}>Precisa de resposta</span>
          <h4 style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>{a.titulo} ainda está disponível?</h4>
          <p className="ds">Publicaste há quase um mês. Responde e fica mais 30 dias; ignora e sai sozinho.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button className="btn" style={{ flex: 1 }} disabled={aTrabalhar === a.id} onClick={() => correr(a.id, () => renovarAnuncio(a.id))}>Sim, continua</button>
            <button className="btn sec" style={{ flex: 1 }} disabled={aTrabalhar === a.id} onClick={() => correr(a.id, () => alterarEstadoAnuncio(a.id, "vendido"))}>Já vendi</button>
          </div>
        </div>
      ))}

      <div className="limite">
        <b>{ativos.length} de {MAX_ATIVOS} no ar</b>
        <span className="trilho"><i style={{ width: `${Math.min(100, (ativos.length / MAX_ATIVOS) * 100)}%` }} /></span>
      </div>

      {meus.length === 0 && <p className="vaz">Ainda não publicaste nada — toca em "Publicar" para começar.</p>}

      {meus.map((a) => {
        return (
          <div key={a.id} className={a.ativo ? "linha" : "linha vendido"} style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
            <FotoAnuncio anuncio={a} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="nmt" style={{ display: "block" }}>{a.titulo}</span>
              <span className="ds">{nomeCategoria(a.tipo, a.categoria)} · {a.gratis ? "grátis" : a.preco || "a combinar"}</span>
              {!a.ativo ? (
                <span className="tag cinz" style={{ marginTop: 6, display: "inline-block" }}>Removido</span>
              ) : (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {Object.entries(ESTADOS).map(([chave, e]) => (
                    <button
                      key={chave}
                      className="tag"
                      style={{
                        border: "1px solid var(--fio)", cursor: "pointer",
                        background: a.estado === chave ? "var(--azul)" : "#fff",
                        color: a.estado === chave ? "#fff" : "var(--cinza)",
                      }}
                      disabled={aTrabalhar === a.id}
                      onClick={() => correr(a.id, () => alterarEstadoAnuncio(a.id, chave))}
                    >
                      {e.nome}
                    </button>
                  ))}
                </div>
              )}
              {a.ativo && (
                <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                  <button className="sair" style={{ padding: 0, fontSize: 12.5 }} disabled={aTrabalhar === a.id} onClick={() => correr(a.id, () => renovarAnuncio(a.id))}>Renovar 30 dias</button>
                  <button className="sair" style={{ padding: 0, fontSize: 12.5, color: "var(--magenta)" }} disabled={aTrabalhar === a.id} onClick={() => window.confirm("Remover este anúncio?") && correr(a.id, () => removerAnuncio(a.id))}>Remover</button>
                </div>
              )}
            </span>
          </div>
        );
      })}
    </>
  );
}
