import { useEffect, useRef, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataCurta } from "@portal/shared/lib/data.js";
import { CATEGORIAS, nomeCategoria } from "../lib/modelo";
import { domingoDaContagem, ouvirContagemPessoal, registarContagemSala } from "../lib/contagemCriancas";

/**
 * "Quantas crianças estão presentes?" — pedido 2026-09: logo no
 * Início, por sala (Baby/Fun/Júnior). Escreve na Contagem da BASE
 * PESSOAL (`registarContagemSala`, `functions/contagemSalas.js`) —
 * é daí que o Painel Pastoral tira as crianças da "Presença na
 * igreja". Não é `contagemKinder` (essa é a correção do check-in AO
 * VIVO, hoje sem uso — `CHECKIN_ATIVO=false`).
 *
 * QUEM (pedido 2026-09, "se ninguém da base marcar, deixar a pergunta
 * pendente até alguém marcar"):
 * - QUALQUER voluntário marca a SUA sala, se ainda estiver vazia; a
 *   líder geral vê e marca as três. Mesmo isolamento por sala de
 *   sempre (`minhaSalaRestrita`), e o servidor confirma a sala.
 * - Depois de marcada, SÓ a líder (geral ou de sala) corrige — o
 *   servidor recusa a um voluntário escrever por cima.
 *
 * QUANDO: o domingo mais recente até hoje (`domingoDaContagem`), não
 * só "hoje". Se ninguém marcou no domingo, a pergunta continua no
 * Início na segunda, na terça… até alguém marcar ou chegar o domingo
 * seguinte. O popup grande só abre sozinho NO PRÓPRIO domingo; nos
 * outros dias fica o cartão "a precisar de ti" à vista, sem saltar
 * para a cara de ninguém a meio da semana.
 */
export default function ContagemCriancas({ lider, liderGeral, restrita }) {
  const { eventoId, hoje: eDomingo } = domingoDaContagem();
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
  // um voluntário só mexe numa sala vazia; a líder mexe sempre
  const editaveis = lider ? salas : salas.filter((s) => valorDe(s.id) == null);
  const quando = eDomingo ? "hoje" : dataCurta(eventoId);

  // o popup GRANDE aparece sozinho, uma vez, assim que a contagem de
  // hoje carrega e ainda falta preencher alguma sala — pedido
  // explícito ("logo NA TELA inicial do domingo já apareça").
  useEffect(() => {
    if (abriuSozinho.current || !carregado || !salas.length) return;
    abriuSozinho.current = true;
    if (!todasPreenchidas && eDomingo) abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado, todasPreenchidas, salas.length]);

  function abrir() {
    if (!editaveis.length) return;
    setRascunhos(Object.fromEntries(editaveis.map((s) => [s.id, valorDe(s.id) == null ? "" : String(valorDe(s.id))])));
    setAberto(true);
  }

  async function guardar() {
    setAGuardar(true);
    try {
      await Promise.all(editaveis.map((s) => {
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

  if (!salas.length || !carregado) return null;

  const faltam = salas.filter((s) => valorDe(s.id) == null);

  return (
    <>
      {faltam.length > 0 && (
        <div className="destaque" onClick={abrir} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") abrir(); }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>A precisar de ti</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
              Quantas crianças {eDomingo ? "estão" : "estavam"} {faltam.length === 1 ? `na sala ${faltam[0].nome}` : "nas salas"}?
            </p>
            <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>
              {eDomingo ? "Hoje" : `Domingo, ${dataCurta(eventoId)}`} · ainda ninguém marcou
            </p>
          </div>
          <span style={{ fontSize: 24 }}>›</span>
        </div>
      )}

      <div className="sect" data-tour="contagem-criancas-bloco">
        <div className="cabecalho"><h3>Crianças presentes</h3><span className="cap">{quando}</span></div>
        <div
          className="kin-grelha" style={{ gridTemplateColumns: `repeat(${salas.length}, 1fr)`, cursor: editaveis.length ? "pointer" : "default" }}
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
        <p className="ds" style={{ marginTop: 8 }}>
          {!todasPreenchidas ? "Toca para preencher." : lider ? "Toca para corrigir." : "Já marcado — só a líder pode corrigir."}
        </p>
      </div>

      {aberto && (
        <>
          <div className="veu on" onClick={() => setAberto(false)} />
          <div className="pin on" role="dialog" aria-modal="true" aria-label="Quantas crianças estão presentes">
            <div className="pux" />
            <h2>Quantas crianças {eDomingo ? "estão" : "estavam"} presentes?</h2>
            <p className="ds" style={{ marginTop: 6 }}>
              {eDomingo ? "Hoje" : `Domingo, ${dataCurta(eventoId)}`}. Vai direto para a Contagem da Base Pessoal — não é
              preciso repetir lá.{!lider && " Depois de guardado, só a líder pode corrigir."}
            </p>
            {editaveis.map((s) => (
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
