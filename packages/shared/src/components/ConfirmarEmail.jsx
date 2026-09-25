import { useEffect, useRef, useState } from "react";
import { confirmarCodigoEmail, pedirCodigoEmail } from "../lib/email.js";

const ESPERA_S = 60; // o mesmo minuto que functions/email.js exige entre códigos

/**
 * O segundo passo: o código de 6 dígitos que chegou ao e-mail (pedido
 * 2026-09: "recebe um e-mail para confirmar o e-mail dela"). Mesmo
 * componente no pop-up do login e na folha do menu.
 *
 * `codigoPedido` — acabou de se pedir um código nesta sessão: mostra
 * logo o campo. `falha` (`{ mensagem, motivo }`) — o e-mail ficou
 * gravado mas o código NÃO saiu (teto do dia, envio desligado…): fica
 * no "Mandar código", com a mensagem; só a `espera` de um minuto quer
 * dizer que há um código a caminho. Sem ele (voltou à app mais tarde, ou o e-mail foi
 * gravado antes de haver confirmação), pergunta primeiro se quer que
 * se mande — um código de ontem já expirou, e mandá-lo sozinho a cada
 * abertura gastava o teto do dia.
 *
 * Ao escrever o 6.º número confirma sozinho: menos um toque, em pé, à
 * porta. O `verificado` chega pelo `onSnapshot` de quem está a ouvir.
 */
const haCodigo = (codigoPedido, falha) => codigoPedido && (!falha || falha.motivo === "espera");

export default function ConfirmarEmail({ email, codigoPedido = false, falha = null, onConfirmado, onMudar, onMaisTarde }) {
  const [fase, setFase] = useState(haCodigo(codigoPedido, falha) ? "codigo" : "pedir");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(falha?.mensagem ?? null);
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(haCodigo(codigoPedido, falha) ? ESPERA_S : 0);
  const campo = useRef(null);

  useEffect(() => {
    if (espera <= 0) return undefined;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  // o `onSnapshot` do e-mail gravado costuma chegar ANTES da resposta
  // de `enviarCodigoEmail` — este passo monta-se sem saber que o código
  // já foi pedido, e fica a saber um instante depois
  useEffect(() => {
    if (!codigoPedido) return;
    const ha = haCodigo(codigoPedido, falha);
    setFase(ha ? "codigo" : "pedir");
    setAviso(falha?.mensagem ?? null);
    setEspera(ha ? ESPERA_S : 0);
  }, [codigoPedido, falha]);

  useEffect(() => { if (fase === "codigo") campo.current?.focus(); }, [fase]);

  function mandar() {
    setErro(null);
    setAviso(null);
    setOcupado(true);
    pedirCodigoEmail(email)
      .then((r) => {
        setOcupado(false);
        if (r?.jaConfirmado) { onConfirmado?.(); return; }
        setFase("codigo");
        setCodigo("");
        setEspera(ESPERA_S);
      })
      .catch((err) => {
        setOcupado(false);
        if (err?.details?.motivo === "espera") { setFase("codigo"); setEspera(ESPERA_S); setCodigo(""); }
        setAviso(err.message || "Não foi possível mandar o código.");
      });
  }

  function confirmar(valor = codigo) {
    if (ocupado) return;
    setErro(null);
    setOcupado(true);
    confirmarCodigoEmail(valor)
      .then(() => { setOcupado(false); onConfirmado?.(); })
      .catch((err) => { setOcupado(false); setErro(err.message || "Não foi possível confirmar."); });
  }

  function escrever(v) {
    const so = v.replace(/\D/g, "").slice(0, 6);
    setCodigo(so);
    setErro(null);
    if (so.length === 6) confirmar(so);
  }

  const secundario = { marginTop: 9, background: "none", color: "var(--cinza)" };

  return (
    <div>
      {fase === "pedir" ? (
        <p className="sb2" style={{ marginTop: 12 }}>
          Falta confirmar que <b>{email}</b> é teu — mandamos-te um código de 6 números.
        </p>
      ) : (
        <p className="sb2" style={{ marginTop: 12 }}>
          Escreve o código de 6 números que mandámos para <b>{email}</b>. Se não o vires, espreita o spam.
        </p>
      )}

      {aviso && <p className="ds" role="status" style={{ marginTop: 8, color: "var(--tinta, #0b1033)", fontWeight: 600 }}>{aviso}</p>}

      {fase === "codigo" && (
        <form onSubmit={(e) => { e.preventDefault(); confirmar(); }} noValidate>
          <label className="rot" htmlFor="campo-codigo" style={{ marginTop: 14 }}>Código</label>
          <input
            ref={campo} id="campo-codigo" className="campo" type="text" inputMode="numeric"
            autoComplete="one-time-code" pattern="[0-9]*" placeholder="000000" maxLength={6}
            value={codigo} onChange={(e) => escrever(e.target.value)} disabled={ocupado}
            style={{ fontSize: 26, fontWeight: 700, letterSpacing: ".35em", textAlign: "center" }}
          />
          {erro && <p className="ds" role="alert" style={{ marginTop: 6, color: "var(--magenta, #d6005c)" }}>{erro}</p>}
          <button className="btn full" type="submit" style={{ marginTop: 14 }} disabled={ocupado || codigo.length !== 6}>
            {ocupado ? "A confirmar…" : "Confirmar"}
          </button>
        </form>
      )}

      {fase === "pedir" ? (
        <button className="btn full" type="button" style={{ marginTop: 14 }} disabled={ocupado} onClick={mandar}>
          {ocupado ? "A enviar…" : "Mandar código"}
        </button>
      ) : (
        <button className="btn sec full" type="button" style={secundario} disabled={ocupado || espera > 0} onClick={mandar}>
          {espera > 0 ? `Reenviar código (${espera} s)` : "Reenviar código"}
        </button>
      )}
      <button className="btn sec full" type="button" style={secundario} disabled={ocupado} onClick={onMudar}>
        Mudar o e-mail
      </button>
      {onMaisTarde && (
        <button className="btn sec full" type="button" style={secundario} onClick={onMaisTarde}>
          Confirmar mais tarde
        </button>
      )}
    </div>
  );
}

/** A bolinha ao lado do e-mail: verde "confirmado", laranja "por
 *  confirmar". Cor + texto, nunca só a cor; o texto fica na cor da
 *  letra (o laranja e o verde sobre branco não se leem bem em letra
 *  pequena) — a bolinha é que leva a cor. */
export function SeloEmail({ estado }) {
  if (estado !== "confirmado" && estado !== "porConfirmar") return null;
  const ok = estado === "confirmado";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--tinta, #0b1033)" }}>
      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: ok ? "var(--verde, #00a88f)" : "var(--laranja, #f5a300)", display: "inline-block", flex: "none" }} />
      {ok ? "E-mail confirmado" : "Por confirmar"}
    </span>
  );
}
