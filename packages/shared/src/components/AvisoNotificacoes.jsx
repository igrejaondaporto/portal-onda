import { useEffect, useState } from "react";
import {
  ativarNotificacoes, estadoPermissao, revalidarDispositivo, suportado,
} from "../lib/push.js";

const VISTO = "onda.notificacoes.dispensado";

/**
 * O convite para ligar as notificações, no topo do Início.
 *
 * Mesmo lugar e mesmo peso do `AvisoInstalarPWA` — é o mesmo tipo de
 * pedido (uma coisa do sistema que a app precisa de autorização para
 * fazer) e a equipa já sabe ler aquele formato.
 *
 * ── Três regras que o tornam suportável ─────────────────────────
 *
 * 1. **Só a partir de um toque.** Os browsers penalizam (e o Safari
 *    recusa) um pedido de permissão feito sozinho ao abrir a página.
 *    Este cartão existe precisamente para haver um toque antes do
 *    pedido — não é decoração à volta de um `requestPermission`
 *    automático.
 * 2. **Dispensável, e fica dispensado.** Quem não quer toca em "Agora
 *    não" e não volta a ver (`localStorage`). Um convite que reaparece
 *    a cada abertura é como um pedido de permissão automático: ensina
 *    a fechar sem ler.
 * 3. **No iPhone diz a verdade.** O Safari só dá push a uma app
 *    instalada no ecrã principal; num separador o botão nunca
 *    funcionaria. Nesse caso o cartão explica o que falta em vez de
 *    mostrar um botão morto.
 *
 * Revalida o token a cada arranque de quem já autorizou: o token do
 * FCM é renovado pelo browser sem avisar, e um token velho no
 * Firestore é uma notificação que nunca chega, sem erro nenhum a
 * assinalá-lo.
 */
export default function AvisoNotificacoes() {
  const [estado, setEstado] = useState(null);      // null = ainda a decidir
  const [aPedir, setAPedir] = useState(false);

  useEffect(() => {
    const s = suportado();
    if (!s.ok) {
      // "instalar-primeiro" é o único que vale a pena mostrar: os
      // outros dois são limitações do browser que a pessoa não pode
      // resolver, e um aviso que não leva a lado nenhum é ruído.
      setEstado(s.motivo === "instalar-primeiro" ? "instalar" : "nada");
      return;
    }
    const permissao = estadoPermissao();
    if (permissao === "granted") {
      setEstado("nada");
      revalidarDispositivo();
      return;
    }
    // "denied" não se mostra: a permissão só se repõe nas definições
    // do browser, e um botão aqui não a consegue pedir outra vez
    if (permissao !== "default") { setEstado("nada"); return; }

    try {
      if (localStorage.getItem(VISTO)) { setEstado("nada"); return; }
    } catch { /* navegação privada — mostra, é o mal menor */ }

    setEstado("pedir");
  }, []);

  function dispensar() {
    try { localStorage.setItem(VISTO, "1"); } catch { /* sem localStorage, volta a aparecer */ }
    setEstado("nada");
  }

  async function ativar() {
    setAPedir(true);
    const ok = await ativarNotificacoes();
    setAPedir(false);
    // recusar no diálogo do browser é uma resposta: não se insiste
    dispensar();
    if (!ok) return;
  }

  if (estado === null || estado === "nada") return null;

  if (estado === "instalar") {
    return (
      <div className="pwa-aviso">
        <span>
          Para receberes avisos no telemóvel, instala primeiro a app: Partilhar → Adicionar ao ecrã principal.
        </span>
        <button className="pwa-aviso-bt" onClick={dispensar}>Ok</button>
      </div>
    );
  }

  return (
    <div className="pwa-aviso">
      <span>Queres ser avisado quando entrares numa escala ou o teu reembolso for pago?</span>
      <button className="pwa-aviso-bt" disabled={aPedir} onClick={ativar}>
        {aPedir ? "…" : "Ativar"}
      </button>
      <button className="pwa-aviso-bt" onClick={dispensar}>Agora não</button>
    </div>
  );
}
