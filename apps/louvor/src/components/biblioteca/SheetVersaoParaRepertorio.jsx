import { useEffect, useState } from "react";
import { ouvirVersoes, versaoDoLeadComTom, registarUsoVersao } from "../../lib/biblioteca";
import { adicionarMusicaAoRepertorio } from "../../lib/repertorio";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import GradeTom from "./GradeTom";

/** Atalho "+ repertório" direto de um item da Biblioteca — pergunta
 *  só a versão (a música já é conhecida) e grava no culto que o
 *  chamador já resolveu (ver proximoEventoId em Biblioteca.jsx).
 *
 * "+ Adicionar Tom" (pedido do líder, 2026-09) — para quando nenhuma
 * versão existente serve: declara um tom novo na hora, que entra
 * direto na versão do Lead do dia (criada ou reaproveitada, mesma
 * lógica de definirTomComRedirecionamento em lib/biblioteca.js), e já
 * adiciona essa versão ao repertório. Só aparece havendo Lead
 * escalado — sem Lead não há a quem atribuir o tom. */
export default function SheetVersaoParaRepertorio({ uid, musica, eventoId, lead, onFechar, onAdicionada }) {
  const torrada = useTorrada();
  const [versoes, setVersoes] = useState([]);
  const [aGuardar, setAGuardar] = useState(false);
  const [aAdicionarTom, setAAdicionarTom] = useState(false);
  const [novoTom, setNovoTom] = useState("");

  useEffect(() => ouvirVersoes(musica.id, setVersoes), [musica.id]);

  async function escolher(versaoId) {
    if (aGuardar) return;
    if (!eventoId) { torrada("Nenhum culto encontrado este mês."); return; }
    setAGuardar(true);
    try {
      await adicionarMusicaAoRepertorio(eventoId, musica, versaoId, uid);
      if (versaoId) registarUsoVersao({ eventoId, musicaId: musica.id, versaoId });
      torrada(`"${musica.titulo}" adicionada ao repertório`);
      onAdicionada?.();
    } catch (e) {
      torrada(e.message || "Não foi possível adicionar ao repertório.");
    } finally {
      setAGuardar(false);
    }
  }

  async function adicionarComNovoTom() {
    if (!novoTom || !eventoId || !lead) return;
    setAGuardar(true);
    try {
      const versaoId = await versaoDoLeadComTom(musica.id, novoTom, lead, uid);
      await adicionarMusicaAoRepertorio(eventoId, musica, versaoId, uid);
      registarUsoVersao({ eventoId, musicaId: musica.id, versaoId });
      torrada(`"${musica.titulo}" adicionada — versão de ${lead.nome.split(" ")[0]}`);
      onAdicionada?.();
    } catch (e) {
      torrada(e.message || "Não foi possível adicionar ao repertório.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{musica.titulo}</h2>
        <p className="sb2">{musica.artista}</p>
        <p className="ds" style={{ textAlign: "center", marginTop: 8 }}>Qual versão entra no repertório?</p>
        <div style={{ marginTop: 12 }}>
          {versoes.map((v) => (
            <div
              className="linha" style={{ cursor: "pointer", opacity: aGuardar ? 0.6 : 1 }}
              key={v.id} onClick={() => escolher(v.id)}
            >
              <div style={{ flex: 1 }}>
                <p className="nmt">
                  {v.nome}
                  {v.id === musica.versaoPadraoId && <span className="tag lim" style={{ marginLeft: 8 }}>padrão</span>}
                </p>
                <p className="ds">{[v.tom && `Tom ${v.tom}`, v.bpm && `${v.bpm} BPM`].filter(Boolean).join(" · ") || "Sem dados"}</p>
              </div>
              <span className="seta">›</span>
            </div>
          ))}
          {versoes.length === 0 && (
            <button className="btn full" disabled={aGuardar} onClick={() => escolher(null)}>
              {aGuardar ? "A adicionar…" : "Adicionar sem versão definida"}
            </button>
          )}
        </div>

        {lead && (
          aAdicionarTom ? (
            <div className="caixa" style={{ marginTop: 14 }}>
              <label className="rot">Novo tom — versão de {lead.nome.split(" ")[0]}</label>
              <GradeTom valor={novoTom} onEscolher={setNovoTom} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn full" style={{ flex: 1 }} disabled={aGuardar || !novoTom} onClick={adicionarComNovoTom}>
                  {aGuardar ? "A adicionar…" : "Adicionar"}
                </button>
                <button className="btn sec full" style={{ flex: 1 }} disabled={aGuardar} onClick={() => { setAAdicionarTom(false); setNovoTom(""); }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button className="btn sec full" style={{ marginTop: 14 }} disabled={aGuardar} onClick={() => setAAdicionarTom(true)}>
              + Adicionar Tom
            </button>
          )
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
