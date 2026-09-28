import { useEffect, useState } from "react";
import { cancelarPedidoServir, haQuantoTempo, listarBasesParaServir, pedirParaServir } from "../lib/candidaturas.js";
import { useTorrada } from "../lib/TorradaContext.jsx";

/**
 * "🙋 Servir noutra base" — o voluntário pede para entrar noutra base
 * (menu da foto, `MenuEu`). O líder dessa base recebe o pedido no Início
 * (`PedidosParaServir`) e por push/e-mail.
 *
 * Uma base de cada vez, e um pedido de cada vez (decisão do dono do
 * produto): enquanto houver um à espera, esta folha mostra-o, com
 * "Cancelar pedido", em vez da lista. O servidor recusa um segundo
 * pedido na mesma — isto é só para não deixar ninguém tentar.
 *
 * As bases onde a pessoa já serve aparecem apagadas ("já serves aqui")
 * e não dá para as escolher: mostrá-las diz porque não estão lá.
 */
export default function SheetServirNoutraBase({ basesOndeServe = [], pedido, onFechar }) {
  const torrada = useTorrada();
  const [bases, setBases] = useState(null);
  const [escolhida, setEscolhida] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  useEffect(() => {
    if (pedido) return undefined;
    let vivo = true;
    listarBasesParaServir().then((b) => { if (vivo) setBases(b); }).catch(() => { if (vivo) setBases([]); });
    return () => { vivo = false; };
  }, [pedido]);

  const jaServe = new Set(basesOndeServe);
  const nomeEscolhida = bases?.find((b) => b.id === escolhida)?.nome;

  async function enviar() {
    if (!escolhida) return;
    setAEnviar(true);
    try {
      await pedirParaServir(escolhida, mensagem.trim());
      torrada(`Pedido enviado à ${nomeEscolhida}`);
      setMensagem("");
      setEscolhida(null);
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
            <div className="sv-estado">
              <span style={{ fontSize: 22 }} aria-hidden>⏳</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="nmt">Pedido à {pedido.baseNome}</p>
                <p className="ds">Enviado {haQuantoTempo(pedido.criadoEm)} · à espera do líder</p>
              </div>
            </div>
            {pedido.mensagem && <p className="ds" style={{ marginTop: 10, fontStyle: "italic" }}>“{pedido.mensagem}”</p>}
            <p className="ds" style={{ marginTop: 12, textAlign: "center" }}>
              Só podes ter um pedido de cada vez. Quando o líder responder, podes pedir outra base.
            </p>
            {confirmarCancelar ? (
              <div className="sv-confirmar">
                <p className="nmt" style={{ fontSize: 14 }}>Cancelar o pedido à {pedido.baseNome}?</p>
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
            <p className="sb2">Escolhe uma. O líder dessa base recebe o teu pedido e fala contigo.</p>
            <div style={{ marginTop: 12 }} role="radiogroup" aria-label="Base">
              {bases === null && <p className="ds">A carregar as bases…</p>}
              {bases?.map((b) => {
                const serve = jaServe.has(b.id);
                return (
                  <button
                    key={b.id} type="button" role="radio" aria-checked={escolhida === b.id}
                    className="sv-opc" data-on={escolhida === b.id ? 1 : 0} disabled={serve}
                    onClick={() => setEscolhida(b.id)}
                  >
                    <i aria-hidden />{b.nome}
                    {serve && <small>já serves aqui</small>}
                  </button>
                );
              })}
            </div>
            <label className="rot" style={{ marginTop: 14 }} htmlFor="servir-msg">Queres dizer alguma coisa? (opcional)</label>
            <textarea
              id="servir-msg" className="campo" rows={2} maxLength={300} value={mensagem}
              onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: já mexi em som na minha antiga igreja"
            />
            <button className="btn full" style={{ marginTop: 14 }} disabled={!escolhida || aEnviar} onClick={enviar}>
              {aEnviar ? "A enviar…" : escolhida ? `Enviar pedido à ${nomeEscolhida}` : "Escolhe uma base"}
            </button>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
          </>
        )}
      </div>
    </>
  );
}
