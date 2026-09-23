import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
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
import PainelLider from "./PainelLider";
import Inicio from "./Inicio";
import Escala from "./Escala";
import Funcoes from "./Funcoes";
import Culto from "./Culto";
import Inventario from "./Inventario";
import Reembolsos from "./Reembolsos";
import Montar from "./Montar";
import Perfil from "./Perfil";

// urna — enquete de disponibilidade e montagem da escala do mês
const ICONE_MONTAR = '<path d="M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6"/>';
const ABAS_BASE = [
  ["inicio", "Início"],
  ["escala", "Escala"],
  ["funcoes", "Funções"],
  ["culto", "Culto"],
  ["inventario", "Inventário"],
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
  const [focoEvento, setFocoEvento] = useState(null);
  const [focoSeq, setFocoSeq] = useState(0);
  const [focoEscala, setFocoEscala] = useState(null);
  const [focoEscalaSeq, setFocoEscalaSeq] = useState(0);
  const [abaCulto, setAbaCulto] = useState("ordem");
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

  /* ── Ver o painel como voluntário ──
   * Pedido do líder da Técnica, para todas as bases: poder confirmar
   * o que a equipa vê. Não é papel novo nem login falso — o token
   * continua a ser o dele, e o servidor também o trata como líder. O
   * que muda é o papel que desce para as telas, e com ele todos os
   * botões que só o líder tem. A saída fica na faixa, sempre à vista,
   * porque aqui dentro o menu do perfil passa a ser o de um
   * voluntário (é esse o objetivo). */
  const [vista, setVista] = useState(null);           // null = desligada
  const papelEfetivo = vista ? "voluntario" : papel;
  const lider = papelEfetivo === "lider_base";
  const ABAS = lider ? [...ABAS_BASE, ["montar", "Montar", ICONE_MONTAR]] : ABAS_BASE;

  function irPara(p) {
    setPagina(p);
    setMenuAberto(false);
    if (p === "funcoes") { setFocoEvento(null); setFocoSeq((s) => s + 1); }
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

  function irParaFuncoes(eventoId) {
    setFocoEvento(eventoId ?? null);
    setFocoSeq((s) => s + 1);
    setPagina("funcoes");
    setMenuAberto(false);
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
                <p>{lider ? "Líder da base" : "Voluntário"}</p>
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
              onIrEscala={irParaEscala}
              onIrInventario={() => irPara("inventario")} onIrCulto={irParaCulto}
              onIrReembolsos={() => irPara("reembolsos")}
            />
          </div>
          <div style={{ display: pagina === "escala" ? "" : "none" }}>
            <Escala
              uid={uid} mes={mes} ano={ano} mudarMes={mudarMes}
              eventoIdFoco={focoEscala} focoSeq={focoEscalaSeq}
              ativo={pagina === "escala"} definirCabecalho={setCab}
              onVerFuncoes={irParaFuncoes}
            />
          </div>
          <div style={{ display: pagina === "funcoes" ? "" : "none" }}>
            <Funcoes
              uid={uid} papel={papelEfetivo} eventoIdFoco={focoEvento} focoSeq={focoSeq}
              ativo={pagina === "funcoes"} definirCabecalho={setCab}
            />
          </div>
          <div style={{ display: pagina === "culto" ? "" : "none" }}>
            <Culto
              uid={uid} papel={papelEfetivo} mes={mes} ano={ano} abaInicial={abaCulto}
              ativo={pagina === "culto"} definirCabecalho={setCab}
              onVerFuncoes={irParaFuncoes}
              podePublicarCulto={vista ? false : podePublicarCulto}
              aoVivoGravando={aoVivoGravando}
            />
          </div>
          <div style={{ display: pagina === "inventario" ? "" : "none" }}>
            <Inventario
              uid={uid} papel={papelEfetivo} ativo={pagina === "inventario"} definirCabecalho={setCab}
              onIrReembolsos={() => irPara("reembolsos")}
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
              onIrPainel={() => irPara("painel")} onVerFuncoes={irParaFuncoes}
            />
          )}
          {pagina === "painel" && (
            <PainelLider definirCabecalho={setCab} aoVoltar={() => irPara("inicio")} />
          )}
          <p className="assinatura">
            Feito por <a href="https://instagram.com/geniai.pt" target="_blank" rel="noreferrer">@geniai.pt</a>
          </p>
        </div>
      </div>
      <NavBar pagina={pagina} onIr={irPara} itens={ABAS} alertas={aoVivoGravando ? ["culto"] : []} />
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
