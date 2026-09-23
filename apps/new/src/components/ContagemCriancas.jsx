import { useEffect, useRef, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { ouvirContagemPessoal, registarContagemSala } from "../lib/contagemCriancas";

/** A categoria desta base dentro da Contagem da Base Pessoal — ver
 *  `functions/contagemSalas.js` (`CATEGORIAS_POR_BASE`). */
const CATEGORIA = "new";

/**
 * "Quantas crianças estão presentes?" — pedido 2026-09 ("quero o
 * mesmo no painel do SHIFT e do New"), mesmo mecanismo da Kinder (ver
 * `apps/kinder/src/components/ContagemCriancas.jsx`), sem a divisão
 * por sala — aqui é só o líder da base e um número só. Um popup
 * grande aparece sozinho, uma vez, se ainda não foi preenchido hoje;
 * depois de preenchido fica um cartão simples (`.caixa`, sem o
 * destaque vivo do popup), tocar reabre para corrigir.
 *
 * Escreve na Contagem da BASE PESSOAL (`registarContagemSala`,
 * `functions/contagemSalas.js`), a mesma que o Painel Pastoral e a
 * própria Base Pessoal já leem.
 */
export default function ContagemCriancas({ eventoId, souLiderBase }) {
  const torrada = useTorrada();
  const [contagem, setContagem] = useState(null);
  const [carregado, setCarregado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const abriuSozinho = useRef(false);

  useEffect(() => {
    setCarregado(false);
    abriuSozinho.current = false;
    return ouvirContagemPessoal(eventoId, (d) => { setContagem(d); setCarregado(true); });
  }, [eventoId]);

  const valor = contagem?.categorias?.[CATEGORIA]?.valor ?? null;

  useEffect(() => {
    if (abriuSozinho.current || !carregado) return;
    abriuSozinho.current = true;
    if (valor == null) abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado, valor]);

  function abrir() {
    setRascunho(valor == null ? "" : String(valor));
    setAberto(true);
  }

  async function guardar() {
    setAGuardar(true);
    try {
      const texto = rascunho.trim();
      const novoValor = texto === "" ? null : Number(texto);
      if (novoValor !== valor) await registarContagemSala(eventoId, CATEGORIA, novoValor);
      torrada("Contagem guardada");
      setAberto(false);
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  if (!souLiderBase || !eventoId) return null;

  return (
    <>
      {valor == null ? (
        <div className="destaque" onClick={abrir}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>A precisar de ti</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>Quantas crianças estão presentes?</p>
            <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>Vai direto para a Contagem da Base Pessoal</p>
          </div>
          <span style={{ fontSize: 24 }}>›</span>
        </div>
      ) : (
        <div className="linha" style={{ cursor: "pointer" }} onClick={abrir} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") abrir(); }}>
          <div style={{ flex: 1 }}>
            <p className="nmt">Crianças presentes</p>
            <p className="ds">Toca para corrigir</p>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800 }}>{valor}</p>
        </div>
      )}

      {aberto && (
        <>
          <div className="veu on" onClick={() => setAberto(false)} />
          <div className="pin on" role="dialog" aria-modal="true" aria-label="Quantas crianças estão presentes">
            <div className="pux" />
            <h2>Quantas crianças estão presentes?</h2>
            <p className="ds" style={{ marginTop: 6 }}>Vai direto para a Contagem da Base Pessoal — não é preciso repetir lá.</p>
            <input
              className="campo" style={{ marginTop: 14 }} type="number" inputMode="numeric" min="0" step="1" placeholder="—"
              value={rascunho} onChange={(e) => setRascunho(e.target.value)}
            />
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
