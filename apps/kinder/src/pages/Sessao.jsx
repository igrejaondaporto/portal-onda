import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { ouvirCultoAoVivoAtivo } from "@portal/shared/lib/cultoAoVivo.js";
import { TorradaProvider } from "@portal/shared/lib/TorradaContext.jsx";
import { TourProvider, TourAutoStart, useReverTour } from "@portal/shared/lib/TourContext.jsx";
import Tour from "@portal/shared/components/Tour.jsx";
import MenuEu from "@portal/shared/components/MenuEu.jsx";
import BotaoTrocarBase from "@portal/shared/components/BotaoTrocarBase.jsx";
import NavBar from "@portal/shared/components/NavBar.jsx";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import AvisoInstalarPWA from "@portal/shared/components/AvisoInstalarPWA.jsx";
import { rotuloPapel, souLider, CHECKIN_ATIVO } from "../lib/modelo";
import { ouvirLicoes, licoesDaSala, licoesVistas } from "../lib/licoes";
import PainelLider from "./PainelLider";
import Inicio from "./Inicio";
import Escala from "./Escala";
import Checkin from "./Checkin";
import Licao from "./Licao";
import Culto from "./Culto";
import Inventario from "./Inventario";
import Chamadas from "./Chamadas";
import Reembolsos from "./Reembolsos";
import Perfil from "./Perfil";

// ícone "user-check" da lucide, em SVG cru como os do NavBar partilhado
const ICONE_CHECKIN = '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>';
// ícone "megaphone" da lucide — Chamadas (chamar os pais pelo telão)
const ICONE_CHAMADAS = '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>';

// O resto (Compras, Ordem do culto, Feedbacks…) vive em sub-abas do
// Culto, para a barra caber num polegar; Chamadas ganhou menu próprio
// — fica sempre por último, depois de Culto.
const ABAS = [
  ["inicio", "Início"],
  ["escala", "Escala"],
  ...(CHECKIN_ATIVO ? [["checkin", "Check-in", ICONE_CHECKIN]] : []),
  ["licao", "Lição"],
  ["culto", "Culto"],
  ["inventario", "Inventário"],
  ["chamadas", "Chamadas", ICONE_CHAMADAS],
];

/** Ponte pequena: MenuEu precisa de "Rever tour", mas `useReverTour`
 *  só funciona dentro de `TourProvider` (ver a mesma nota na New). */
function MenuComTour({ baseId, papel, irPara, ...props }) {
  const reverTour = useReverTour(baseId, papel, irPara);
  return <MenuEu {...props} papel={papel} onAbrirTour={reverTour} />;
}

export default function Sessao({ uid, papel, baseId, podePublicarCulto, mostrarTourAoEntrar }) {
  const [pessoa, setPessoa] = useState(null);
  const [basesDisponiveis, setBasesDisponiveis] = useState([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const [pagina, setPagina] = useState("inicio");
  const [cab, setCab] = useState({ titulo: "", subtitulo: "", chips: [] });
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [focoEscala, setFocoEscala] = useState(null);
  const [focoEscalaSeq, setFocoEscalaSeq] = useState(0);
  const [abaCulto, setAbaCulto] = useState("checklist");
  const [abaLicao, setAbaLicao] = useState("licoes");
  const [aoVivoGravando, setAoVivoGravando] = useState(false);
  const [licoes, setLicoes] = useState([]);
  const [vistasSeq, setVistasSeq] = useState(0); // muda quando alguém abre uma lição

  useEffect(() => onSnapshot(doc(db, `bases/${baseId}/pessoas/${uid}`), (s) => setPessoa(s.exists() ? s.data() : null)), [uid, baseId]);
  useEffect(() => ouvirCultoAoVivoAtivo(setAoVivoGravando), []);
  useEffect(() => ouvirLicoes(setLicoes), []);

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

  const lider = souLider(papel);
  // ponto no separador "Lição": há uma lição da minha sala que ainda
  // não abri neste aparelho (as líderes veem as das três salas)
  const licaoNova = useMemo(() => {
    const vistas = licoesVistas(uid);
    return licoesDaSala(licoes, lider ? null : pessoa?.categoria).some((l) => !vistas.has(l.id));
    // vistasSeq: reavaliar depois de abrir uma lição
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licoes, pessoa?.categoria, lider, uid, vistasSeq]);

  function irPara(p) {
    setPagina(p);
    setMenuAberto(false);
  }
  function irParaEscala(eventoId) {
    setFocoEscala(eventoId ?? null);
    setFocoEscalaSeq((s) => s + 1);
    irPara("escala");
  }
  function irParaCulto(aba) {
    setAbaCulto(aba ?? "checklist");
    irPara("culto");
  }
  function irParaLicao(aba) {
    setAbaLicao(aba ?? "licoes");
    irPara("licao");
  }
  function mudarMes(delta) {
    setMes((atual) => {
      let novo = atual + delta;
      if (novo < 0) { novo = 11; setAno((a) => a - 1); }
      else if (novo > 11) { novo = 0; setAno((a) => a + 1); }
      return novo;
    });
  }

  const comum = { uid, papel, pessoa, definirCabecalho: setCab };

  return (
    <TorradaProvider>
    <TourProvider>
      <TourAutoStart baseId={baseId} papel={papel} mostrarTourAoEntrar={mostrarTourAoEntrar} irPara={irPara} />
      <Tour />
      <div className="app">
        <AvisoOffline />
        <AvisoInstalarPWA />
        <div className="crista topo" style={{ paddingBottom: 0 }}>
          <div className="lin">
            <button className="logo kin-logo-botao" onClick={() => irPara("inicio")} aria-label="Ir para o Início">
              <i>igreja</i>
              <b>onda</b>
            </button>
            <div className="eu">
              <div style={{ textAlign: "right" }}>
                <b>{pessoa?.nome ?? "…"}</b>
                <p>{rotuloPapel(papel, pessoa?.categoria)}</p>
              </div>
              <BotaoTrocarBase baseIdAtual={baseId} basesDisponiveis={basesDisponiveis} />
              <span
                className="av"
                style={{
                  width: 40, height: 40, fontSize: 16, cursor: "pointer",
                  ...(pessoa?.foto ? { backgroundImage: `url(${pessoa.foto})` } : { background: pessoa?.cor || "#0019BE" }),
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
              {cab.chips.map((c, i) => <span className="chip" key={i}>{c}</span>)}
            </div>
          )}
          <svg className="curva" viewBox="0 0 400 46" preserveAspectRatio="none">
            <path d="M0,46 C110,4 290,4 400,46 L400,46 L0,46 Z" fill="#fff" />
          </svg>
        </div>
        <div className="corpo">
          <div style={{ display: pagina === "inicio" ? "" : "none" }}>
            <Inicio
              {...comum} mes={mes} ano={ano} mudarMes={mudarMes} ativo={pagina === "inicio"} licoes={licoes}
              onIrEscala={irParaEscala} onIrCheckin={() => irPara("checkin")} onIrCulto={irParaCulto}
              onIrInventario={() => irPara("inventario")}
              onIrLicao={irParaLicao} onIrReembolsos={() => irPara("reembolsos")}
            />
          </div>
          <div style={{ display: pagina === "escala" ? "" : "none" }}>
            <Escala
              {...comum} mes={mes} ano={ano} mudarMes={mudarMes} ativo={pagina === "escala"}
              eventoIdFoco={focoEscala} focoSeq={focoEscalaSeq}
            />
          </div>
          <div style={{ display: pagina === "checkin" ? "" : "none" }}>
            <Checkin {...comum} ativo={pagina === "checkin"} />
          </div>
          <div style={{ display: pagina === "licao" ? "" : "none" }}>
            <Licao
              {...comum} mes={mes} ano={ano} mudarMes={mudarMes} ativo={pagina === "licao"} licoes={licoes} abaInicial={abaLicao}
              onLicaoVista={() => setVistasSeq((s) => s + 1)}
            />
          </div>
          <div style={{ display: pagina === "culto" ? "" : "none" }}>
            <Culto
              {...comum} mes={mes} ano={ano} abaInicial={abaCulto} ativo={pagina === "culto"}
              podePublicarCulto={podePublicarCulto} aoVivoGravando={aoVivoGravando}
            />
          </div>
          <div style={{ display: pagina === "inventario" ? "" : "none" }}>
            <Inventario
              {...comum} ativo={pagina === "inventario"} onIrReembolsos={() => irPara("reembolsos")}
            />
          </div>
          <div style={{ display: pagina === "chamadas" ? "" : "none" }}>
            <Chamadas papel={papel} pessoa={pessoa} ativo={pagina === "chamadas"} definirCabecalho={setCab} />
          </div>
          {pagina === "reembolsos" && <Reembolsos uid={uid} papel={papel} definirCabecalho={setCab} />}
          {pagina === "perfil" && (
            <Perfil
              {...comum} onAtualizarPessoa={setPessoa}
              onIrReembolsos={() => irPara("reembolsos")} onIrPainel={() => irPara("painel")}
              onIrCapacitacoes={() => irParaLicao("capacitacoes")}
            />
          )}
          {pagina === "painel" && <PainelLider papel={papel} pessoa={pessoa} definirCabecalho={setCab} aoVoltar={() => irPara("inicio")} />}
          <p className="assinatura">
            Feito por <a href="https://instagram.com/geniai.pt" target="_blank" rel="noreferrer">@geniai.pt</a>
          </p>
        </div>
      </div>
      <NavBar
        pagina={pagina} onIr={irPara} itens={ABAS}
        alertas={[...(aoVivoGravando ? ["culto"] : []), ...(licaoNova ? ["licao"] : [])]}
      />
      {menuAberto && (
        <MenuComTour
          baseId={baseId} papel={papel} irPara={irPara}
          pessoa={pessoa} baseIdAtual={baseId} basesDisponiveis={basesDisponiveis}
          onFechar={() => setMenuAberto(false)}
          onAbrirPainel={() => irPara("painel")}
          onAbrirPerfil={() => irPara("perfil")}
        />
      )}
    </TourProvider>
    </TorradaProvider>
  );
}
