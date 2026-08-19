import { useEffect, useState } from "react";
import { ouvirMarcas, ouvirRecursos } from "../lib/marcas";
import { ouvirAcervo } from "../lib/acervo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SheetMarca from "../components/painel/SheetMarca";
import SheetRecurso from "../components/painel/SheetRecurso";
import SheetItemAcervo from "../components/painel/SheetItemAcervo";

const TIPOS_RECURSO = [
  ["logos", "Logos"],
  ["fontes", "Fontes"],
  ["cores", "Cores"],
  ["outros", "Outros"],
];

function CardRecurso({ item, corMarca, onEditar }) {
  return (
    <div className="cartaomelh" style={{ cursor: onEditar ? "pointer" : "default" }} onClick={onEditar}>
      {item.thumbUrl ? (
        <span className="miniatura" style={{ borderRadius: 10, backgroundImage: `url(${item.thumbUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
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

function KitMarca({ marca, souLiderBase, onVoltar }) {
  const torrada = useTorrada();
  const [recursos, setRecursos] = useState([]);
  const [tipo, setTipo] = useState("logos");
  const [sheet, setSheet] = useState(null);

  useEffect(() => ouvirRecursos(marca.id, setRecursos), [marca.id]);

  const tiposComItens = TIPOS_RECURSO.filter(([v]) => recursos.some((r) => r.tipo === v));
  const doTipo = recursos.filter((r) => r.tipo === tipo);

  return (
    <>
      <button className="sair" style={{ marginTop: 0 }} onClick={onVoltar}>‹ Marcas</button>
      <div className="sect">
        <div className="cabecalho">
          <h3 style={{ color: marca.cores?.[0] }}>{marca.nome}</h3>
          {souLiderBase && (
            <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "recurso" })}>
              Novo recurso
            </button>
          )}
        </div>
        {marca.descricao && <p className="ds">{marca.descricao}</p>}
        {souLiderBase && (
          <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setSheet({ tipo: "marca" })}>
            Editar marca
          </button>
        )}
        {tiposComItens.length > 0 ? (
          <div className="subtabs" style={{ marginTop: 0 }}>
            {tiposComItens.map(([v, nome]) => (
              <button key={v} data-on={tipo === v ? 1 : 0} onClick={() => setTipo(v)}>{nome}</button>
            ))}
          </div>
        ) : (
          <div className="vaz">Ainda sem recursos nesta marca.</div>
        )}
      </div>

      {doTipo.length > 0 && (
        <div className="sect">
          {doTipo.map((r) => (
            <CardRecurso key={r.id} item={r} corMarca={marca.cores?.[0]} onEditar={souLiderBase ? () => setSheet({ tipo: "recurso", recurso: r }) : null} />
          ))}
        </div>
      )}

      {sheet?.tipo === "recurso" && (
        <SheetRecurso
          marcaId={marca.id} tipoAtual={tipo} recurso={sheet.recurso}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
          onRemovido={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "marca" && (
        <SheetMarca
          marca={marca}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
          onDesativada={(msg) => { setSheet(null); torrada(msg); onVoltar(); }}
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
  const [marcaAbertaId, setMarcaAbertaId] = useState(null);
  const [sheet, setSheet] = useState(null);

  useEffect(() => ouvirMarcas(setMarcas), []);
  useEffect(() => ouvirAcervo(setAcervo), []);

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
            <button className="btn sec full" style={{ marginBottom: 12 }} onClick={() => setSheet({ tipo: "acervo" })}>
              Novo item
            </button>
          )}
          {acervo.length === 0 ? (
            <div className="vaz">Ainda sem nada no acervo.</div>
          ) : (
            acervo.map((item) => (
              <CardRecurso key={item.id} item={item} onEditar={souLiderBase ? () => setSheet({ tipo: "acervo", item }) : null} />
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
      {sheet?.tipo === "acervo" && (
        <SheetItemAcervo
          item={sheet.item}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
          onDesativado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
