import { useEffect, useRef, useState } from "react";
import {
  LIMITE_BASES, cancelarPedidoServir, contamParaLimite, haQuantoTempo, listarBasesParaServir, pedirParaServir,
} from "../lib/candidaturas.js";
import { useTorrada } from "../lib/TorradaContext.jsx";

/**
 * "🙋 Servir noutra base" — o voluntário pede para entrar noutra base
 * (menu da foto, `MenuEu`). O líder dessa base recebe o pedido no Início
 * (`PedidosParaServir`) e por push/e-mail.
 *
 * Em cascata (2026-10, pedido do dono do produto — o mesmo do teste
 * "Onde vais servir?"): escolhe-se a 1.ª base e, se quiser, a 2.ª. O
 * pedido vai primeiro só à 1.ª; se ela disser "agora não", segue para a
 * 2.ª; se a 2.ª também, vai a todas as outras. Quem decide é o servidor
 * (functions/candidaturas.js); aqui só se escolhe e se mostra em que
 * passo está.
 *
 * No máximo duas bases: quem já está em duas vê a lista na mesma, mas
 * ao escolher uma aparece "LIMITE DE BASES ATINGIDO!" (pedido do dono
 * do produto: "coloque a mensagem após ele escolher uma base"). O
 * servidor recusa na mesma — isto é para não deixar ninguém tentar.
 *
 * Um pedido de cada vez: enquanto houver um à espera, esta folha
 * mostra-o, com "Cancelar pedido", em vez da lista. As bases onde a
 * pessoa já serve aparecem apagadas ("já serves aqui").
 */
export default function SheetServirNoutraBase({ basesOndeServe = [], pedido, onFechar }) {
  const torrada = useTorrada();
  const [bases, setBases] = useState(null);
  const [escolha, setEscolha] = useState([]); // [1.ª, 2.ª?] — ids
  const [mensagem, setMensagem] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [acabouDeEnviar, setAcabouDeEnviar] = useState(false);

  useEffect(() => {
    if (pedido) return undefined;
    let vivo = true;
    listarBasesParaServir().then((b) => { if (vivo) setBases(b); }).catch(() => { if (vivo) setBases([]); });
    return () => { vivo = false; };
  }, [pedido]);

  const jaServe = new Set(basesOndeServe);
  const noLimite = contamParaLimite(basesOndeServe).length >= LIMITE_BASES;
  // a mensagem do limite aparece no fundo de uma lista comprida: trazê-la à vista
  const refLimite = useRef(null);
  const mostraLimite = noLimite && escolha.length > 0;
  useEffect(() => {
    if (mostraLimite) refLimite.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [mostraLimite, escolha]);
  const nomeDe = (id) => bases?.find((b) => b.id === id)?.nome ?? "";
  const ondeServe = (bases ?? []).filter((b) => jaServe.has(b.id)).map((b) => b.nome);

  // tocar: a 1.ª, depois a 2.ª; tocar outra vez numa escolhida tira-a
  function tocar(id) {
    setEscolha((e) => {
      if (e.includes(id)) return e.filter((x) => x !== id);
      if (noLimite) return [id];
      return e.length < 2 ? [...e, id] : [e[0], id];
    });
  }

  async function enviar() {
    if (!escolha.length || noLimite) return;
    setAEnviar(true);
    try {
      await pedirParaServir(escolha[0], mensagem.trim(), escolha[1] ?? null);
      setAcabouDeEnviar(true);
      setMensagem("");
      setEscolha([]);
    } catch (e) {
      torrada(e.message || "Não foi possível enviar o pedido.");
    } finally {
      setAEnviar(false);
    }
  }

  async function cancelar() {
    setAEnviar(true);
    try {
      await cancelarPedidoServir(pedido.id);
      torrada("Pedido cancelado");
      setConfirmarCancelar(false);
      setAcabouDeEnviar(false);
    } catch (e) {
      torrada(e.message || "Não foi possível cancelar.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-labelledby="servir-titulo">
        <div className="pux" />
        <h2 id="servir-titulo">Servir noutra base</h2>

        {pedido ? (
          <>
            {acabouDeEnviar && (
              <div className="sv-enviado" role="status">
                <span aria-hidden>✅</span>
                <p><b>O teu pedido foi enviado aos líderes.</b> Agora é só aguardar!</p>
              </div>
            )}
            <EstadoDoPedido pedido={pedido} />
            {pedido.mensagem && <p className="ds" style={{ marginTop: 10, fontStyle: "italic" }}>“{pedido.mensagem}”</p>}
            <p className="ds" style={{ marginTop: 12, textAlign: "center" }}>
              Só podes ter um pedido de cada vez. Quando um líder responder, ficas a saber.
            </p>
            {confirmarCancelar ? (
              <div className="sv-confirmar">
                <p className="nmt" style={{ fontSize: 14 }}>Cancelar o pedido{pedido.ids?.length > 1 ? " a todas as bases" : ` à ${pedido.baseNome}`}?</p>
                <div className="sv-acoes">
                  <button className="btn perigo" disabled={aEnviar} onClick={cancelar}>{aEnviar ? "A cancelar…" : "Sim, cancelar"}</button>
                  <button className="btn sec" onClick={() => setConfirmarCancelar(false)}>Voltar</button>
                </div>
              </div>
            ) : (
              <button className="btn sec full" style={{ marginTop: 14, color: "var(--magenta)" }} onClick={() => setConfirmarCancelar(true)}>
                Cancelar pedido
              </button>
            )}
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
          </>
        ) : (
          <>
            <p className="sb2">
              Escolhe a <b>1.ª</b> e, se quiseres, a <b>2.ª</b>. O pedido vai primeiro à 1.ª; se lá não der, segue para a 2.ª, e depois para as outras bases.
            </p>
            <div style={{ marginTop: 12 }} aria-label="Bases">
              {bases === null && <p className="ds">A carregar as bases…</p>}
              {bases?.map((b) => {
                const serve = jaServe.has(b.id);
                const pos = escolha.indexOf(b.id);
                return (
                  <button
                    key={b.id} type="button" aria-pressed={pos >= 0}
                    className="sv-opc" data-on={pos >= 0 ? 1 : 0} disabled={serve}
                    onClick={() => tocar(b.id)}
                  >
                    {pos >= 0 && !noLimite ? <b className="sv-ordem">{pos + 1}.ª</b> : <i aria-hidden />}
                    {b.nome}
                    {serve && <small>já serves aqui</small>}
                  </button>
                );
              })}
            </div>

            {mostraLimite ? (
              <div className="sv-limite" role="alert" ref={refLimite}>
                <p className="sv-limite-t">LIMITE DE BASES ATINGIDO!</p>
                <p>
                  Já serves {ondeServe.length >= 2 ? `na ${ondeServe.join(" e na ")}` : "em duas bases"}. O máximo são duas.
                  Para servires na {nomeDe(escolha[0])}, fala primeiro com o líder de uma das tuas bases.
                </p>
              </div>
            ) : !noLimite && (
              <>
                <label className="rot" style={{ marginTop: 14 }} htmlFor="servir-msg">Queres dizer alguma coisa? (opcional)</label>
                <textarea
                  id="servir-msg" className="campo" rows={2} maxLength={300} value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: já mexi em som na minha antiga igreja"
                />
                <button className="btn full" style={{ marginTop: 14 }} disabled={!escolha.length || aEnviar} onClick={enviar}>
                  {aEnviar ? "A enviar…"
                    : !escolha.length ? "Escolhe a 1.ª base"
                    : `Enviar pedido: ${nomeDe(escolha[0])}${escolha[1] ? ` e ${nomeDe(escolha[1])}` : ""}`}
                </button>
              </>
            )}
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>{noLimite ? "Fechar" : "Cancelar"}</button>
          </>
        )}
      </div>
    </>
  );
}

/** Em que passo da cascata está o pedido — 1.ª escolha, 2.ª, ou todas. */
function EstadoDoPedido({ pedido: p }) {
  const segunda = p.cascata?.[1]?.nome;
  const recusadas = p.recusadas?.length ? p.recusadas.join(" e a ") : null;
  let titulo = `Pedido à ${p.baseNome}`;
  let detalhe = `Enviado ${haQuantoTempo(p.criadoEm)} · à espera do líder`;
  if (p.passo === 1 && segunda) detalhe += `. Se lá não der, segue para a ${segunda}.`;
  if (p.passo === 2) {
    titulo = `Pedido à ${p.baseNome} (2.ª escolha)`;
    detalhe = `${recusadas ? `A ${recusadas} disse “agora não”. ` : ""}À espera do líder.`;
  }
  if (p.passo === 3) {
    titulo = "Pedido enviado a todas as bases";
    detalhe = `${recusadas ? `A ${recusadas} disse${p.recusadas.length > 1 ? "ram" : ""} “agora não”. ` : ""}A primeira base que aprovar fica contigo.`;
  }
  return (
    <div className="sv-estado">
      <span style={{ fontSize: 22 }} aria-hidden>⏳</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="nmt">{titulo}</p>
        <p className="ds">{detalhe}</p>
      </div>
    </div>
  );
}
