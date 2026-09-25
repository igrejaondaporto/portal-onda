import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { ouvirCultoAoVivoAtivo } from "@portal/shared/lib/cultoAoVivo.js";
import { ouvirMinisterios } from "../lib/painel";
import { TorradaProvider } from "@portal/shared/lib/TorradaContext.jsx";
import { TourProvider, TourAutoStart, useReverTour } from "@portal/shared/lib/TourContext.jsx";
import Tour from "@portal/shared/components/Tour.jsx";
import MenuEu from "@portal/shared/components/MenuEu.jsx";
import BarraVistaVoluntario from "@portal/shared/components/BarraVistaVoluntario.jsx";
import SheetEscolherVista from "@portal/shared/components/SheetEscolherVista.jsx";
import BotaoTrocarBase from "@portal/shared/components/BotaoTrocarBase.jsx";
import NavBar from "@portal/shared/components/NavBar.jsx";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import AvisoInstalarPWA from "@portal/shared/components/AvisoInstalarPWA.jsx";
import AvisoNotificacoes from "@portal/shared/components/AvisoNotificacoes.jsx";
import PedirEmail from "@portal/shared/components/PedirEmail.jsx";
import PainelLider from "./PainelLider";
import Inicio from "./Inicio";
import Escala from "./Escala";
import Culto from "./Culto";
import Equipamentos from "./Equipamentos";
import Reembolsos from "./Reembolsos";
import Wiki from "./Wiki";
import Montar from "./Montar";
import Perfil from "./Perfil";

// livro — não existe no ICO padrão do NavBar (packages/shared), que
// só conhece os ícones do menu de hoje da Apoio
const ICONE_WIKI = '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>';
// urna — enquete de disponibilidade e montagem da escala do mês
const ICONE_MONTAR = '<path d="M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6"/>';
// não há aba Funções na Técnica — a checklist vive só no Início,
// filtrada pelo ministério da pessoa naquele culto (ver Inicio.jsx).
//
// Também não há aba Chamadas: existiu, e saiu a pedido do líder
// (2026-09) — com seis botões em baixo o menu deixava de se ler, e
// chamar crianças para a projeção já tem app própria e sem login, o
// kinder.igrejaonda.pt, que é onde a equipa do Kinder está. O painel
// em si continua em packages/shared (PainelChamadas.jsx), a servir o
// Kinder; aqui só deixou de haver porta para ele.
const ABAS_BASE = [
  ["inicio", "Início"],
  ["escala", "Escala"],
  ["culto", "Culto"],
  ["inventario", "Equipamentos"],
  ["wiki", "Wiki", ICONE_WIKI],
];

/**
 * Casca da app depois de entrar: cabeçalho + corpo + navegação.
 * Cada página (Início, Escala, Painel) define o próprio cabeçalho via
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
  const [focoEscala, setFocoEscala] = useState(null);
  const [focoEscalaSeq, setFocoEscalaSeq] = useState(0);
  const [focoWiki, setFocoWiki] = useState(null);
  const [focoWikiSeq, setFocoWikiSeq] = useState(0);
  const [abaCulto, setAbaCulto] = useState("ordem");
  // ponto rosa no menu: o culto que estiver a gravar agora, seja qual
  // for a data — "Começou o culto" não olha para o dia
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

  /* ── Ver o painel como voluntário ──
   * O líder pediu para poder confirmar o que a equipa vê. Não é um
   * papel novo nem um login falso: o token continua a ser o dele (e o
   * servidor também o trata como líder) — o que muda é o papel que
   * desce para as telas, e com ele todos os botões que só o líder tem.
   * Na Técnica escolhe-se ainda o ministério, porque é ele que decide
   * a checklist do domingo: ver "o painel de um voluntário" sem dizer
   * de qual ministério mostrava justamente o caso menos útil. */
  const [vista, setVista] = useState(null);          // null = desligada
  const [aEscolherVista, setAEscolherVista] = useState(false);
  const [ministerios, setMinisterios] = useState([]);
  const souLiderMesmo = papel === "lider_base";
  useEffect(() => {
    if (!souLiderMesmo) return;
    return ouvirMinisterios(setMinisterios);
  }, [souLiderMesmo]);

  const papelEfetivo = vista ? "voluntario" : papel;
  const lider = papelEfetivo === "lider_base";
  const ABAS = lider ? [...ABAS_BASE, ["montar", "Montar", ICONE_MONTAR]] : ABAS_BASE;

  function entrarNaVista(ministerioId, nome) {
    setVista({ ministerioId, nome });
    setAEscolherVista(false);
    setPagina("inicio");                              // "Montar" deixa de existir
  }

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

  function irParaCulto(aba) {
    setAbaCulto(aba ?? "ordem");
    setPagina("culto");
    setMenuAberto(false);
  }

  function irParaWiki(wikiId) {
    setFocoWiki(wikiId ?? null);
    setFocoWikiSeq((s) => s + 1);
    setPagina("wiki");
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
        {/* "qual é o teu e-mail?" — trava o ecrã até responder (packages/shared) */}
        <PedirEmail />
        <div className="crista topo" style={{ paddingBottom: 0 }}>
          <div className="lin">
            {/* O logo leva ao Início. Antes só a barra de baixo o fazia,
              * e o canto superior esquerdo é onde a mão vai por hábito. */}
            <button className="logo tec-logo-botao" onClick={() => irPara("inicio")} aria-label="Ir para o Início">
              <i>igreja</i>
              <b>onda</b>
            </button>
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
              uid={uid} papel={papelEfetivo} pessoa={pessoa} mes={mes} ano={ano} mudarMes={mudarMes}
              ministerioVisto={vista?.ministerioId ?? null} vendoComoVoluntario={!!vista}
              ativo={pagina === "inicio"} definirCabecalho={setCab}
              onIrEscala={irParaEscala}
              onIrInventario={() => irPara("inventario")} onIrCulto={irParaCulto}
              onIrReembolsos={() => irPara("reembolsos")} onIrWiki={irParaWiki}
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
              onVerFuncoes={irParaEscala}
              podePublicarCulto={vista ? false : podePublicarCulto}
              aoVivoGravando={aoVivoGravando}
            />
          </div>
          <div style={{ display: pagina === "inventario" ? "" : "none" }}>
            <Equipamentos
              uid={uid} papel={papelEfetivo} ativo={pagina === "inventario"} definirCabecalho={setCab}
            />
          </div>
          <div style={{ display: pagina === "wiki" ? "" : "none" }}>
            <Wiki
              uid={uid} papel={papelEfetivo} pessoa={pessoa} ativo={pagina === "wiki"} definirCabecalho={setCab}
              wikiIdFoco={focoWiki} focoSeq={focoWikiSeq}
            />
          </div>
          {pagina === "reembolsos" && (
            <Reembolsos uid={uid} papel={papelEfetivo} definirCabecalho={setCab} />
          )}
          {pagina === "montar" && lider && (
            <Montar ativo={pagina === "montar"} definirCabecalho={setCab} />
          )}
          {pagina === "perfil" && (
            <Perfil
              uid={uid} papel={papelEfetivo} pessoa={pessoa} definirCabecalho={setCab}
              onAtualizarPessoa={setPessoa} onIrReembolsos={() => irPara("reembolsos")}
              onIrPainel={() => irPara("painel")} onVerFuncoes={irParaEscala}
            />
          )}
          {pagina === "painel" && (
            <PainelLider definirCabecalho={setCab} aoVoltar={() => irPara("inicio")} onIrWiki={irParaWiki} />
          )}
          <p className="assinatura">
            Feito por <a href="https://instagram.com/geniai.pt" target="_blank" rel="noreferrer">@geniai.pt</a>
          </p>
        </div>
      </div>
      <NavBar pagina={pagina} onIr={irPara} itens={ABAS} alertas={aoVivoGravando ? ["culto"] : []} />
      {vista && (
        <BarraVistaVoluntario etiqueta={vista.nome} onSair={() => setVista(null)} />
      )}
      {aEscolherVista && (
        <SheetEscolherVista
          ministerios={ministerios}
          onEscolher={entrarNaVista}
          onFechar={() => setAEscolherVista(false)}
        />
      )}
      {menuAberto && (
        <MenuComTour
          baseId={baseId} papel={papelEfetivo} irPara={irPara}
          pessoa={pessoa}
          baseIdAtual={baseId}
          basesDisponiveis={basesDisponiveis}
          onFechar={() => setMenuAberto(false)}
          onAbrirPainel={() => irPara("painel")}
          onVerComoVoluntario={() => setAEscolherVista(true)}
          onAbrirPerfil={() => irPara("perfil")}
        />
      )}
    </TourProvider>
    </TorradaProvider>
  );
}
