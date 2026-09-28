import { useEffect, useState } from "react";
import {
  ativarNotificacoes, estadoPermissao, revalidarDispositivo, suportado,
} from "../lib/push.js";

const ADIADO = "onda.notificacoes.adiadoEm"; // "AAAA-MM-DD" do último "agora não"

/** "Hoje" em hora local — nunca toISOString (UTC: entre a meia-noite e
 *  a 1h, no verão, em Portugal ainda seria ontem). */
function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * "Liga os avisos no telemóvel" — cobre o ecrã inteiro até a pessoa
 * responder.
 *
 * Pedido do dono do produto (2026-09): o convite antigo era uma faixa
 * no topo do Início, com dois botões sem estilo, fácil de passar por
 * cima sem ler — e, dispensado uma vez, não voltava nunca mais. Agora
 * é um aviso que tapa tudo (o véu não fecha ao toque, como o do
 * e-mail): a pessoa tem de o ver e de escolher.
 *
 * ── Uma vez por dia, no máximo ──────────────────────────────────
 *
 * "Agora não" esconde até ao dia seguinte (`localStorage`, por
 * dispositivo). Todos os dias era o compromisso pedido: o suficiente
 * para ninguém se esquecer, sem ser a cada abertura da app. Some de vez
 * quando a pessoa ativa neste dispositivo. Quem recusou no diálogo do
 * sistema não volta a ver: a permissão "denied" só se repõe nas
 * definições do browser, e um botão aqui não a consegue pedir outra vez.
 *
 * ── No iPhone, instalar primeiro ────────────────────────────────
 *
 * O Safari só dá push a uma app instalada no ecrã principal; num
 * separador o botão nunca funcionaria. Nesse caso o aviso mostra os três
 * passos para instalar, em vez de um botão morto.
 *
 * ── Só a partir de um toque ─────────────────────────────────────
 *
 * O pedido de permissão do sistema só sai depois de "Ativar avisos" —
 * os browsers penalizam (e o Safari recusa) um pedido feito sozinho ao
 * abrir a página. O diálogo "Permitir / Não permitir" que aparece a
 * seguir é do próprio telemóvel; esse não se desenha.
 *
 * Fica por baixo do pop-up do e-mail (`PedirEmail`, z 80) e por cima do
 * tour (z 70): responde-se ao e-mail primeiro, depois a isto.
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
    let mostrar;
    if (!s.ok) {
      // "instalar-primeiro" é o único que vale a pena mostrar: os
      // outros dois são limitações do browser que a pessoa não pode
      // resolver, e um aviso que não leva a lado nenhum é ruído.
      mostrar = s.motivo === "instalar-primeiro" ? "instalar" : null;
    } else {
      const permissao = estadoPermissao();
      if (permissao === "granted") revalidarDispositivo();
      mostrar = permissao === "default" ? "pedir" : null;
    }
    if (!mostrar) { setEstado("nada"); return; }

    try {
      if (localStorage.getItem(ADIADO) === hojeLocal()) { setEstado("nada"); return; }
    } catch { /* navegação privada — mostra, é o mal menor */ }
    setEstado(mostrar);
  }, []);

  function adiar() {
    try { localStorage.setItem(ADIADO, hojeLocal()); } catch { /* sem localStorage, volta a aparecer */ }
    setEstado("nada");
  }

  async function ativar() {
    setAPedir(true);
    await ativarNotificacoes();
    setAPedir(false);
    // ativou: não volta a aparecer (permissão "granted"); recusou no
    // diálogo do sistema: também não ("denied"); fechou o diálogo sem
    // responder: amanhã pergunta outra vez
    adiar();
  }

  if (estado === null || estado === "nada") return null;

  return (
    <>
      <div className="veu on" style={{ zIndex: 78 }} />
      <div className="nt-modal" role="dialog" aria-modal="true" aria-labelledby="nt-titulo">
        <div className="nt-ic" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </div>

        {estado === "instalar" ? (
          <>
            <h2 id="nt-titulo" className="nt-t">Para receberes avisos no iPhone</h2>
            <p className="nt-d">O iPhone só manda avisos à app instalada no ecrã principal. São três toques:</p>
            <ol className="nt-passos">
              <li>
                <b className="nt-n">1</b>
                <span>Toca em <b>Partilhar</b> no Safari</span>
                <svg className="nt-passo-ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 11v9h14v-9" />
                </svg>
              </li>
              <li><b className="nt-n">2</b><span>Escolhe <b>Adicionar ao ecrã principal</b></span><span className="nt-passo-ic" aria-hidden>＋</span></li>
              <li><b className="nt-n">3</b><span>Abre a app pelo ícone novo e ativa aqui os avisos</span></li>
            </ol>
            <button className="btn full" style={{ marginTop: 18 }} onClick={adiar}>Percebi</button>
            <p className="nt-rodape">Volta a aparecer amanhã, até a app estar instalada.</p>
          </>
        ) : (
          <>
            <h2 id="nt-titulo" className="nt-t">Liga os avisos no telemóvel</h2>
            <p className="nt-d">Um toque e ficas a saber na hora — sem teres de abrir a app.</p>
            <ul className="nt-lista">
              <li><i aria-hidden>📅</i>Quando entras (ou sais) de uma escala</li>
              <li><i aria-hidden>💶</i>Quando o teu reembolso é pago</li>
              <li><i aria-hidden>📣</i>Quando o pastor manda um recado à tua base</li>
            </ul>
            <button className="btn full" style={{ marginTop: 18 }} disabled={aPedir} onClick={ativar}>
              {aPedir ? "A ativar…" : "Ativar avisos"}
            </button>
            <button className="nt-nao" disabled={aPedir} onClick={adiar}>Agora não</button>
            <p className="nt-rodape">Se disseres agora não, voltamos a perguntar amanhã.</p>
          </>
        )}
      </div>
    </>
  );
}
