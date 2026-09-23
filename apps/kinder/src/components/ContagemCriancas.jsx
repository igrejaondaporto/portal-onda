import { useEffect, useRef, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { CATEGORIAS, nomeCategoria } from "../lib/modelo";
import { ouvirContagemPessoal, registarContagemSala } from "../lib/contagemCriancas";

/**
 * "Quantas crianças estão presentes?" — pedido 2026-09: um popup
 * grande logo no Início do domingo, por sala (Baby/Fun/Júnior); a
 * líder geral vê e preenche as três, uma líder de sala só a própria
 * (mesmo isolamento por sala de sempre, `minhaSalaRestrita`). Depois
 * de preenchido, fica um cartão à vista (cor suave da própria sala,
 * `.kin-num` — já é a versão "menos vibrante" da paleta, ver
 * `varsCategoria`), tocar reabre o mesmo popup para corrigir.
 *
 * Escreve na Contagem da BASE PESSOAL (`registarContagemSala`,
 * `functions/contagemSalas.js`), não em `contagemKinder` (essa é a
 * correção do check-in AO VIVO, hoje sem uso — `CHECKIN_ATIVO=false`
 * — e é uma pergunta totalmente diferente).
 */
export default function ContagemCriancas({ eventoId, lider, liderGeral, restrita }) {
  const torrada = useTorrada();
  const [contagem, setContagem] = useState(null);
  const [carregado, setCarregado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [rascunhos, setRascunhos] = useState({});
  const [aGuardar, setAGuardar] = useState(false);
  const abriuSozinho = useRef(false);

  const salas = liderGeral ? CATEGORIAS : (restrita ? CATEGORIAS.filter((c) => c.id === restrita) : []);

  useEffect(() => {
    setCarregado(false);
    abriuSozinho.current = false;
    return ouvirContagemPessoal(eventoId, (d) => { setContagem(d); setCarregado(true); });
  }, [eventoId]);

  const valorDe = (id) => contagem?.categorias?.[id]?.valor ?? null;
  const todasPreenchidas = salas.length > 0 && salas.every((s) => valorDe(s.id) != null);

  // o popup GRANDE aparece sozinho, uma vez, assim que a contagem de
  // hoje carrega e ainda falta preencher alguma sala — pedido
  // explícito ("logo NA TELA inicial do domingo já apareça").
  useEffect(() => {
    if (abriuSozinho.current || !carregado || !salas.length) return;
    abriuSozinho.current = true;
    if (!todasPreenchidas) abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado, todasPreenchidas, salas.length]);

  function abrir() {
    setRascunhos(Object.fromEntries(salas.map((s) => [s.id, valorDe(s.id) == null ? "" : String(valorDe(s.id))])));
    setAberto(true);
  }

  async function guardar() {
    setAGuardar(true);
    try {
      await Promise.all(salas.map((s) => {
        const texto = String(rascunhos[s.id] ?? "").trim();
        const valorAtual = valorDe(s.id);
        const novoValor = texto === "" ? null : Number(texto);
        if (novoValor === valorAtual) return null;
        return registarContagemSala(eventoId, s.id, novoValor);
      }));
      torrada("Contagem guardada");
      setAberto(false);
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  if (!lider || !eventoId || !salas.length) return null;

  return (
    <>
      <div className="sect" data-tour="contagem-criancas-bloco">
        <div className="cabecalho"><h3>Crianças presentes</h3></div>
        <div
          className="kin-grelha" style={{ gridTemplateColumns: `repeat(${salas.length}, 1fr)`, cursor: "pointer" }}
          role="button" tabIndex={0} onClick={abrir}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") abrir(); }}
        >
          {salas.map((s) => {
            const v = valorDe(s.id);
            return (
              <div key={s.id} className={`kin-num${v == null ? " porfazer" : ""}`} style={{ "--c": s.cor, "--c-suave": s.suave, "--c-texto": s.texto, "--c-texto-suave": s.textoSuave }}>
                <b>{v ?? "?"}</b><span>{s.nome}</span>
              </div>
            );
          })}
        </div>
        <p className="ds" style={{ marginTop: 8 }}>Toca para {todasPreenchidas ? "corrigir" : "preencher"}.</p>
      </div>

      {aberto && (
        <>
          <div className="veu on" onClick={() => setAberto(false)} />
          <div className="pin on" role="dialog" aria-modal="true" aria-label="Quantas crianças estão presentes">
            <div className="pux" />
            <h2>Quantas crianças estão presentes?</h2>
            <p className="ds" style={{ marginTop: 6 }}>Vai direto para a Contagem da Base Pessoal — não é preciso repetir lá.</p>
            {salas.map((s) => (
              <div key={s.id}>
                <label className="rot" style={{ marginTop: 14 }}>{nomeCategoria(s.id)}</label>
                <input
                  className="campo" type="number" inputMode="numeric" min="0" step="1" placeholder="—"
                  value={rascunhos[s.id] ?? ""}
                  onChange={(e) => setRascunhos((r) => ({ ...r, [s.id]: e.target.value }))}
                />
              </div>
            ))}
            <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar} onClick={guardar}>
              {aGuardar ? "A guardar…" : "Guardar"}
            </button>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setAberto(false)}>Fechar</button>
          </div>
        </>
      )}
    </>
  );
}
