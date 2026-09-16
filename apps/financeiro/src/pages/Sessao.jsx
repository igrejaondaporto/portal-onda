import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { TorradaProvider } from "@portal/shared/lib/TorradaContext.jsx";
import { TourProvider, TourAutoStart } from "@portal/shared/lib/TourContext.jsx";
import Tour from "@portal/shared/components/Tour.jsx";
import NavBar from "@portal/shared/components/NavBar.jsx";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import AvisoInstalarPWA from "@portal/shared/components/AvisoInstalarPWA.jsx";
import PorPagar from "./PorPagar";
import Dinheiro from "./Dinheiro";
import Perfil from "./Perfil";

// Sem "Montar"/"Escala"/"Funções" — o Financeiro não gere voluntários
// de nenhuma base, só reembolsos já aprovados por elas. Duas abas
// bastam: a fila de trabalho e a leitura do dinheiro.
const ABAS = [
  ["porpagar", "Por pagar"],
  ["dinheiro", "Dinheiro"],
];

/**
 * Casca da app depois de entrar — mesmo padrão de qualquer outra base
 * (cabeçalho + corpo + navegação), sem seletor de base: quem trata do
 * Financeiro não serve noutra base ao mesmo tempo, é uma função à
 * parte (ver CLAUDE.md desta app).
 */
export default function Sessao({ uid, baseId, mostrarTourAoEntrar }) {
  const [pessoa, setPessoa] = useState(null);
  const [pagina, setPagina] = useState("porpagar");
  const [cab, setCab] = useState({ titulo: "", subtitulo: "", chips: [] });

  useEffect(() => {
    return onSnapshot(doc(db, `bases/${baseId}/pessoas/${uid}`), (s) => setPessoa(s.exists() ? s.data() : null));
  }, [uid, baseId]);

  function irPara(p) {
    setPagina(p);
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
          <div style={{ display: pagina === "porpagar" ? "" : "none" }}>
            <PorPagar definirCabecalho={setCab} />
          </div>
          <div style={{ display: pagina === "dinheiro" ? "" : "none" }}>
            <Dinheiro definirCabecalho={setCab} />
          </div>
          {pagina === "perfil" && (
            <Perfil uid={uid} pessoa={pessoa} definirCabecalho={setCab} onAtualizarPessoa={setPessoa} />
          )}
          <p className="assinatura">
            Feito por <a href="https://instagram.com/geniai.pt" target="_blank" rel="noreferrer">@geniai.pt</a>
          </p>
        </div>
      </div>
      <NavBar pagina={pagina} onIr={irPara} itens={[...ABAS, ["perfil", "Perfil"]]} alertas={[]} />
    </TourProvider>
    </TorradaProvider>
  );
}
