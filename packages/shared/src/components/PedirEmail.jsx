import { useEffect, useState } from "react";
import { ouvirMeuEmail, ouvirPedirEmailNoLogin } from "../lib/email.js";
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
 */
export default function PedirEmail() {
  const [ligado, setLigado] = useState(false);
  const [meu, setMeu] = useState(undefined); // undefined = a carregar

  useEffect(() => ouvirPedirEmailNoLogin(setLigado), []);
  useEffect(() => (ligado ? ouvirMeuEmail(setMeu) : undefined), [ligado]);

  if (!ligado || meu !== null) return null;

  return (
    <>
      <div className="veu on" style={{ zIndex: 80 }} />
      <div className="pin on" role="dialog" aria-modal="true" aria-labelledby="pedir-email-titulo" style={{ zIndex: 81 }}>
        <div className="pux" />
        <h2 id="pedir-email-titulo">Qual é o teu e-mail?</h2>
        <p className="sb2">
          Para te avisarmos quando fores escalado, quando o pastor mandar um recado à tua base, ou quando um
          reembolso for pago.
        </p>
        <p className="ds" style={{ marginTop: 8 }}>
          Só para isto — ninguém da equipa o vê. Podes mudar quando quiseres: toca na tua foto → E-mail para avisos.
        </p>
        <FormEmail />
      </div>
    </>
  );
}
