import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { TorradaProvider } from "@portal/shared/lib/TorradaContext.jsx";
import { TourProvider, TourAutoStart } from "@portal/shared/lib/TourContext.jsx";
import Tour from "@portal/shared/components/Tour.jsx";
import NavBar from "@portal/shared/components/NavBar.jsx";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import AvisoInstalarPWA from "@portal/shared/components/AvisoInstalarPWA.jsx";
import AvisoNotificacoes from "@portal/shared/components/AvisoNotificacoes.jsx";
import Domingo from "./Domingo";
import Bases from "./Bases";
import Pessoas from "./Pessoas";
import Numeros from "./Numeros";
import Ordem from "./Ordem";
import Perfil from "./Perfil";

// ícones que não existem no ICO padrão do NavBar (packages/shared só
// conhece o menu de hoje da Apoio) — mesmo padrão de ICONE_ENQUETES/
// ICONE_WIKI nas outras bases.
const ICONE_DOMINGO = '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/><circle cx="12" cy="12" r="4.5"/>';
const ICONE_BASES = '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>';
const ICONE_PESSOAS = '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>';
const ICONE_NUMEROS = '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>';
const ICONE_ORDEM = '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>';

/**
 * As cinco abas do Painel Pastoral, e a pergunta a que cada uma
 * responde. Se uma coisa nova não couber numa destas cinco perguntas,
 * provavelmente não pertence a esta app — é a mesma vara de medir que
 * o Financeiro usa ("Início responde 'tenho algo para tratar?',
 * Relatórios responde 'quanto foi para quê'").
 *
 *   Domingo  — o que está a acontecer (ou vai acontecer) neste culto?
 *   Bases    — alguma base precisa de mim?
 *   Pessoas  — quem é a igreja, e quem está a ficar pelo caminho?
 *   Números  — está a melhorar ou a piorar?
 *   Ordem    — montar e publicar a ordem do culto.
 *
 * Perfil não é aba — entra-se tocando na foto, mesmo padrão do "Ver
 * perfil" do MenuEu das outras bases.
 */
const ABAS = [
  ["domingo", "Domingo", ICONE_DOMINGO],
  ["bases", "Bases", ICONE_BASES],
  ["pessoas", "Pessoas", ICONE_PESSOAS],
  ["numeros", "Números", ICONE_NUMEROS],
  ["ordem", "Ordem", ICONE_ORDEM],
];

/**
 * Casca da app depois de entrar — mesmo padrão de qualquer outra base
 * (cabeçalho + corpo + navegação), sem seletor de base: quem está na
 * equipa pastoral não serve noutra base ao mesmo tempo, é uma função à
 * parte (mesma decisão do Financeiro).
 */
export default function Sessao({ uid, baseId, podePublicarCulto, mostrarTourAoEntrar }) {
  const [pessoa, setPessoa] = useState(null);
  const [pagina, setPagina] = useState("domingo");
  const [cab, setCab] = useState({ titulo: "", subtitulo: "", chips: [] });
  // um ponto aceso no separador Domingo quando há culto a acontecer
  // agora — o NavBar não sabe o que é "culto ao vivo", quem chama é
  // que decide o que merece o ponto
  const [aoVivo, setAoVivo] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, `bases/${baseId}/pessoas/${uid}`), (s) => setPessoa(s.exists() ? s.data() : null));
  }, [uid, baseId]);

  function irPara(p) {
    setPagina(p);
    window.scrollTo({ top: 0 });
  }

  return (
    <TorradaProvider>
    <TourProvider>
      <TourAutoStart baseId={baseId} papel="lider_base" mostrarTourAoEntrar={mostrarTourAoEntrar} irPara={irPara} />
      <Tour />
      <div className="app">
        <AvisoOffline />
        <AvisoInstalarPWA />
        <AvisoNotificacoes />
        <div className="crista topo" style={{ paddingBottom: 0 }}>
          <div className="lin">
            <span className="logo">
              <i>igreja</i>
              <b>onda</b>
            </span>
            <div className="eu">
              <div style={{ textAlign: "right" }}>
                <b>{pessoa?.nome ?? "…"}</b>
                <p>Pastoral</p>
              </div>
              <span
                className="av"
                style={{
                  width: 40, height: 40, fontSize: 16, cursor: "pointer",
                  ...(pessoa?.foto ? { backgroundImage: `url(${pessoa.foto})` } : { background: pessoa?.cor || "#0F766E" }),
                }}
                onClick={() => irPara("perfil")}
              >
                {pessoa?.foto ? "" : pessoa?.nome?.[0]}
              </span>
            </div>
          </div>
          <h1 style={{ marginTop: 22 }}>{cab.titulo}</h1>
          {cab.subtitulo && <p className="sob">{cab.subtitulo}</p>}
          {cab.chips?.length > 0 && (
            <div className="chips">
              {cab.chips.map((c, i) => (
                <span className="chip" key={i}>{c}</span>
              ))}
            </div>
          )}
          <svg className="curva" viewBox="0 0 400 46" preserveAspectRatio="none">
            <path d="M0,46 C110,4 290,4 400,46 L400,46 L0,46 Z" fill="#fff" />
          </svg>
        </div>
        <div className="corpo">
          {/* as abas ficam sempre montadas (display:none no lugar de
              desmontar) — preserva filtros e posição de scroll ao
              trocar de aba, e evita repetir as chamadas caras dos
              agregadores a cada ida e volta. Cada página só recalcula
              o cabeçalho quando o prop `ativo` fica verdadeiro: sem
              esse gate, o efeito corria uma vez só no arranque e o
              título parava de seguir a navegação (bug já reportado no
              Financeiro, que tem a mesma casca). */}
          <div style={{ display: pagina === "domingo" ? "" : "none" }}>
            <Domingo
              ativo={pagina === "domingo"} definirCabecalho={setCab} onAoVivo={setAoVivo} irPara={irPara}
              podePublicarCulto={podePublicarCulto}
            />
          </div>
          <div style={{ display: pagina === "bases" ? "" : "none" }}>
            <Bases ativo={pagina === "bases"} definirCabecalho={setCab} />
          </div>
          <div style={{ display: pagina === "pessoas" ? "" : "none" }}>
            <Pessoas ativo={pagina === "pessoas"} definirCabecalho={setCab} />
          </div>
          <div style={{ display: pagina === "numeros" ? "" : "none" }}>
            <Numeros ativo={pagina === "numeros"} definirCabecalho={setCab} />
          </div>
          <div style={{ display: pagina === "ordem" ? "" : "none" }}>
            <Ordem ativo={pagina === "ordem"} definirCabecalho={setCab} podePublicarCulto={podePublicarCulto} />
          </div>
          {pagina === "perfil" && (
            <Perfil uid={uid} pessoa={pessoa} definirCabecalho={setCab} onAtualizarPessoa={setPessoa} />
          )}
          <p className="assinatura">
            Feito por <a href="https://instagram.com/geniai.pt" target="_blank" rel="noreferrer">@geniai.pt</a>
          </p>
        </div>
      </div>
      <NavBar pagina={pagina} onIr={irPara} itens={ABAS} alertas={aoVivo ? ["domingo"] : []} />
    </TourProvider>
    </TorradaProvider>
  );
}
