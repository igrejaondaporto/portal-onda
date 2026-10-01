import { useEffect, useState } from "react";
import { ouvirMeusAnuncios, alterarEstadoAnuncio, renovarAnuncio, removerAnuncio, MAX_ATIVOS } from "../lib/anuncios.js";
import { nomeCategoria, textoPreco } from "../lib/util.js";
import FotoAnuncio from "../components/FotoAnuncio.jsx";
import GaleriaExpandida from "../components/GaleriaExpandida.jsx";
import SheetEditarAnuncio from "../components/SheetEditarAnuncio.jsx";

export default function MeusAnuncios() {
  const [meus, setMeus] = useState([]);
  const [aTrabalhar, setATrabalhar] = useState(null);
  const [imagemExpandida, setImagemExpandida] = useState(null);
  const [aEditar, setAEditar] = useState(null); // 2026-10: editar um anúncio já publicado

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
            <button className="btn sec" style={{ flex: 1 }} disabled={aTrabalhar === a.id} onClick={() => window.confirm("Excluir este anúncio?") && correr(a.id, () => removerAnuncio(a.id))}>Já não, excluir</button>
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
          <div key={a.id} className={a.ativo ? "linha" : "linha vendido"} style={{ flexWrap: "wrap", alignItems: "flex-start", gap: 14 }}>
            <FotoAnuncio anuncio={a} estilo={{ marginTop: 2 }} onExpandir={setImagemExpandida} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="nmt" style={{ display: "block" }}>{a.titulo}</span>
              <span className="ds">{nomeCategoria(a.tipo, a.categoria)} · {textoPreco(a)}</span>
              {!a.ativo ? (
                <span className="tag cinz" style={{ marginTop: 6, display: "inline-block" }}>Excluído</span>
              ) : (
                <>
                  {a.estado === "pausado" && (
                    <p className="ds" style={{ marginTop: 6, color: "var(--laranja)", fontWeight: 600 }}>Pausado — ninguém o vê no mural até o retomares.</p>
                  )}
                  {a.estado === "reservado" && (
                    <p className="ds" style={{ marginTop: 6 }}>Reservado. Quando ficar resolvido, pausa-o ou exclui-o.</p>
                  )}
                  {/* 2026-10: "Disponível" saiu (é o normal); Reservado liga e
                      desliga; Pausar tira-o do mural sem o perder; Excluir
                      tira-o de vez (ativo:false — nunca se apaga a sério). */}
                  <div className="acoesDono">
                    <button type="button" disabled={aTrabalhar === a.id} onClick={() => setAEditar(a)}>✎ Editar</button>
                    {a.estado !== "pausado" && (
                      <button
                        type="button" aria-pressed={a.estado === "reservado"} disabled={aTrabalhar === a.id}
                        onClick={() => correr(a.id, () => alterarEstadoAnuncio(a.id, a.estado === "reservado" ? "disponivel" : "reservado"))}
                      >
                        {a.estado === "reservado" ? "✓ Reservado" : "Marcar reservado"}
                      </button>
                    )}
                    <button
                      type="button" disabled={aTrabalhar === a.id}
                      onClick={() => correr(a.id, () => alterarEstadoAnuncio(a.id, a.estado === "pausado" ? "disponivel" : "pausado"))}
                    >
                      {a.estado === "pausado" ? "▶ Retomar" : "⏸ Pausar"}
                    </button>
                    <button
                      type="button" className="perigo" disabled={aTrabalhar === a.id}
                      onClick={() => window.confirm("Excluir este anúncio? Sai do mural de vez.") && correr(a.id, () => removerAnuncio(a.id))}
                    >
                      Excluir
                    </button>
                  </div>
                  <button className="sair" style={{ padding: 0, fontSize: 12.5, marginTop: 8 }} disabled={aTrabalhar === a.id} onClick={() => correr(a.id, () => renovarAnuncio(a.id))}>Renovar 30 dias</button>
                </>
              )}
            </span>
          </div>
        );
      })}
      {aEditar && <SheetEditarAnuncio anuncio={aEditar} onFechar={() => setAEditar(null)} />}
      {imagemExpandida && <GaleriaExpandida fotos={imagemExpandida} onFechar={() => setImagemExpandida(null)} />}
    </>
  );
}
