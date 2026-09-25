import { useEffect, useState } from "react";
import { estadoDoEmail, ouvirMeuEmail, ouvirPedirEmailNoLogin } from "../lib/email.js";
import ConfirmarEmail from "./ConfirmarEmail.jsx";
import FormEmail from "./FormEmail.jsx";

/**
 * "Qual é o teu e-mail?" — o pop-up que trava o ecrã logo a seguir ao
 * login, até a pessoa responder (pedido 2026-09: "a primeira tela, um
 * pop-up que trava, que obriga a responder").
 *
 * Obrigado a RESPONDER, não obrigado a ter e-mail: "Não tenho e-mail"
 * também é uma resposta e também fecha. Há voluntários sem e-mail (os
 * mais novos da SHIFT, os mais velhos), e um ecrã que não deixa ver a
 * escala a quem não tem e-mail, às 10h de domingo, à porta, era pior
 * do que não ter e-mail nenhum. Quem disse que não tem pode sempre
 * acrescentar mais tarde (menu da foto → E-mail para avisos).
 *
 * Só aparece quando `config/email.pedirNoLogin` está ligado — o
 * `scripts/definirEnvioEmail.mjs` liga-o no mesmo passo em que liga o
 * envio. Antes disso, pedir um e-mail que não servia para nada seria
 * pedir um dado pessoal sem motivo (RGPD).
 *
 * Sem botão de fechar e o véu não fecha ao toque, de propósito: é a
 * única folha do produto assim. Fica por cima de tudo, incluindo o
 * tour do primeiro login (z-index acima do `.tour-veu`) — responde-se
 * primeiro, a visita guiada continua a seguir.
 *
 * Dois passos (2026-09): o e-mail, e depois o código de 6 números que
 * lhe chega (`ConfirmarEmail`) — só os e-mails confirmados recebem
 * avisos. Quem já deixou o e-mail mas não o confirmou volta a ver o
 * segundo passo a cada login. Responder continua obrigatório;
 * CONFIRMAR não: o código pode demorar, ir para o spam, ou o teto de
 * e-mails do dia pode já ter acabado — "Confirmar mais tarde" fecha
 * até ao próximo login.
 */
export default function PedirEmail() {
  const [ligado, setLigado] = useState(false);
  const [meu, setMeu] = useState(undefined); // undefined = a carregar
  const [pedido, setPedido] = useState(null); // { email, falha } — código pedido nesta sessão
  const [mudar, setMudar] = useState(false);
  const [adiado, setAdiado] = useState(false);

  useEffect(() => ouvirPedirEmailNoLogin(setLigado), []);
  useEffect(() => (ligado ? ouvirMeuEmail(setMeu) : undefined), [ligado]);

  const estado = estadoDoEmail(meu);
  if (!ligado || meu === undefined || adiado || estado === "confirmado" || estado === "semEmail") return null;

  // o passo do código: acabou de se pedir (antes de o snapshot chegar)
  // ou o e-mail gravado ainda está por confirmar
  const emailPorConfirmar = !mudar && (pedido?.email || (estado === "porConfirmar" ? meu.email : null));

  return (
    <>
      <div className="veu on" style={{ zIndex: 80 }} />
      <div className="pin on" role="dialog" aria-modal="true" aria-labelledby="pedir-email-titulo" style={{ zIndex: 81 }}>
        <div className="pux" />
        {emailPorConfirmar ? (
          <>
            <h2 id="pedir-email-titulo">Confirma o teu e-mail</h2>
            <ConfirmarEmail
              key={emailPorConfirmar}
              email={emailPorConfirmar}
              codigoPedido={pedido?.email === emailPorConfirmar}
              falha={pedido?.email === emailPorConfirmar ? pedido.falha : null}
              onConfirmado={() => setAdiado(true)}
              onMudar={() => { setPedido(null); setMudar(true); }}
              onMaisTarde={() => setAdiado(true)}
            />
          </>
        ) : (
          <>
            <h2 id="pedir-email-titulo">Qual é o teu e-mail?</h2>
            <p className="sb2">
              Para te mandarmos a tua escala do mês quando sair, e avisos só teus — como um reembolso pago. Nada de
              mensagens para a equipa toda.
            </p>
            <p className="ds" style={{ marginTop: 8 }}>
              Só para isto — ninguém da equipa o vê. Podes mudar quando quiseres: toca na tua foto → E-mail para avisos.
            </p>
            <FormEmail
              inicial={mudar ? meu?.email ?? "" : ""}
              onCodigoPedido={(p) => { setPedido(p); setMudar(false); }}
              onFeito={() => { setMudar(false); setAdiado(true); }}
              onMaisTarde={() => setAdiado(true)}
            />
          </>
        )}
      </div>
    </>
  );
}
