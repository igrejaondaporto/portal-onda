import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { TorradaProvider } from "../lib/TorradaContext";
import MenuEu from "../components/MenuEu";
import NavBar from "../components/NavBar";
import PainelLider from "./PainelLider";
import Inicio from "./Inicio";
import Escala from "./Escala";
import Funcoes from "./Funcoes";
import Culto from "./Culto";
import Inventario from "./Inventario";
import Reembolsos from "./Reembolsos";
import Perfil from "./Perfil";

/**
 * Casca da app depois de entrar: cabeçalho + corpo + navegação.
 * Cada página (Início, Escala, Painel) define o próprio cabeçalho via
 * definirCabecalho — o mesmo padrão do cabeca() do protótipo, só que
 * como estado em vez de mexer direto no DOM.
 */
export default function Sessao({ uid, papel, baseId }) {
  const [pessoa, setPessoa] = useState(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [pagina, setPagina] = useState("inicio");
  const [cab, setCab] = useState({ titulo: "", subtitulo: "", chips: [] });
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano] = useState(hoje.getFullYear());
  const [focoEvento, setFocoEvento] = useState(null);
  const [focoSeq, setFocoSeq] = useState(0);
  const [focoEscala, setFocoEscala] = useState(null);
  const [focoEscalaSeq, setFocoEscalaSeq] = useState(0);
  const [abaCulto, setAbaCulto] = useState("ordem");

  useEffect(() => {
    getDoc(doc(db, `bases/${baseId}/pessoas/${uid}`)).then((s) => setPessoa(s.exists() ? s.data() : null));
  }, [uid, baseId]);

  const lider = papel === "lider_base";

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
      <div className="app">
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
              uid={uid} papel={papel} pessoa={pessoa} mes={mes} ano={ano} definirMes={setMes}
              ativo={pagina === "inicio"} definirCabecalho={setCab}
              onIrEscala={irParaEscala} onVerFuncoes={irParaFuncoes}
              onIrInventario={() => irPara("inventario")} onIrCulto={irParaCulto}
              onIrReembolsos={() => irPara("reembolsos")}
            />
          </div>
          <div style={{ display: pagina === "escala" ? "" : "none" }}>
            <Escala
              uid={uid} mes={mes} ano={ano} definirMes={setMes}
              eventoIdFoco={focoEscala} focoSeq={focoEscalaSeq}
              ativo={pagina === "escala"} definirCabecalho={setCab}
              onVerFuncoes={irParaFuncoes}
            />
          </div>
          <div style={{ display: pagina === "funcoes" ? "" : "none" }}>
            <Funcoes
              uid={uid} papel={papel} eventoIdFoco={focoEvento} focoSeq={focoSeq}
              ativo={pagina === "funcoes"} definirCabecalho={setCab}
            />
          </div>
          <div style={{ display: pagina === "culto" ? "" : "none" }}>
            <Culto
              uid={uid} papel={papel} mes={mes} ano={ano} abaInicial={abaCulto}
              ativo={pagina === "culto"} definirCabecalho={setCab}
              onVerFuncoes={irParaFuncoes}
            />
          </div>
          <div style={{ display: pagina === "inventario" ? "" : "none" }}>
            <Inventario
              uid={uid} papel={papel} ativo={pagina === "inventario"} definirCabecalho={setCab}
              onIrReembolsos={() => irPara("reembolsos")}
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
            <PainelLider baseId={baseId} definirCabecalho={setCab} aoVoltar={() => irPara("inicio")} />
          )}
          <p className="assinatura">
            Feito por <a href="https://instagram.com/geniai.pt" target="_blank" rel="noreferrer">@geniai.pt</a>
          </p>
        </div>
      </div>
      <NavBar pagina={pagina} onIr={irPara} />
      {menuAberto && (
        <MenuEu
          pessoa={pessoa}
          papel={papel}
          onFechar={() => setMenuAberto(false)}
          onAbrirPainel={() => irPara("painel")}
          onAbrirPerfil={() => irPara("perfil")}
        />
      )}
    </TorradaProvider>
  );
}
