import { useEffect, useState } from "react";
import { ouvirMarcas, ouvirRecursos, ouvirCategoriasRecurso, garantirCategoriasPadrao } from "../lib/marcas";
import { ouvirAcervo, ouvirCategoriasAcervo } from "../lib/acervo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SheetMarca from "../components/painel/SheetMarca";
import SheetRecurso from "../components/painel/SheetRecurso";
import SheetCategoriaRecurso from "../components/painel/SheetCategoriaRecurso";
import SheetItemAcervo from "../components/painel/SheetItemAcervo";
import SheetCategoriaAcervo from "../components/painel/SheetCategoriaAcervo";

const SEM_CATEGORIA = "sem-categoria";
const QUANTOS_FECHADO = 3;

// recurso antigo (de antes desta funcionalidade existir) só tem
// `tipo` — os IDs semeados por garantirCategoriasPadrao são iguais
// aos valores desse enum, por isso cai na categoria certa sem migração
const categoriaDoRecurso = (r) => r.categoriaId ?? r.tipo ?? null;

// logo do serviço em vez da inicial do título quando não há
// miniatura própria — ficheiros em public/origem/, ver CLAUDE.md
// desta base (de onde vieram, porque cada formato é diferente)
const LOGO_ORIGEM = {
  "Google Drive": "/origem/drive.webp",
  "Canva": "/origem/canva.jpg",
  "Dropbox": "/origem/dropbox.png",
  "Instagram": "/origem/instagram.svg",
};

function CardRecurso({ item, corMarca, onEditar }) {
  const logo = LOGO_ORIGEM[item.origem];
  return (
    <div className="cartaomelh" style={{ cursor: onEditar ? "pointer" : "default" }} onClick={onEditar}>
      {item.thumbUrl ? (
        <span className="miniatura" style={{ borderRadius: 10, backgroundImage: `url(${item.thumbUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      ) : logo ? (
        <span className="miniatura miniatura-origem">
          <img src={logo} alt="" />
        </span>
      ) : (
        <span className="miniatura" style={{ borderRadius: 10, background: corMarca || "var(--azul)" }}>
          {item.titulo.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="cartaomelh-corpo">
        <div className="cartaomelh-linha1">
          <a className="cartaomelh-titulo" href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            {item.titulo}
          </a>
        </div>
        <div className="cartaomelh-linha2">
          {item.origem && <span className="tag cinz">{item.origem}</span>}
        </div>
        {item.descricao && <div className="cartaomelh-desc">{item.descricao}</div>}
      </div>
    </div>
  );
}

/** Um grupo (categoria) do Acervo — mesmo cartão `.mincartao` que a
 *  Wiki usa para agrupar por ministério (ver Wiki.jsx). Mostra só os
 *  3 primeiros itens; "Ver mais" expande para todos, sem paginação
 *  nem outra tela — o acervo de uma equipa pequena não pede isso. */
function GrupoAcervo({ nome, itens, souLiderBase, onEditarCategoria, onEditarItem }) {
  const [aberto, setAberto] = useState(false);
  const visiveis = aberto ? itens : itens.slice(0, QUANTOS_FECHADO);

  return (
    <div className="mincartao">
      <div className="mincartao-cab" style={{ cursor: onEditarCategoria ? "pointer" : "default" }} onClick={onEditarCategoria}>
        <span className="nome">{nome}</span>
        <span className="conta">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
        {onEditarCategoria && <span className="seta">›</span>}
      </div>
      <div style={{ padding: "0 12px 12px" }}>
        {visiveis.map((item) => (
          <CardRecurso key={item.id} item={item} onEditar={souLiderBase ? () => onEditarItem(item) : null} />
        ))}
        {itens.length > QUANTOS_FECHADO && (
          <button className="btn sec full verMais" onClick={() => setAberto((v) => !v)}>
            {aberto ? "Ver menos" : `Ver mais (${itens.length - QUANTOS_FECHADO})`}
          </button>
        )}
      </div>
    </div>
  );
}

/** Dentro de cada marca, primeiro as categorias (Logos, Fontes,
 *  Cores, Outros por omissão, o líder cria mais) — só depois os
 *  links dos ficheiros em si, já dentro da categoria escolhida.
 *  Substituiu o antigo `tipo` fixo em código: "Novo recurso" dentro
 *  de uma categoria já sabe para onde vai, não pergunta mais. */
function KitMarca({ marca, souLiderBase, onVoltar }) {
  const torrada = useTorrada();
  const [recursos, setRecursos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaAbertaId, setCategoriaAbertaId] = useState(null);
  const [sheet, setSheet] = useState(null);

  useEffect(() => ouvirRecursos(marca.id, setRecursos), [marca.id]);
  useEffect(() => ouvirCategoriasRecurso(marca.id, setCategorias), [marca.id]);
  useEffect(() => {
    if (souLiderBase) garantirCategoriasPadrao(marca.id);
  }, [marca.id, souLiderBase]);

  const categoriaAberta = categoriaAbertaId ? categorias.find((c) => c.id === categoriaAbertaId) : null;
  const doCategoria = categoriaAbertaId ? recursos.filter((r) => categoriaDoRecurso(r) === categoriaAbertaId) : [];

  if (categoriaAberta) {
    return (
      <>
        <button className="sair" style={{ marginTop: 0 }} onClick={() => setCategoriaAbertaId(null)}>‹ {marca.nome}</button>
        <div className="sect">
          <div className="cabecalho">
            <h3>{categoriaAberta.nome}</h3>
            {souLiderBase && (
              <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "recurso" })}>
                Novo recurso
              </button>
            )}
          </div>
          {souLiderBase && (
            <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setSheet({ tipo: "categoriaRecurso", categoria: categoriaAberta })}>
              Editar categoria
            </button>
          )}
        </div>
        {doCategoria.length > 0 ? (
          <div className="sect">
            {doCategoria.map((r) => (
              <CardRecurso key={r.id} item={r} corMarca={marca.cores?.[0]} onEditar={souLiderBase ? () => setSheet({ tipo: "recurso", recurso: r }) : null} />
            ))}
          </div>
        ) : (
          <div className="sect"><div className="vaz">Ainda sem recursos nesta categoria.</div></div>
        )}

        {sheet?.tipo === "recurso" && (
          <SheetRecurso
            marcaId={marca.id} categoriaId={categoriaAbertaId} recurso={sheet.recurso}
            onFechar={() => setSheet(null)}
            onGuardado={(msg) => { setSheet(null); torrada(msg); }}
            onRemovido={(msg) => { setSheet(null); torrada(msg); }}
          />
        )}
        {sheet?.tipo === "categoriaRecurso" && (
          <SheetCategoriaRecurso
            marcaId={marca.id} categoria={sheet.categoria}
            onFechar={() => setSheet(null)}
            onGuardado={(msg) => { setSheet(null); torrada(msg); }}
            onDesativada={(msg) => { setSheet(null); torrada(msg); setCategoriaAbertaId(null); }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button className="sair" style={{ marginTop: 0 }} onClick={onVoltar}>‹ Marcas</button>
      <div className="sect">
        <div className="cabecalho"><h3 style={{ color: marca.cores?.[0] }}>{marca.nome}</h3></div>
        {marca.descricao && <p className="ds">{marca.descricao}</p>}
        {souLiderBase && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn sec full" onClick={() => setSheet({ tipo: "marca" })}>Editar marca</button>
            <button className="btn sec full" onClick={() => setSheet({ tipo: "categoriaRecurso" })}>Nova categoria</button>
          </div>
        )}
      </div>

      <div className="sect">
        {categorias.length === 0 ? (
          <div className="vaz">A preparar as categorias…</div>
        ) : (
          <div className="grelha-marcas">
            {categorias.map((c) => {
              const n = recursos.filter((r) => categoriaDoRecurso(r) === c.id).length;
              return (
                <button
                  key={c.id} className="categoria-card"
                  style={{ background: `linear-gradient(135deg, ${marca.cores?.[0] ?? "#0019BE"}, ${marca.cores?.[1] ?? marca.cores?.[0] ?? "#0019BE"})` }}
                  onClick={() => setCategoriaAbertaId(c.id)}
                >
                  <p className="titulo">{c.nome}</p>
                  <span className="conta">{n} {n === 1 ? "item" : "itens"}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {sheet?.tipo === "marca" && (
        <SheetMarca
          marca={marca}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
          onDesativada={(msg) => { setSheet(null); torrada(msg); onVoltar(); }}
        />
      )}
      {sheet?.tipo === "categoriaRecurso" && (
        <SheetCategoriaRecurso
          marcaId={marca.id} categoria={sheet.categoria}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
          onDesativada={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}

export default function Brand({ papel, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [aba, setAba] = useState("marcas");
  const [marcas, setMarcas] = useState([]);
  const [acervo, setAcervo] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [marcaAbertaId, setMarcaAbertaId] = useState(null);
  const [sheet, setSheet] = useState(null);

  useEffect(() => ouvirMarcas(setMarcas), []);
  useEffect(() => ouvirAcervo(setAcervo), []);
  useEffect(() => ouvirCategoriasAcervo(setCategorias), []);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Brand",
      subtitulo: aba === "marcas" ? "Logos, fontes e cores de cada marca" : "Fotos, templates e outros materiais",
      chips: [],
    });
  }, [ativo, aba, definirCabecalho]);

  const marcaAberta = marcaAbertaId ? marcas.find((m) => m.id === marcaAbertaId) : null;

  if (marcaAberta) {
    return <KitMarca marca={marcaAberta} souLiderBase={souLiderBase} onVoltar={() => setMarcaAbertaId(null)} />;
  }

  // categoria inativa/apagada não some com o item, cai em "Sem
  // categoria" — mesma rede de segurança da Wiki para ministério
  // desativado (ver wikiGrupos.js). As categorias reais ficam sempre
  // na lista, mesmo com 0 itens — senão uma categoria recém-criada
  // (ainda sem nada lá dentro) desaparecia e o líder não tinha como a
  // voltar a abrir para editar ou excluir. Só "Sem categoria" (que não
  // é uma categoria de verdade, é só onde cai o que não tem nenhuma)
  // some quando fica vazia.
  const idsCategoriasAtivas = new Set(categorias.map((c) => c.id));
  const gruposAcervo = [
    ...categorias.map((c) => ({ id: c.id, nome: c.nome, itens: acervo.filter((i) => i.categoriaId === c.id) })),
    { id: SEM_CATEGORIA, nome: "Sem categoria", itens: acervo.filter((i) => !i.categoriaId || !idsCategoriasAtivas.has(i.categoriaId)) },
  ].filter((g) => g.id !== SEM_CATEGORIA || g.itens.length > 0);

  return (
    <>
      <div className="sect">
        <div className="cabecalho"><h3>Brand</h3></div>
        <div className="subtabs" style={{ marginTop: 0 }}>
          <button data-on={aba === "marcas" ? 1 : 0} onClick={() => setAba("marcas")}>Marcas</button>
          <button data-on={aba === "acervo" ? 1 : 0} onClick={() => setAba("acervo")}>Acervo</button>
        </div>
      </div>

      {aba === "marcas" && (
        <div className="sect">
          {souLiderBase && (
            <button className="btn sec full" style={{ marginBottom: 12 }} onClick={() => setSheet({ tipo: "marca" })}>
              Nova marca
            </button>
          )}
          {marcas.length === 0 ? (
            <div className="vaz">Ainda sem marcas.</div>
          ) : (
            <div className="grelha-marcas">
              {marcas.map((m) => (
                <button
                  key={m.id}
                  className="marca-card"
                  style={m.fotoUrl
                    ? { backgroundImage: `url(${m.fotoUrl})` }
                    : { background: `linear-gradient(135deg, ${m.cores?.[0] ?? "#0019BE"}, ${m.cores?.[1] ?? m.cores?.[0] ?? "#0019BE"})` }}
                  onClick={() => setMarcaAbertaId(m.id)}
                >
                  {m.fixado && <span className="marca-fixada" title="Fixada no topo">📌</span>}
                  <p className="titulo">{m.nome}{m.descricao && <span>{m.descricao}</span>}</p>
                  <div className="swatches">
                    {(m.cores || []).map((c, i) => <i key={i} style={{ background: c }} />)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {aba === "acervo" && (
        <div className="sect">
          {souLiderBase && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className="btn sec full" onClick={() => setSheet({ tipo: "acervo" })}>Novo item</button>
              <button className="btn sec full" onClick={() => setSheet({ tipo: "categoriaAcervo" })}>Nova categoria</button>
            </div>
          )}
          {gruposAcervo.length === 0 ? (
            <div className="vaz">Ainda sem nada no acervo.</div>
          ) : (
            gruposAcervo.map((g) => (
              <GrupoAcervo
                key={g.id} nome={g.nome} itens={g.itens} souLiderBase={souLiderBase}
                onEditarCategoria={souLiderBase && g.id !== SEM_CATEGORIA
                  ? () => setSheet({ tipo: "categoriaAcervo", categoria: categorias.find((c) => c.id === g.id) })
                  : null}
                onEditarItem={(item) => setSheet({ tipo: "acervo", item })}
              />
            ))
          )}
        </div>
      )}

      {sheet?.tipo === "marca" && (
        <SheetMarca
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "categoriaAcervo" && (
        <SheetCategoriaAcervo
          categoria={sheet.categoria}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
          onDesativada={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "acervo" && (
        <SheetItemAcervo
          categorias={categorias}
          item={sheet.item}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
          onDesativado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
