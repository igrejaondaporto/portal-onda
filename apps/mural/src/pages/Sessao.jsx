import { useEffect, useMemo, useState } from "react";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import AvisoInstalarPWA from "@portal/shared/components/AvisoInstalarPWA.jsx";
import NavBar from "@portal/shared/components/NavBar.jsx";
import ImagemExpandida from "@portal/shared/components/ImagemExpandida.jsx";
import { sair } from "../lib/auth.js";
import { ouvirAnunciosAtivos } from "../lib/anuncios.js";
import { NATUREZAS, ORDENS, bateCategoria, bateLugar, lugarDe, naturezaDe, nomeCategoria, nomeDaChave, nomeLugar, ordenar, relativo, textoPreco } from "../lib/util.js";
import DetalheAnuncio from "../components/DetalheAnuncio.jsx";
import FiltroSheet from "../components/FiltroSheet.jsx";
import FotoAnuncio from "../components/FotoAnuncio.jsx";
import GatilhoModeracao from "../components/GatilhoModeracao.jsx";
import MiniAvatar from "../components/MiniAvatar.jsx";
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
export default function Sessao({ eu, aEntrar, onPedirEntrar, onAdminConcedido }) {
  const [pagina, setPagina] = useState("mural");
  const [anuncios, setAnuncios] = useState([]);
  // Serviços | Produtos, e por baixo Tudo · Ofereço · Procuro (2026-09;
  // Serviços primeiro e aberto por omissão desde 2026-10)
  const [natureza, setNatureza] = useState("servico");
  const [tipo, setTipo] = useState("tudo");
  // "todas" por omissão — a região é um filtro como outro qualquer,
  // só se aplica se a pessoa a escolher (pedido explícito, 2026-09:
  // pré-selecionar Norte escondia tudo de quem procura em Lisboa/Sines
  // sem a pessoa perceber porquê).
  // "Onde" (2026-10): cidade, e dentro dela a freguesia — "Maia" ou
  // "Maia||Pedrouços". As opções vêm dos anúncios que existem (lugares
  // abaixo), por isso o filtro cresce sozinho.
  const [lugar, setLugar] = useState("todas");
  const [categoria, setCategoria] = useState("todas");
  // 2026-10: "Mais recentes" | "Mais baratos" (grátis primeiro) | "Mais
  // caros" — e em qualquer uma, com foto primeiro (ordenar, lib/util.js)
  const [ordem, setOrdem] = useState("recentes");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);
  const [imagemExpandida, setImagemExpandida] = useState(null);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const filtrosAtivos = (lugar !== "todas" ? 1 : 0) + (categoria !== "todas" ? 1 : 0) + (ordem !== "recentes" ? 1 : 0);

  useEffect(() => ouvirAnunciosAtivos(setAnuncios), []);
  // a categoria é por natureza; ao trocar Ofereço/Procuro só se perde
  // se for do outro lado ("ofereco:venda" continua a valer em Tudo)
  useEffect(() => setCategoria("todas"), [natureza]);
  // em "Tudo" o Filtro mostra temas ("tema:boleias"); em Ofereço/Procuro
  // as categorias desse lado ("procuro:boleias") — o que não serve ao
  // lado novo volta a "todas"
  useEffect(() => {
    setCategoria((c) => {
      if (c === "todas") return c;
      if (tipo === "tudo") return c.startsWith("tema:") ? c : "todas";
      return c.startsWith(`${tipo}:`) ? c : "todas";
    });
  }, [tipo]);

  // Publicar/Os meus sem sessão abre a Entrada; ao entrar, segue para
  // onde a pessoa ia (2026-10, com o botão "+"). Fechar a Entrada sem
  // entrar esquece o destino.
  const [depoisDeEntrar, setDepoisDeEntrar] = useState(null);
  useEffect(() => {
    if (eu && depoisDeEntrar) {
      setPagina(depoisDeEntrar);
      setDepoisDeEntrar(null);
    } else if (!eu && !aEntrar && depoisDeEntrar) {
      setDepoisDeEntrar(null);
    }
  }, [eu, aEntrar, depoisDeEntrar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ordenar(anuncios
      .filter((a) => a.estado !== "pausado") // o dono tirou-o do ar (Os meus)
      .filter((a) => naturezaDe(a) === natureza)
      .filter((a) => tipo === "tudo" || a.tipo === tipo)
      .filter((a) => bateLugar(a, lugar))
      .filter((a) => bateCategoria(a, categoria))
      .filter((a) => !q || `${a.titulo} ${a.descricao} ${a.autorNome} ${a.autorLocal} ${nomeCategoria(a.tipo, a.categoria)}`.toLowerCase().includes(q)), ordem);
  }, [anuncios, natureza, tipo, lugar, categoria, busca, ordem]);

  // as cidades (e freguesias) com anúncios nesta natureza/lado, com
  // quantos tem cada uma — é daqui que o Filtro tira as opções de "Onde"
  const lugares = useMemo(() => {
    const mapa = new Map();
    for (const a of anuncios) {
      if (a.estado === "pausado" || naturezaDe(a) !== natureza || (tipo !== "tudo" && a.tipo !== tipo)) continue;
      const cidade = lugarDe(a);
      if (!cidade) continue;
      const c = mapa.get(cidade) ?? { cidade, n: 0, freguesias: new Map() };
      c.n += 1;
      if (a.cidade && a.freguesia) c.freguesias.set(a.freguesia, (c.freguesias.get(a.freguesia) ?? 0) + 1);
      mapa.set(cidade, c);
    }
    return [...mapa.values()]
      .map((c) => ({ ...c, freguesias: [...c.freguesias].map(([nome, n]) => ({ nome, n })).sort((x, y) => y.n - x.n) }))
      .sort((x, y) => y.n - x.n || x.cidade.localeCompare(y.cidade, "pt"));
  }, [anuncios, natureza, tipo]);

  function irPara(destino) {
    if (PAGINAS_COM_SESSAO.has(destino) && !eu) {
      setDepoisDeEntrar(destino);
      return onPedirEntrar();
    }
    setPagina(destino);
  }

  const itens = [
    ["mural", "Mural", ICONES.mural],
    ["publicar", "Publicar", ICONES.publicar],
    ["meus", "Os meus", ICONES.meus],
  ];
  if (eu?.admin) itens.push(["painel", "Painel", ICONES.painel]);

  const casca = (conteudo) => (
    <Casca pagina={pagina} onIr={irPara} itens={itens} eu={eu} onPedirEntrar={onPedirEntrar} onAdminConcedido={onAdminConcedido}>
      {conteudo}
    </Casca>
  );

  if (pagina === "publicar" && eu) return casca(<Publicar onPublicado={() => setPagina("meus")} />);
  if (pagina === "meus" && eu) return casca(<MeusAnuncios />);
  if (pagina === "painel" && eu?.admin) return casca(<PainelAdmin />);

  return casca(
    <>
      <div className="natureza" role="group" aria-label="Produtos ou Serviços">
        {NATUREZAS.map((n) => (
          <button key={n.id} type="button" data-natureza={n.id} aria-pressed={natureza === n.id} onClick={() => setNatureza(n.id)}>
            <b>{n.nome}</b>
            <small>{n.sub}</small>
          </button>
        ))}
      </div>

      <div className="segmentado">
        <button data-on={tipo === "tudo" ? 1 : 0} onClick={() => setTipo("tudo")}>Tudo</button>
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
        {filtrados.length} {tipo === "procuro" ? "pedidos" : "anúncios"} de {natureza === "servico" ? "serviços" : "produtos"}
        {lugar !== "todas" && <> em {nomeLugar(lugar)}</>}
        {categoria !== "todas" && <> · {nomeDaChave(categoria)}</>}
      </p>

      {filtrosAtivos > 0 && (
        <div className="filtrosAtivos">
          {categoria !== "todas" && (
            <button type="button" onClick={() => setCategoria("todas")} aria-label={`Tirar o filtro ${nomeDaChave(categoria)}`}>
              {nomeDaChave(categoria)} <span aria-hidden>×</span>
            </button>
          )}
          {ordem !== "recentes" && (
            <button type="button" onClick={() => setOrdem("recentes")} aria-label="Voltar a ordenar por mais recentes">
              {ORDENS.find((o) => o.id === ordem)?.nome} <span aria-hidden>×</span>
            </button>
          )}
          {lugar !== "todas" && (
            <button type="button" onClick={() => setLugar("todas")} aria-label="Tirar o filtro de lugar">
              {nomeLugar(lugar)} <span aria-hidden>×</span>
            </button>
          )}
        </div>
      )}

      {filtroAberto && (
        <FiltroSheet
          natureza={natureza} tipo={tipo} lugar={lugar} setLugar={setLugar} lugares={lugares} ordem={ordem} setOrdem={setOrdem} categoria={categoria} setCategoria={setCategoria}
          onFechar={() => setFiltroAberto(false)}
        />
      )}

      {filtrados.length === 0 && (
        <p className="vaz">
          {busca
            ? <>Nada encontrado para “{busca}”. Se é disto que precisas, publica em <b>Procuro</b> — alguém pode ter.</>
            : <>Ainda não há nada aqui. Toca no <b>+</b> e sê o primeiro.</>}
        </p>
      )}

      {/* "+" para publicar daqui mesmo (2026-10, como o da Biblioteca
          da Louvor) — sem sessão abre a Entrada e segue para Publicar
          depois de entrar (ver depoisDeEntrar acima). À direita: o
          Mural não tem o botão "Melhorias" que obrigou a Louvor a
          pôr o dela à esquerda. */}
      <button type="button" className="mural-fab" aria-label="Publicar um anúncio" onClick={() => irPara("publicar")}>
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>

      {filtrados.map((a, i) => (
        <button key={a.id} className={`linha${a.estado === "vendido" ? " vendido" : ""}`} style={{ width: "100%", background: "none", border: 0, borderBottom: "1px solid var(--fio)", textAlign: "left", cursor: "pointer", alignItems: "flex-start", gap: 14, animationDelay: `${i * 20}ms` }} onClick={() => setAberto(a)}>
          <FotoAnuncio anuncio={a} estilo={{ marginTop: 2 }} onExpandir={setImagemExpandida} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="nmt" style={{ display: "block" }}>{a.titulo}</span>
            <span className="ds" style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
              <MiniAvatar nome={a.autorNome} foto={a.autorFoto} />
              {a.autorNome} · {tipo === "tudo" && a.categoria === "outros" ? (a.tipo === "procuro" ? "Procuro · " : "Ofereço · ") : ""}{nomeCategoria(a.tipo, a.categoria)}{a.cidade ? ` · ${a.cidade}` : ""} · {relativo(a.criadoEm)}
            </span>
          </span>
          {/* à direita o PREÇO (2026-10 — "Disponível" em todos não dizia
              nada); o estado só aparece quando diz alguma coisa */}
          <span className="ladoPreco">
            <span className={`precoTag${a.gratis ? " gratis" : valorPrecoVazio(a) ? " combinar" : ""}`}>{textoPreco(a)}</span>
            {a.estado === "reservado" && <span className="seloEstado res">Reservado</span>}
            {a.estado === "vendido" && <span className="seloEstado vend">Vendido</span>}
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
      {imagemExpandida && <ImagemExpandida src={imagemExpandida} onFechar={() => setImagemExpandida(null)} />}
    </>
  );
}

const valorPrecoVazio = (a) => !a.gratis && !a.preco;

function Casca({ children, pagina, onIr, itens, eu, onPedirEntrar, onAdminConcedido }) {
  return (
    <div className="app on">
      <AvisoOffline />
      <AvisoInstalarPWA />
      <div className="crista topo" style={{ paddingBottom: 0 }}>
        <div className="lin">
          <GatilhoModeracao ativo={!!eu && !eu.admin} onConcedido={onAdminConcedido}>
            <span className="logo">
              <i>mural</i>
              <b>onda</b>
            </span>
          </GatilhoModeracao>
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
