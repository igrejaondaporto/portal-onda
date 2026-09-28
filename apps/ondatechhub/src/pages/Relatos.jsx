import { useEffect, useState } from "react";
import { ouvirTodosRelatos, nomeBase } from "../lib/relatos.js";
import { ROTULO_TIPO_RELATO, COR_STATUS_RELATO } from "@portal/shared/lib/relatos.js";
import SheetRelatoAdmin from "../components/SheetRelatoAdmin.jsx";

// mesmo padrão de Solicitacoes.jsx (Comunicação) — secções empilhadas,
// não Kanban lado a lado (no telemóvel, uso real desta app, colunas
// lado a lado ficam a maior parte fora do ecrã).
const COLUNAS = [
  ["aberto", "Aberto", "var(--cinza)"],
  ["em_andamento", "Em andamento", "var(--azul)"],
  ["resolvido", "Resolvido", "var(--verde)"],
];

export default function Relatos({ ativo, definirCabecalho }) {
  const [relatos, setRelatos] = useState([]);
  const [secoesAbertas, setSecoesAbertas] = useState({ aberto: true }); // aberto já vem expandido — é o que precisa de ação
  const [verRecusados, setVerRecusados] = useState(false);
  const [relatoAberto, setRelatoAberto] = useState(null);

  useEffect(() => ouvirTodosRelatos(setRelatos), []);

  const porColuna = (status) => relatos.filter((r) => r.status === status);
  const recusados = relatos.filter((r) => r.status === "recusado");

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Relatos</em>,
      subtitulo: "Bugs, erros e melhorias de todas as bases",
      chips: [`${porColuna("aberto").length} em aberto`, `${porColuna("em_andamento").length} em andamento`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, relatos.length]);

  return (
    <>
      <div className="sect">
        {COLUNAS.map(([status, rotulo, cor]) => {
          const lista = porColuna(status);
          const aberta = !!secoesAbertas[status];
          return (
            <div className="mincartao" key={status}>
              <div className="mincartao-barra" style={{ background: cor }} />
              <button
                className="mincartao-cab cabtoque" data-aberto={aberta ? 1 : 0} aria-expanded={aberta}
                onClick={() => setSecoesAbertas((v) => ({ ...v, [status]: !v[status] }))}
              >
                <span className="ponto" style={{ background: cor }} />
                <span className="nome">{rotulo}</span>
                <span className="conta">{lista.length}</span>
                <span className="cabtoque-seta" aria-hidden="true">›</span>
              </button>
              {aberta && (
                <div style={{ padding: "0 12px 12px" }}>
                  {lista.length === 0 && <div className="vaz" style={{ border: 0 }}>Nada aqui</div>}
                  {lista.map((r) => (
                    <div className="linha" style={{ cursor: "pointer" }} key={r.id} onClick={() => setRelatoAberto(r)}>
                      <div style={{ flex: 1 }}>
                        <p className="nmt">{r.titulo}</p>
                        <p className="ds">{ROTULO_TIPO_RELATO[r.tipo]} · {nomeBase(r.baseOrigemId)} · {r.reportadoPorNome ?? "…"}</p>
                      </div>
                      {r.responsavelNome ? <span className="tag">{r.responsavelNome}</span> : <span className="seta">›</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="btn sec full" style={{ marginTop: 14 }} onClick={() => setVerRecusados((v) => !v)}>
        {verRecusados ? "Esconder recusados" : `Ver recusados (${recusados.length})`}
      </button>
      {verRecusados && (
        <div className="sect">
          {recusados.length === 0 && <div className="vaz">Nenhum recusado.</div>}
          {recusados.map((r) => (
            <div className="linha" style={{ cursor: "pointer" }} key={r.id} onClick={() => setRelatoAberto(r)}>
              <div style={{ flex: 1 }}>
                <p className="nmt">{r.titulo}</p>
                <p className="ds">{nomeBase(r.baseOrigemId)} · {r.reportadoPorNome ?? "…"}</p>
              </div>
              <span className="tag cinz" style={{ background: COR_STATUS_RELATO.recusado }}>recusado</span>
            </div>
          ))}
        </div>
      )}

      {relatoAberto && (
        <SheetRelatoAdmin
          relato={relatos.find((r) => r.id === relatoAberto.id) ?? relatoAberto}
          onFechar={() => setRelatoAberto(null)}
        />
      )}
    </>
  );
}
