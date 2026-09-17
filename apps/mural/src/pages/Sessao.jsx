import { useEffect, useMemo, useState } from "react";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import AvisoInstalarPWA from "@portal/shared/components/AvisoInstalarPWA.jsx";
import NavBar from "@portal/shared/components/NavBar.jsx";
import { sair } from "../lib/auth.js";
import { ouvirAnunciosAtivos } from "../lib/anuncios.js";
import { corPara, CATEGORIAS, ESTADOS, REGIOES, nomeCategoria, relativo } from "../lib/util.js";
import DetalheAnuncio from "../components/DetalheAnuncio.jsx";
import FiltroSheet from "../components/FiltroSheet.jsx";
import Publicar from "./Publicar.jsx";
import MeusAnuncios from "./MeusAnuncios.jsx";
import PainelAdmin from "./PainelAdmin.jsx";

const ICONES = {
  mural: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  publicar: '<path d="M12 5v14M5 12h14"/>',
  meus: '<path d="M20 7H4M20 12H4M14 17H4"/>',
  painel: '<path d="M12 3l7.5 3.6v5c0 4.4-3.1 8.1-7.5 9.4-4.4-1.3-7.5-5-7.5-9.4v-5z"/><path d="M9.5 12l1.8 1.8 3.4-3.6"/>',
};

// páginas que só existem para quem já entrou — tocar nelas sem
// sessão abre a Entrada em vez de navegar (ver irPara abaixo).
const PAGINAS_COM_SESSAO = new Set(["publicar", "meus", "painel"]);

/** `eu` é `null` para quem só está a ver — o Mural mostra-se a
 *  QUALQUER PESSOA sem conta (2026-09, pedido explícito); só
 *  publicar/gerir pede sessão. `onPedirEntrar` abre o overlay de
 *  Entrada (ver App.jsx). */
export default function Sessao({ eu, onPedirEntrar }) {
  const [pagina, setPagina] = useState("mural");
  const [anuncios, setAnuncios] = useState([]);
  const [tipo, setTipo] = useState("ofereco");
  // "todas" por omissão — a região é um filtro como outro qualquer,
  // só se aplica se a pessoa a escolher (pedido explícito, 2026-09:
  // pré-selecionar Norte escondia tudo de quem procura em Lisboa/Sines
  // sem a pessoa perceber porquê).
  const [regiao, setRegiao] = useState("todas");
  const [categoria, setCategoria] = useState("todas");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const filtrosAtivos = (regiao !== "todas" ? 1 : 0) + (categoria !== "todas" ? 1 : 0);

  useEffect(() => ouvirAnunciosAtivos(setAnuncios), []);
  useEffect(() => setCategoria("todas"), [tipo]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return anuncios
      .filter((a) => a.tipo === tipo)
      .filter((a) => regiao === "todas" || a.regiao === regiao)
      .filter((a) => categoria === "todas" || a.categoria === categoria)
      .filter((a) => !q || `${a.titulo} ${a.descricao} ${a.autorNome} ${a.autorLocal}`.toLowerCase().includes(q));
  }, [anuncios, tipo, regiao, categoria, busca]);

  function irPara(destino) {
    if (PAGINAS_COM_SESSAO.has(destino) && !eu) return onPedirEntrar();
    setPagina(destino);
  }

  const itens = [
    ["mural", "Mural", ICONES.mural],
    ["publicar", "Publicar", ICONES.publicar],
    ["meus", "Os meus", ICONES.meus],
  ];
  if (eu?.admin) itens.push(["painel", "Painel", ICONES.painel]);

  const casca = (conteudo) => (
    <Casca pagina={pagina} onIr={irPara} itens={itens} eu={eu} onPedirEntrar={onPedirEntrar}>
      {conteudo}
    </Casca>
  );

  if (pagina === "publicar" && eu) return casca(<Publicar onPublicado={() => setPagina("meus")} />);
  if (pagina === "meus" && eu) return casca(<MeusAnuncios />);
  if (pagina === "painel" && eu?.admin) return casca(<PainelAdmin />);

  return casca(
    <>
      <div className="segmentado">
        <button data-on={tipo === "ofereco" ? 1 : 0} onClick={() => setTipo("ofereco")}>Ofereço</button>
        <button data-on={tipo === "procuro" ? 1 : 0} onClick={() => setTipo("procuro")}>Procuro</button>
      </div>

      <div style={{ display: "flex", gap: 10, margin: "14px 0 4px" }}>
        <div className="procura" style={{ margin: 0, flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input type="search" placeholder="Procurar no mural…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <button className="btn sec filtroBtn" onClick={() => setFiltroAberto(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filtro
          {filtrosAtivos > 0 && <span className="filtroContagem">{filtrosAtivos}</span>}
        </button>
      </div>

      <p className="ds" style={{ padding: "14px 0 2px" }}>
        {filtrados.length} {tipo === "ofereco" ? "anúncios" : "pedidos"}
        {regiao !== "todas" && <> na região {REGIOES.find((r) => r.id === regiao)?.nome}</>}
        {categoria !== "todas" && <> · {CATEGORIAS[tipo].find((c) => c.id === categoria)?.nome}</>}
      </p>

      {filtroAberto && (
        <FiltroSheet
          tipo={tipo} regiao={regiao} setRegiao={setRegiao} categoria={categoria} setCategoria={setCategoria}
          onFechar={() => setFiltroAberto(false)}
        />
      )}

      {filtrados.length === 0 && (
        <p className="vaz">
          {busca
            ? <>Nada encontrado para “{busca}”. Se é disto que precisas, publica em <b>Procuro</b> — alguém pode ter.</>
            : "Ainda não há nada nesta categoria. Sê o primeiro."}
        </p>
      )}

      {filtrados.map((a, i) => (
        <button key={a.id} className={`linha${a.estado === "vendido" ? " vendido" : ""}`} style={{ width: "100%", background: "none", border: 0, borderBottom: "1px solid var(--fio)", textAlign: "left", cursor: "pointer", animationDelay: `${i * 20}ms` }} onClick={() => setAberto(a)}>
          <span className="bola" style={{ background: corPara(a.titulo) }}>{a.titulo[0]}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="nmt" style={{ display: "block" }}>{a.titulo}</span>
            <span className={`preco${a.gratis ? " gratis" : ""}`} style={{ display: "block" }}>
              {a.gratis ? "Grátis" : a.preco || "A combinar"}
            </span>
            <span className="ds">{a.autorNome} · {nomeCategoria(a.tipo, a.categoria)} · {relativo(a.criadoEm)}</span>
          </span>
          <span className="tag" style={{ background: ESTADOS[a.estado]?.classe === "disp" ? "var(--verde)" : ESTADOS[a.estado]?.classe === "res" ? "var(--laranja)" : "var(--agua)", color: ESTADOS[a.estado]?.classe === "vend" ? "var(--cinza)" : "#fff" }}>
            {ESTADOS[a.estado]?.nome}
          </span>
        </button>
      ))}

      {aberto && (
        <DetalheAnuncio
          anuncio={aberto}
          meuUid={eu?.uid}
          onFechar={() => setAberto(null)}
          onPedirEntrar={onPedirEntrar}
        />
      )}
    </>
  );
}

function Casca({ children, pagina, onIr, itens, eu, onPedirEntrar }) {
  return (
    <div className="app on">
      <AvisoOffline />
      <AvisoInstalarPWA />
      <div className="crista topo" style={{ paddingBottom: 0 }}>
        <div className="lin">
          <span className="logo">
            <i>mural</i>
            <b>onda</b>
          </span>
          {eu ? (
            <div className="eu">
              <div style={{ textAlign: "right" }}>
                <b>{eu.nome}</b>
                <p>{eu.admin ? "Modera o Mural" : "Igreja Onda"}</p>
              </div>
              <span
                className="av" style={{ width: 36, height: 36, fontSize: 14, cursor: "pointer", ...(eu.foto ? { backgroundImage: `url(${eu.foto})` } : { background: "var(--lima)", color: "var(--tinta)" }) }}
                onClick={() => window.confirm("Sair do Mural?") && sair()}
                title="Sair"
              >
                {eu.foto ? "" : eu.nome[0]}
              </span>
            </div>
          ) : (
            <button className="btn sec" style={{ padding: "9px 18px", fontSize: 13 }} onClick={onPedirEntrar}>
              Entrar
            </button>
          )}
        </div>
        <h1 style={{ marginTop: 18, fontSize: "clamp(30px,8vw,40px)" }}>
          {pagina === "mural" && <>Mural <em>Onda</em></>}
          {pagina === "publicar" && "Novo anúncio"}
          {pagina === "meus" && "Os meus anúncios"}
          {pagina === "painel" && "Painel"}
        </h1>
        <svg className="curva" viewBox="0 0 400 46" preserveAspectRatio="none">
          <path d="M0,46 C110,4 290,4 400,46 L400,46 L0,46 Z" fill="#fff" />
        </svg>
      </div>
      <div className="corpo">{children}</div>
      <NavBar pagina={pagina} onIr={onIr} itens={itens} />
    </div>
  );
}
