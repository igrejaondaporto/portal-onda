import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { nomePapelBase } from "../lib/modelo";
import { ouvirCultoAoVivoAtivo } from "@portal/shared/lib/cultoAoVivo.js";
import { TorradaProvider } from "@portal/shared/lib/TorradaContext.jsx";
import { TourProvider, TourAutoStart, useReverTour } from "@portal/shared/lib/TourContext.jsx";
import Tour from "@portal/shared/components/Tour.jsx";
import MenuEu from "@portal/shared/components/MenuEu.jsx";
import BarraVistaVoluntario from "@portal/shared/components/BarraVistaVoluntario.jsx";
import BotaoTrocarBase from "@portal/shared/components/BotaoTrocarBase.jsx";
import NavBar from "@portal/shared/components/NavBar.jsx";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import AvisoInstalarPWA from "@portal/shared/components/AvisoInstalarPWA.jsx";
import AvisoNotificacoes from "@portal/shared/components/AvisoNotificacoes.jsx";
import EnqueteAutoStart from "../components/EnqueteAutoStart.jsx";
import ConfirmacaoAutoStart from "../components/ConfirmacaoAutoStart.jsx";
import PainelLider from "./PainelLider";
import Inicio from "./Inicio";
import Escala from "./Escala";
import Culto from "./Culto";
import Biblioteca from "./Biblioteca";
import Repertorio from "./Repertorio";
import Reembolsos from "./Reembolsos";
import Perfil from "./Perfil";

// biblioteca (estante) e repertório (lista) — não existem no ICO
// padrão do NavBar (ver packages/shared/components/NavBar.jsx). O
// repertório já foi uma nota musical — trocado por uma lista (2026-09,
// confundia com o atalho "+ repertório" da Biblioteca, que usa o
// mesmo desenho de lista).
const ICONE_BIBLIOTECA = '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>';
const ICONE_REPERTORIO = '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>';
const ABAS_BASE = [
  ["inicio", "Início"],
  ["escala", "Escala"],
  ["repertorio", "Repertório", ICONE_REPERTORIO],
  ["culto", "Culto"],
  ["biblioteca", "Biblioteca", ICONE_BIBLIOTECA],
];

/**
 * Casca da app depois de entrar: cabeçalho + corpo + navegação.
 * Cada página define o próprio cabeçalho via definirCabecalho.
 */
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
  const [abaCulto, setAbaCulto] = useState("ordem");
  // ponto rosa no menu: o culto que estiver a gravar agora, seja
  // qual for a data — só leitura aqui, quem inicia é a Técnica
  const [aoVivoGravando, setAoVivoGravando] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, `bases/${baseId}/pessoas/${uid}`), (s) => setPessoa(s.exists() ? s.data() : null));
  }, [uid, baseId]);

  useEffect(() => ouvirCultoAoVivoAtivo(setAoVivoGravando), []);

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

  /* ── Ver o painel como voluntário ──
   * Pedido do líder da Técnica, para todas as bases. O token continua
   * a ser o do líder (e o servidor também o trata assim) — muda o
   * papel que desce para as telas, e com ele os botões que só ele tem.
   * A saída fica na faixa: aqui dentro o menu do perfil é o de um
   * voluntário, que é o objetivo. Na Louvor o "auxiliar" também é
   * líder (ver modelo.js), e por isso também entra na vista. */
  const [vista, setVista] = useState(null);           // null = desligada
  const papelEfetivo = vista ? "voluntario" : papel;

  function irPara(p) {
    setPagina(p);
    setMenuAberto(false);
  }

  function irParaEscala(eventoId) {
    setFocoEscala(eventoId ?? null);
    setFocoEscalaSeq((s) => s + 1);
    setPagina("escala");
    setMenuAberto(false);
  }

  function mudarMes(delta) {
    setMes((atual) => {
      let novo = atual + delta;
      if (novo < 0) { novo = 11; setAno((a) => a - 1); }
      else if (novo > 11) { novo = 0; setAno((a) => a + 1); }
      return novo;
    });
  }

  function irParaCulto(aba) {
    setAbaCulto(aba ?? "ordem");
    setPagina("culto");
    setMenuAberto(false);
  }

  return (
    <TorradaProvider>
    <TourProvider>
      <TourAutoStart baseId={baseId} papel={papel} mostrarTourAoEntrar={mostrarTourAoEntrar} irPara={irPara} />
      <EnqueteAutoStart uid={uid} />
      <ConfirmacaoAutoStart uid={uid} />
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
                <p>{nomePapelBase(papel)}</p>
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
          <div style={{ display: pagina === "inicio" ? "" : "none" }}>
            <Inicio
              uid={uid} papel={papelEfetivo} pessoa={pessoa} mes={mes} ano={ano} mudarMes={mudarMes}
              ativo={pagina === "inicio"} definirCabecalho={setCab}
              onIrEscala={irParaEscala} onIrCulto={irParaCulto}
              onIrBiblioteca={() => irPara("biblioteca")}
              onIrReembolsos={() => irPara("reembolsos")}
            />
          </div>
          <div style={{ display: pagina === "escala" ? "" : "none" }}>
            <Escala
              uid={uid} papel={papelEfetivo} mes={mes} ano={ano} mudarMes={mudarMes}
              eventoIdFoco={focoEscala} focoSeq={focoEscalaSeq}
              ativo={pagina === "escala"} definirCabecalho={setCab}
            />
          </div>
          <div style={{ display: pagina === "culto" ? "" : "none" }}>
            <Culto
              uid={uid} papel={papelEfetivo} mes={mes} ano={ano} mudarMes={mudarMes} abaInicial={abaCulto}
              ativo={pagina === "culto"} definirCabecalho={setCab}
              podePublicarCulto={vista ? false : podePublicarCulto}
              aoVivoGravando={aoVivoGravando}
            />
          </div>
          <div style={{ display: pagina === "biblioteca" ? "" : "none" }}>
            <Biblioteca
              uid={uid} papel={papelEfetivo} ativo={pagina === "biblioteca"} definirCabecalho={setCab}
              onIrRepertorio={() => irPara("repertorio")}
            />
          </div>
          <div style={{ display: pagina === "repertorio" ? "" : "none" }}>
            <Repertorio
              uid={uid} papel={papelEfetivo} mes={mes} ano={ano} mudarMes={mudarMes}
              ativo={pagina === "repertorio"} definirCabecalho={setCab}
            />
          </div>
          {pagina === "reembolsos" && (
            <Reembolsos uid={uid} papel={papelEfetivo} definirCabecalho={setCab} />
          )}
          {pagina === "perfil" && (
            <Perfil
              uid={uid} papel={papelEfetivo} pessoa={pessoa} definirCabecalho={setCab}
              onAtualizarPessoa={setPessoa} onIrReembolsos={() => irPara("reembolsos")}
              onIrPainel={() => irPara("painel")}
            />
          )}
          {pagina === "painel" && (
            <PainelLider uid={uid} definirCabecalho={setCab} aoVoltar={() => irPara("inicio")} />
          )}
          <p className="assinatura">
            Feito por <a href="https://instagram.com/geniai.pt" target="_blank" rel="noreferrer">@geniai.pt</a>
          </p>
        </div>
      </div>
      <NavBar pagina={pagina} onIr={irPara} itens={ABAS_BASE} alertas={aoVivoGravando ? ["culto"] : []} />
      {vista && (
        <BarraVistaVoluntario onSair={() => setVista(null)} />
      )}
      {menuAberto && (
        <MenuComTour
          baseId={baseId} papel={papelEfetivo} irPara={irPara}
          pessoa={pessoa}
          baseIdAtual={baseId}
          basesDisponiveis={basesDisponiveis}
          onFechar={() => setMenuAberto(false)}
          onAbrirPainel={() => irPara("painel")}
          onVerComoVoluntario={() => { setVista({}); irPara("inicio"); }}
          onAbrirPerfil={() => irPara("perfil")}
        />
      )}
    </TourProvider>
    </TorradaProvider>
  );
}
