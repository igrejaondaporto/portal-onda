import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { TorradaProvider } from "@portal/shared/lib/TorradaContext.jsx";
import { TourProvider, TourAutoStart } from "@portal/shared/lib/TourContext.jsx";
import Tour from "@portal/shared/components/Tour.jsx";
import NavBar from "@portal/shared/components/NavBar.jsx";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import AvisoInstalarPWA from "@portal/shared/components/AvisoInstalarPWA.jsx";
import Inicio from "./Inicio";
import Reembolsos from "./Reembolsos";
import Oferta from "./Oferta";
import Relatorios from "./Relatorios";
import Perfil from "./Perfil";

// ícones que não existem no ICO padrão do NavBar (packages/shared,
// só conhece o menu de hoje da Apoio) — mesmo padrão de
// ICONE_ENQUETES/ICONE_WIKI nas outras bases.
const ICONE_INICIO = '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>';
const ICONE_REEMBOLSOS = '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>';
const ICONE_OFERTA = '<circle cx="9" cy="9" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7.5 7.5h1.5v3.5"/>';
const ICONE_RELATORIOS = '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>';

// Esta base faz duas coisas: paga os reembolsos que as outras bases
// aprovam, e conta a oferta do culto. Tudo o resto (caixa, entradas,
// fornecedores, património) foi tirado de propósito — ver CLAUDE.md
// desta app. Perfil não é aba: entra-se tocando na foto, mesmo padrão
// do "Ver perfil" do MenuEu nas outras bases.
const ABAS = [
  ["inicio", "Início", ICONE_INICIO],
  ["reembolsos", "Reembolsos", ICONE_REEMBOLSOS],
  ["oferta", "Oferta", ICONE_OFERTA],
  ["relatorios", "Relatórios", ICONE_RELATORIOS],
];

/**
 * Casca da app depois de entrar — mesmo padrão de qualquer outra base
 * (cabeçalho + corpo + navegação), sem seletor de base: quem trata do
 * Financeiro não serve noutra base ao mesmo tempo, é uma função à
 * parte (ver CLAUDE.md desta app).
 */
export default function Sessao({ uid, baseId, mostrarTourAoEntrar }) {
  const [pessoa, setPessoa] = useState(null);
  const [pagina, setPagina] = useState("inicio");
  const [cab, setCab] = useState({ titulo: "", subtitulo: "", chips: [] });

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
        <div className="crista topo" style={{ paddingBottom: 0 }}>
          <div className="lin">
            <span className="logo">
              <i>igreja</i>
              <b>onda</b>
            </span>
            <div className="eu">
              <div style={{ textAlign: "right" }}>
                <b>{pessoa?.nome ?? "…"}</b>
                <p>Financeiro</p>
              </div>
              <span
                className="av"
                style={{
                  width: 40, height: 40, fontSize: 16, cursor: "pointer",
                  ...(pessoa?.foto ? { backgroundImage: `url(${pessoa.foto})` } : { background: pessoa?.cor || "#0019BE" }),
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
          {/* as quatro abas ficam sempre montadas (display:none no
              lugar de desmontar) — preserva filtros e posição de
              scroll ao trocar de aba; cada página só recalcula o
              cabeçalho quando o prop `ativo` fica verdadeiro (ver
              Inicio.jsx). */}
          <div style={{ display: pagina === "inicio" ? "" : "none" }}>
            <Inicio ativo={pagina === "inicio"} irPara={irPara} definirCabecalho={setCab} />
          </div>
          <div style={{ display: pagina === "reembolsos" ? "" : "none" }}>
            <Reembolsos ativo={pagina === "reembolsos"} definirCabecalho={setCab} />
          </div>
          <div style={{ display: pagina === "oferta" ? "" : "none" }}>
            <Oferta uid={uid} ativo={pagina === "oferta"} definirCabecalho={setCab} />
          </div>
          <div style={{ display: pagina === "relatorios" ? "" : "none" }}>
            <Relatorios ativo={pagina === "relatorios"} definirCabecalho={setCab} />
          </div>
          {pagina === "perfil" && (
            <Perfil uid={uid} pessoa={pessoa} definirCabecalho={setCab} onAtualizarPessoa={setPessoa} />
          )}
          <p className="assinatura">
            Feito por <a href="https://instagram.com/geniai.pt" target="_blank" rel="noreferrer">@geniai.pt</a>
          </p>
        </div>
      </div>
      <NavBar pagina={pagina} onIr={irPara} itens={ABAS} alertas={[]} />
    </TourProvider>
    </TorradaProvider>
  );
}
