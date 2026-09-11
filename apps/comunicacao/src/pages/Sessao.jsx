import { useEffect, useState } from "react";
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
import PainelLider from "./PainelLider";
import Inicio from "./Inicio";
import Funcoes from "./Funcoes";
import Culto from "./Culto";
import Wiki from "./Wiki";
import Solicitacoes from "./Solicitacoes";
import Brand from "./Brand";
import Reembolsos from "./Reembolsos";
import Perfil from "./Perfil";

// ícones que não existem no ICO padrão do NavBar (packages/shared)
const ICONE_WIKI = '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>';
const ICONE_BRAND = '<circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="12" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="13.5" cy="17.5" r="2.5"/>';
const ICONE_SOLICITACOES = '<rect x="5" y="4" width="14" height="18" rx="2.5"/><path d="M9 2h6v4H9z"/><path d="M8 10.5h8M8 14.5h8M8 18.5h5"/>';

// Pedido do líder — Solicitações ganhou acesso direto no menu (era
// sub-aba dentro de Agenda); "Domingo" mudou-se para dentro de Culto,
// como a sub-aba "Escala" (ver Culto.jsx), por isso Agenda deixou de
// existir como aba própria.
const ABAS = [
  ["inicio", "Início"],
  ["culto", "Culto"],
  ["funcoes", "Funções"],
  ["wiki", "Wiki", ICONE_WIKI],
  ["solicitacoes", "Solicitações", ICONE_SOLICITACOES],
  ["brand", "Brand", ICONE_BRAND],
];

/**
 * Casca da app depois de entrar: cabeçalho + corpo + navegação.
 * Cada página (Início, Culto, Painel) define o próprio cabeçalho via
 * definirCabecalho — o mesmo padrão do cabeca() do protótipo, só que
 * como estado em vez de mexer direto no DOM.
 */
/** Ponte pequena e local: MenuEu precisa de "Rever tour", mas
 *  `useReverTour` só funciona dentro de `TourProvider` — e é o
 *  próprio `Sessao` que o instancia, por isso não pode chamar o hook
 *  no corpo dele. */
function MenuComTour({ baseId, papel, irPara, ...props }) {
  const reverTour = useReverTour(baseId, papel, irPara);
  return <MenuEu {...props} papel={papel} onAbrirTour={reverTour} />;
}

export default function Sessao({ uid, papel, baseId, podePublicarCulto, mostrarTourAoEntrar }) {
  const [pessoa, setPessoa] = useState(null);
  const [basesDisponiveis, setBasesDisponiveis] = useState([]); // outras bases em que a pessoa serve
  const [menuAberto, setMenuAberto] = useState(false);
  const [pagina, setPagina] = useState("inicio");
  const [cab, setCab] = useState({ titulo: "", subtitulo: "", chips: [] });
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [focoEvento, setFocoEvento] = useState(null);
  const [focoSeq, setFocoSeq] = useState(0);
  const [focoEscala, setFocoEscala] = useState(null);
  const [focoEscalaSeq, setFocoEscalaSeq] = useState(0);
  const [abaCulto, setAbaCulto] = useState("escala");
  // ponto rosa no menu: o culto que estiver a gravar agora, seja
  // qual for a data — só leitura aqui, quem inicia é sempre a Técnica
  const [aoVivoGravando, setAoVivoGravando] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, `bases/${baseId}/pessoas/${uid}`), (s) => setPessoa(s.exists() ? s.data() : null));
  }, [uid, baseId]);

  useEffect(() => ouvirCultoAoVivoAtivo(setAoVivoGravando), []);

  // se a pessoa servir em mais do que uma base, o menu ganha um seletor —
  // só o nome de cada base é lido (bases/{id} é público a quem tem sessão,
  // ver firestore.rules), nunca os dados internos das outras bases.
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

  const lider = papel === "lider_base";

  function irPara(p) {
    setPagina(p);
    setMenuAberto(false);
    if (p === "funcoes") { setFocoEvento(null); setFocoSeq((s) => s + 1); }
  }

  // dezembro › janeiro (e o inverso) passam para o ano seguinte/anterior —
  // sem isto, os cultos gerados para o ano que vem (Painel do líder →
  // Definições → "Gerar domingos") nunca apareciam em lado nenhum.
  function mudarMes(delta) {
    setMes((atual) => {
      let novo = atual + delta;
      if (novo < 0) { novo = 11; setAno((a) => a - 1); }
      else if (novo > 11) { novo = 0; setAno((a) => a + 1); }
      return novo;
    });
  }

  function irParaFuncoes(eventoId) {
    setFocoEvento(eventoId ?? null);
    setFocoSeq((s) => s + 1);
    setPagina("funcoes");
    setMenuAberto(false);
  }

  // Escala (sub-aba de Culto) e "Ordem do domingo" (Início → A base)
  // partilham a mesma navegação — só muda a aba de destino e se vem
  // com um culto para focar (clique no calendário do Início).
  function irParaCulto(aba, eventoId) {
    setAbaCulto(aba ?? "escala");
    setFocoEscala(eventoId ?? null);
    setFocoEscalaSeq((s) => s + 1);
    setPagina("culto");
    setMenuAberto(false);
  }

  function irParaSolicitacoes() {
    irPara("solicitacoes");
  }

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
            <span className="logo">
              <i>igreja</i>
              <b>onda</b>
            </span>
            <div className="eu">
              <div style={{ textAlign: "right" }}>
                <b>{pessoa?.nome ?? "…"}</b>
                <p>{lider ? "Líder da base" : "Voluntário"}</p>
              </div>
              <BotaoTrocarBase baseIdAtual={baseId} basesDisponiveis={basesDisponiveis} />
              <span
                className="av"
                style={{
                  width: 40, height: 40, fontSize: 16, cursor: "pointer",
                  ...(pessoa?.foto ? { backgroundImage: `url(${pessoa.foto})` } : { background: pessoa?.cor || "#001ED1" }),
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
              uid={uid} papel={papel} pessoa={pessoa} mes={mes} ano={ano} mudarMes={mudarMes}
              ativo={pagina === "inicio"} definirCabecalho={setCab}
              onIrEscala={(eventoId) => irParaCulto("escala", eventoId)}
              onIrCulto={irParaCulto}
              onIrReembolsos={() => irPara("reembolsos")}
              onIrSolicitacoes={irParaSolicitacoes}
            />
          </div>
          <div style={{ display: pagina === "funcoes" ? "" : "none" }}>
            <Funcoes
              uid={uid} papel={papel} eventoIdFoco={focoEvento} focoSeq={focoSeq}
              ativo={pagina === "funcoes"} definirCabecalho={setCab}
            />
          </div>
          <div style={{ display: pagina === "wiki" ? "" : "none" }}>
            <Wiki ativo={pagina === "wiki"} definirCabecalho={setCab} />
          </div>
          <div style={{ display: pagina === "solicitacoes" ? "" : "none" }}>
            <Solicitacoes uid={uid} papel={papel} ativo={pagina === "solicitacoes"} definirCabecalho={setCab} />
          </div>
          <div style={{ display: pagina === "brand" ? "" : "none" }}>
            <Brand papel={papel} ativo={pagina === "brand"} definirCabecalho={setCab} />
          </div>
          <div style={{ display: pagina === "culto" ? "" : "none" }}>
            <Culto
              uid={uid} papel={papel} mes={mes} ano={ano} mudarMes={mudarMes} abaAlvo={abaCulto}
              eventoIdFoco={focoEscala} focoSeq={focoEscalaSeq}
              ativo={pagina === "culto"} definirCabecalho={setCab}
              onVerFuncoes={irParaFuncoes}
              podePublicarCulto={podePublicarCulto}
              aoVivoGravando={aoVivoGravando}
            />
          </div>
          {pagina === "reembolsos" && (
            <Reembolsos uid={uid} papel={papel} definirCabecalho={setCab} />
          )}
          {pagina === "perfil" && (
            <Perfil
              uid={uid} papel={papel} pessoa={pessoa} definirCabecalho={setCab}
              onAtualizarPessoa={setPessoa} onIrReembolsos={() => irPara("reembolsos")}
              onIrPainel={() => irPara("painel")} onVerFuncoes={irParaFuncoes}
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
      <NavBar pagina={pagina} onIr={irPara} itens={ABAS} alertas={aoVivoGravando ? ["culto"] : []} />
      {menuAberto && (
        <MenuComTour
          baseId={baseId} papel={papel} irPara={irPara}
          pessoa={pessoa}
          baseIdAtual={baseId}
          basesDisponiveis={basesDisponiveis}
          onFechar={() => setMenuAberto(false)}
          onAbrirPainel={() => irPara("painel")}
          onAbrirPerfil={() => irPara("perfil")}
        />
      )}
    </TourProvider>
    </TorradaProvider>
  );
}
