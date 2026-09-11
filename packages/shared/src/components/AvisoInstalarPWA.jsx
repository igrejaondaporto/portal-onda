import { useEffect, useRef, useState } from "react";

/**
 * Aviso para instalar a app (Add to Home Screen) — em qualquer base.
 *
 * O `beforeinstallprompt` nunca dispara no iOS, em nenhum browser
 * (Safari, Chrome, Firefox — todos usam o motor do Safari lá, e a
 * Apple não implementa essa API). Um banner que só reagisse a esse
 * evento nunca apareceria no iPhone/iPad, por isso o iOS é detetado
 * diretamente por user-agent e mostra instruções manuais em vez de
 * um botão — não há nada para disparar programaticamente lá.
 *
 * Duas variantes de texto no mesmo banner, sempre as duas no DOM,
 * alternadas só por `hidden` — nunca reescritas por JS — para
 * sobreviver a trocas de idioma/re-render sem repetir lógica de
 * texto em dois sítios.
 */
const CHAVE_DISPENSADO = "avisoPwaDispensado";

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

export default function AvisoInstalarPWA() {
  const [variante, setVariante] = useState(null); // null | "normal" | "ios"
  const deferredRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(CHAVE_DISPENSADO)) return;
    if (isStandalone()) return;

    // iOS nunca dispara beforeinstallprompt — mostra logo a variante
    // manual, sem esperar por um evento que não vem.
    if (isIOS()) {
      setVariante("ios");
      return;
    }

    function aoFicarInstalavel(e) {
      e.preventDefault();
      deferredRef.current = e;
      setVariante("normal");
    }
    function aoInstalar() {
      deferredRef.current = null;
      setVariante(null);
    }
    window.addEventListener("beforeinstallprompt", aoFicarInstalavel);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoFicarInstalavel);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  function dispensar() {
    localStorage.setItem(CHAVE_DISPENSADO, "1");
    setVariante(null);
  }

  async function instalar() {
    const evento = deferredRef.current;
    if (!evento) return;
    evento.prompt();
    await evento.userChoice;
    deferredRef.current = null;
    setVariante(null);
  }

  if (!variante) return null;

  return (
    <div className="pwa-aviso">
      <div hidden={variante !== "normal"}>
        <p className="nmt">Instala a app</p>
        <p className="ds">Acesso mais rápido, direto do ecrã principal, sem barra do browser.</p>
        <div className="pwa-aviso-bt">
          <button className="btn sec" onClick={dispensar}>Agora não</button>
          <button className="btn" onClick={instalar}>Instalar</button>
        </div>
      </div>
      <div hidden={variante !== "ios"}>
        <p className="nmt">Instala a app</p>
        <p className="ds">
          Toca em 📤 <b>Partilhar</b> dentro do Safari e depois em <b>"Adicionar ao ecrã principal"</b>.
        </p>
        <div className="pwa-aviso-bt">
          <button className="btn sec" onClick={dispensar}>Agora não</button>
        </div>
      </div>
    </div>
  );
}
