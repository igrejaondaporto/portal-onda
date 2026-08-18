import { useEffect, useState } from "react";
import { ouvirSolicitacoes } from "../lib/solicitacoes";
import { dataCurta } from "@portal/shared/lib/data.js";
import SheetAbrirSolicitacao from "@portal/shared/components/SheetAbrirSolicitacao.jsx";
import SheetSolicitacao from "../components/solicitacoes/SheetSolicitacao";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const FILTROS = [
  [null, "Todas"],
  ["fila", "Na fila"],
  ["producao", "Em produção"],
  ["revisao", "Em revisão"],
  ["entregue", "Entregues"],
  ["recusada", "Recusadas"],
];

function diasRestantes(prazoISO) {
  const hoje = new Date().toISOString().slice(0, 10);
  const dias = Math.round((new Date(`${prazoISO}T00:00:00Z`) - new Date(`${hoje}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
  if (dias < 0) return `${-dias}d atrasado`;
  if (dias === 0) return "hoje";
  return `${dias}d`;
}

export default function Solicitacoes({ uid, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [filtro, setFiltro] = useState(null);
  const [sheet, setSheet] = useState(null); // { tipo: "abrir" | "ver", solicitacao? }

  useEffect(() => ouvirSolicitacoes(setSolicitacoes), []);

  const contarPorStatus = (status) => solicitacoes.filter((s) => s.status === status).length;
  // "Todas" (sem filtro) esconde as fechadas — senão a lista só cresce.
  // Um filtro escolhido mostra mesmo as fechadas, é para isso que existe.
  const naoFechada = (s) => s.status !== "entregue" && s.status !== "recusada";
  const visiveis = solicitacoes
    .filter((s) => (filtro ? s.status === filtro : naoFechada(s)))
    .sort((a, b) => (a.prazo < b.prazo ? -1 : a.prazo > b.prazo ? 1 : 0));

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Solicitações",
      subtitulo: "Pedidos das outras bases",
      chips: [`${contarPorStatus("fila")} na fila`, `${contarPorStatus("producao") + contarPorStatus("revisao")} em curso`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, solicitacoes.length]);

  return (
    <>
      <button className="btn full" style={{ marginTop: 4 }} onClick={() => setSheet({ tipo: "abrir" })}>
        Abrir solicitação
      </button>

      <div className="subtabs" style={{ marginTop: 14 }}>
        {FILTROS.map(([valor, rotulo]) => (
          <button key={rotulo} data-on={filtro === valor ? 1 : 0} onClick={() => setFiltro(valor)}>
            {rotulo}{valor ? ` · ${contarPorStatus(valor)}` : ""}
          </button>
        ))}
      </div>

      <div className="sect">
        {visiveis.length === 0 && <div className="vaz">Nada por aqui.</div>}
        {visiveis.map((s) => (
          <div className="linha" style={{ cursor: "pointer" }} key={s.id} onClick={() => setSheet({ tipo: "ver", solicitacao: s })}>
            <div style={{ flex: 1 }}>
              <p className="nmt">{s.titulo}</p>
              <p className="ds">
                {s.baseSolicitanteId} · {dataCurta(s.prazo)} ({diasRestantes(s.prazo)})
                {s.responsavelNome ? ` · ${s.responsavelNome}` : ""}
                {s.foraDoPrazo ? " · fora do prazo mínimo" : ""}
              </p>
            </div>
            <span className="tag cinz">{s.status}</span>
          </div>
        ))}
      </div>

      {sheet?.tipo === "abrir" && (
        <SheetAbrirSolicitacao
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "ver" && (
        <SheetSolicitacao
          solicitacao={solicitacoes.find((s) => s.id === sheet.solicitacao.id) ?? sheet.solicitacao}
          uid={uid}
          onFechar={() => setSheet(null)}
        />
      )}
    </>
  );
}
