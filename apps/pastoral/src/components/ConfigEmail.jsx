import { useEffect, useState } from "react";
import { configurarEnvioEmail, enviarEmailTeste, estadoEnvioEmail } from "../lib/pastoral";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/**
 * "E-mail dos avisos" — ligar o envio de e-mail sem computador
 * (pedido 2026-09: "arranja um jeito de eu fazer isto pelo telemóvel").
 *
 * A chave do Resend cola-se aqui e vai direta para o servidor
 * (`configurarEnvioEmail`, functions/email.js) — nunca volta: o ecrã
 * só mostra os últimos 4 caracteres, para dar para reconhecer qual
 * está gravada. O campo é `password` e sem autocompletar, para o
 * telemóvel não a guardar nem a sugerir noutro sítio.
 *
 * A ordem dos passos é a que evita surpresas: gravar a chave → mandar
 * um teste → só depois ligar o envio e o pop-up do login nas bases.
 */
export default function ConfigEmail() {
  const torrada = useTorrada();
  const [estado, setEstado] = useState(null);
  const [erro, setErro] = useState(null);
  const [chave, setChave] = useState("");
  const [para, setPara] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [aTestar, setATestar] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState(null); // { ok, texto }

  useEffect(() => {
    estadoEnvioEmail().then(setEstado).catch((e) => setErro(e.message || "Não foi possível ler a configuração."));
  }, []);

  async function mudar(dados, mensagem) {
    setAGuardar(true);
    try {
      setEstado(await configurarEnvioEmail(dados));
      torrada(mensagem);
      return true;
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      return false;
    } finally {
      setAGuardar(false);
    }
  }

  async function guardarChave() {
    if (await mudar({ chave: chave.trim() }, "Chave guardada")) setChave("");
  }

  async function testar() {
    setATestar(true);
    setResultadoTeste(null);
    try {
      await enviarEmailTeste(para.trim());
      setResultadoTeste({ ok: true, texto: `Enviado para ${para.trim()} — vê a caixa de entrada (e o spam, na primeira vez).` });
    } catch (e) {
      setResultadoTeste({ ok: false, texto: e.message || "Não foi possível enviar." });
    } finally {
      setATestar(false);
    }
  }

  return (
    <div className="sect">
      <div className="cabecalho"><h3>E-mail dos avisos</h3></div>
      <p className="ds">
        Só o que é pessoal vai por e-mail, pelo Resend: a escala do mês (um e-mail por pessoa, às 20h do dia em que
        sai), reembolsos e confirmar presença. Os recados ficam só no push. A chave fica guardada no servidor —
        depois de gravada, ninguém a volta a ver aqui.
      </p>

      {erro && <p className="ds" style={{ color: "var(--magenta)" }}>{erro}</p>}
      {!estado && !erro && <div className="vaz">A carregar…</div>}

      {estado && (
        <div className="caixa" style={{ marginTop: 10 }}>
          <ul className="pa-cfg-email">
            <li><span>Chave</span><b>{estado.temChave ? `gravada (…${estado.chaveFim})` : "ainda não"}</b></li>
            <li><span>Remetente</span><b>{estado.remetente}</b></li>
            <li><span>Envio</span><b>{estado.ativo ? "ligado" : "desligado"}</b></li>
            <li><span>Pedir e-mail no login</span><b>{estado.pedirNoLogin ? "ligado" : "desligado"}</b></li>
            {typeof estado.tetoDiario === "number" && (
              <li>
                <span>E-mails hoje</span>
                <b>{estado.enviadosHoje} de {estado.tetoDiario}{estado.enviadosHoje >= estado.tetoDiario ? " — o resto sai amanhã" : ""}</b>
              </li>
            )}
          </ul>

          <label className="rot" htmlFor="cfg-chave" style={{ marginTop: 14 }}>
            {estado.temChave ? "Trocar a chave" : "1. Chave do Resend"}
          </label>
          <input
            id="cfg-chave" className="campo" type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off"
            spellCheck={false} placeholder="re_…" value={chave} onChange={(e) => setChave(e.target.value)}
          />
          <button className="btn full" style={{ marginTop: 10 }} disabled={aGuardar || !chave.trim()} onClick={guardarChave}>
            Guardar chave
          </button>

          {estado.temChave && (
            <>
              <label className="rot" htmlFor="cfg-teste" style={{ marginTop: 18 }}>2. Mandar um e-mail de teste para</label>
              <input
                id="cfg-teste" className="campo" type="email" inputMode="email" autoCapitalize="none"
                placeholder="o-teu@email.pt" value={para} onChange={(e) => setPara(e.target.value)}
              />
              <button className="btn sec full" style={{ marginTop: 10 }} disabled={aTestar || !para.trim()} onClick={testar}>
                {aTestar ? "A enviar…" : "Enviar teste"}
              </button>
              {resultadoTeste && (
                <p className="ds" role="status" style={{ marginTop: 8, color: resultadoTeste.ok ? "var(--verde)" : "var(--magenta)", fontWeight: 600 }}>
                  {resultadoTeste.texto}
                </p>
              )}

              <p className="rot" style={{ marginTop: 18 }}>3. Ligar</p>
              <button
                className={`btn ${estado.ativo ? "sec" : ""} full`} style={{ marginTop: 6 }} disabled={aGuardar}
                onClick={() => mudar({ ativo: !estado.ativo }, estado.ativo ? "Envio desligado" : "Envio ligado")}
              >
                {estado.ativo ? "Desligar o envio de e-mails" : "Ligar o envio de e-mails"}
              </button>
              <button
                className={`btn ${estado.pedirNoLogin ? "sec" : ""} full`} style={{ marginTop: 9 }} disabled={aGuardar}
                onClick={() => mudar({ pedirNoLogin: !estado.pedirNoLogin }, estado.pedirNoLogin ? "Pop-up desligado" : "Pop-up ligado em todas as bases")}
              >
                {estado.pedirNoLogin ? "Deixar de pedir o e-mail no login" : "Pedir o e-mail no login (todas as bases)"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
