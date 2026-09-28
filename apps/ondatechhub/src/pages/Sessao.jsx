import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { TorradaProvider } from "@portal/shared/lib/TorradaContext.jsx";
import { TourProvider, TourAutoStart, useReverTour } from "@portal/shared/lib/TourContext.jsx";
import Tour from "@portal/shared/components/Tour.jsx";
import MenuEu from "@portal/shared/components/MenuEu.jsx";
import BotaoTrocarBase from "@portal/shared/components/BotaoTrocarBase.jsx";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import AvisoInstalarPWA from "@portal/shared/components/AvisoInstalarPWA.jsx";
import AvisoNotificacoes from "@portal/shared/components/AvisoNotificacoes.jsx";
import PedirEmail from "@portal/shared/components/PedirEmail.jsx";
import Relatos from "./Relatos";
import Perfil from "./Perfil";

/**
 * Casca da app depois de entrar — muito mais magra que a das outras
 * bases: o Onda Tech Hub não serve num domingo, não tem escala, não
 * tem NavBar de várias abas. Um ecrã só (Relatos) + Perfil, acedido
 * pelo menu — como em qualquer base, Perfil nunca é aba própria.
 */
function MenuComTour({ baseId, papel, irPara, ...props }) {
  const reverTour = useReverTour(baseId, papel, irPara);
  return <MenuEu {...props} papel={papel} onAbrirTour={reverTour} />;
}

export default function Sessao({ uid, papel, baseId, mostrarTourAoEntrar }) {
  const [pessoa, setPessoa] = useState(null);
  const [basesDisponiveis, setBasesDisponiveis] = useState([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const [pagina, setPagina] = useState("relatos");
  const [cab, setCab] = useState({ titulo: "", subtitulo: "", chips: [] });

  useEffect(() => {
    return onSnapshot(doc(db, `bases/${baseId}/pessoas/${uid}`), (s) => setPessoa(s.exists() ? s.data() : null));
  }, [uid, baseId]);

  // as 5 pessoas do Onda Tech Hub servem também noutra base (todas na
  // Técnica, hoje) — mesmo seletor de sempre, para trocarem sem sair.
  useEffect(() => {
    return onSnapshot(doc(db, `pessoas/${uid}`), async (s) => {
      const mapa = s.exists() ? s.data().bases || {} : {};
      const ids = Object.keys(mapa).filter((b) => mapa[b]);
      if (ids.length <= 1) { setBasesDisponiveis([]); return; }
      const comNome = await Promise.all(ids.map(async (id) => {
        const bs = await getDoc(doc(db, `bases/${id}`));
        return { id, nome: bs.exists() ? bs.data().nome : id };
      }));
      setBasesDisponiveis(comNome);
    });
  }, [uid]);

  function irPara(p) {
    setPagina(p);
    setMenuAberto(false);
  }

  return (
    <TorradaProvider>
    <TourProvider>
      <TourAutoStart baseId={baseId} papel={papel} mostrarTourAoEntrar={mostrarTourAoEntrar} irPara={irPara} />
      <Tour />
      <div className="app">
        <AvisoOffline />
        <AvisoInstalarPWA />
        <AvisoNotificacoes />
        <PedirEmail />
        <div className="crista topo" style={{ paddingBottom: 0 }}>
          <div className="lin">
            <button className="logo" onClick={() => irPara("relatos")} aria-label="Ir para os relatos">
              <i>igreja</i>
              <b>onda</b>
            </button>
            <div className="eu">
              <div style={{ textAlign: "right" }}>
                <b>{pessoa?.nome ?? "…"}</b>
                <p>Onda Tech Hub</p>
              </div>
              <BotaoTrocarBase baseIdAtual={baseId} basesDisponiveis={basesDisponiveis} />
              <span
                className="av"
                style={{
                  width: 40, height: 40, fontSize: 16, cursor: "pointer",
                  ...(pessoa?.foto ? { backgroundImage: `url(${pessoa.foto})` } : { background: pessoa?.cor || "#00C2A8" }),
                }}
                onClick={() => setMenuAberto(true)}
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
          <div style={{ display: pagina === "relatos" ? "" : "none" }}>
            <Relatos ativo={pagina === "relatos"} definirCabecalho={setCab} />
          </div>
          {pagina === "perfil" && (
            <Perfil uid={uid} papel={papel} pessoa={pessoa} definirCabecalho={setCab} onAtualizarPessoa={setPessoa} />
          )}
          <p className="assinatura">
            Feito por <a href="https://instagram.com/geniai.pt" target="_blank" rel="noreferrer">@geniai.pt</a>
          </p>
        </div>
      </div>
      {menuAberto && (
        <MenuComTour
          uid={uid} baseId={baseId} papel={papel} irPara={irPara}
          pessoa={pessoa}
          baseIdAtual={baseId}
          basesDisponiveis={basesDisponiveis}
          onFechar={() => setMenuAberto(false)}
          onAbrirPerfil={() => irPara("perfil")}
        />
      )}
    </TourProvider>
    </TorradaProvider>
  );
}
