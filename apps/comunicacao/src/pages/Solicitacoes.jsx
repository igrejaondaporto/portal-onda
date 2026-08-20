import { useEffect, useState } from "react";
import { ouvirSolicitacoes, assumirSolicitacao, mudarStatusSolicitacao, nomeBase } from "../lib/solicitacoes";
import { ouvirVoluntarios, ouvirMinisterios } from "../lib/painel";
import { dataCurta } from "@portal/shared/lib/data.js";
import SheetAbrirSolicitacao from "@portal/shared/components/SheetAbrirSolicitacao.jsx";
import SheetSolicitacao from "../components/solicitacoes/SheetSolicitacao";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

// ordem fixa das secções — pedido do líder: Fila → Produção → Revisão →
// Entregue, cada uma com a sua cor (mesma paleta dos "tag" que já
// existem: cinza=por fazer, azul=a decorrer, laranja=à espera de
// alguém, verde=fechado bem). Era um quadro Kanban com scroll
// horizontal — no telemóvel (uso real desta app) ficava a maior
// parte fora do ecrã, tinha de se arrastar para o lado para ver as
// colunas seguintes. Secções empilhadas na vertical (mesmo padrão de
// GrupoAcervo/Wiki) mostram logo as quatro, sem arrastar nada.
const COLUNAS = [
  ["fila", "Fila", "var(--cinza)"],
  ["producao", "Produção", "var(--azul)"],
  ["revisao", "Revisão", "var(--laranja)"],
  ["entregue", "Entregue", "var(--verde)"],
];

function diasRestantes(prazoISO) {
  const hoje = new Date().toISOString().slice(0, 10);
  const dias = Math.round((new Date(`${prazoISO}T00:00:00Z`) - new Date(`${hoje}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
  if (dias < 0) return `${-dias}d atrasado`;
  if (dias === 0) return "hoje";
  return `${dias}d`;
}

/** Um mini-card por pedido — cor da barra é o ministério (de quem
 *  pediu, ver SheetAbrirSolicitacao), não o estado: o estado já é a
 *  secção em que está. Arrastável no rato (desktop); no telemóvel o
 *  HTML5 drag-and-drop não funciona bem, por isso a mudança de
 *  estado normal é sempre tocar no card e usar os botões da folha —
 *  arrastar é só um atalho a mais, nunca o único caminho. */
function CardSolicitacao({ s, ministerio, arrastavel, aArrastar, onArrastar, onLargar, onAbrir }) {
  return (
    <div
      className="com-kcard" data-a-arrastar={aArrastar ? 1 : 0}
      draggable={arrastavel}
      onDragStart={() => onArrastar(s)}
      onDragEnd={onLargar}
      onClick={() => onAbrir(s)}
    >
      <div className="com-kcard-barra" style={{ background: ministerio?.cor || "var(--fio)" }} />
      <p className="com-kcard-titulo">{s.titulo}</p>
      <p className="com-kcard-sub">{ministerio?.nome ? `${ministerio.nome} · ` : ""}{nomeBase(s.baseSolicitanteId)}</p>
      <div className="com-kcard-rodape">
        <span className={`tag ${s.foraDoPrazo ? "" : "cinz"}`} style={s.foraDoPrazo ? { background: "var(--magenta)", color: "#fff" } : undefined}>
          {diasRestantes(s.prazo)}
        </span>
        {s.transferePendente ? (
          <span className="tag" style={{ background: "var(--violeta)", color: "#fff" }}>a transferir</span>
        ) : s.responsavelNome ? (
          <span className="com-kcard-resp">{s.responsavelNome}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function Solicitacoes({ uid, papel, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [verRecusadas, setVerRecusadas] = useState(false);
  const [secoesAbertas, setSecoesAbertas] = useState({}); // { [status]: bool } — fechadas por omissão, como a Wiki
  const [arrastando, setArrastando] = useState(null); // solicitação
  const [sheet, setSheet] = useState(null); // { tipo: "abrir" | "ver", solicitacao? }

  useEffect(() => ouvirSolicitacoes(setSolicitacoes), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);

  const ministerioDe = (s) => ministerios.find((m) => m.id === s.ministerioId);
  const ativas = solicitacoes.filter((s) => s.status !== "recusada");
  const recusadas = solicitacoes.filter((s) => s.status === "recusada");
  const porColuna = (status) => ativas.filter((s) => s.status === status).sort((a, b) => (a.prazo < b.prazo ? -1 : 1));

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Solicitações",
      subtitulo: "Pedidos das outras bases",
      chips: [`${porColuna("fila").length} na fila`, `${porColuna("producao").length + porColuna("revisao").length} em curso`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, solicitacoes.length]);

  // Só as transições sem input a pedir (link, motivo) fazem sentido
  // largar direto na coluna — as outras abrem o card, porque a folha
  // já sabe pedir o que falta.
  async function largarEm(novaColuna) {
    const s = arrastando;
    setArrastando(null);
    if (!s || s.status === novaColuna) return;
    try {
      if (s.status === "fila" && novaColuna === "producao") {
        await assumirSolicitacao(s.id);
        torrada("Assumiste este pedido");
      } else if (s.status === "revisao" && novaColuna === "entregue") {
        await mudarStatusSolicitacao({ id: s.id, novoStatus: "entregue" });
        torrada("Marcado como entregue");
      } else if (s.status === "revisao" && novaColuna === "producao") {
        await mudarStatusSolicitacao({ id: s.id, novoStatus: "producao" });
        torrada("Devolvido para produção");
      } else if (s.status === "producao" && novaColuna === "revisao") {
        setSheet({ tipo: "ver", solicitacao: s });
        torrada("Falta o link da entrega — abre o card");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível mover.");
    }
  }

  return (
    <>
      <button className="btn full" style={{ marginTop: 4 }} onClick={() => setSheet({ tipo: "abrir" })}>
        Abrir solicitação
      </button>

      <div className="sect">
        {COLUNAS.map(([status, rotulo, cor]) => {
          const lista = porColuna(status);
          const aberta = !!secoesAbertas[status];
          return (
            <div className="mincartao" key={status} onDragOver={(e) => e.preventDefault()} onDrop={() => largarEm(status)}>
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
                  {lista.map((s) => (
                    <CardSolicitacao
                      key={s.id} s={s} ministerio={ministerioDe(s)}
                      arrastavel={!s.transferePendente}
                      aArrastar={arrastando?.id === s.id}
                      onArrastar={setArrastando}
                      onLargar={() => setArrastando(null)}
                      onAbrir={(sol) => setSheet({ tipo: "ver", solicitacao: sol })}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="btn sec full" style={{ marginTop: 14 }} onClick={() => setVerRecusadas((v) => !v)}>
        {verRecusadas ? "Esconder recusadas" : `Ver recusadas (${recusadas.length})`}
      </button>
      {verRecusadas && (
        <div className="sect">
          {recusadas.length === 0 && <div className="vaz">Nenhuma recusada.</div>}
          {recusadas.map((s) => (
            <div className="linha" style={{ cursor: "pointer" }} key={s.id} onClick={() => setSheet({ tipo: "ver", solicitacao: s })}>
              <div style={{ flex: 1 }}>
                <p className="nmt">{s.titulo}</p>
                <p className="ds">{nomeBase(s.baseSolicitanteId)} · {dataCurta(s.prazo)}</p>
              </div>
              <span className="tag cinz">recusada</span>
            </div>
          ))}
        </div>
      )}

      {sheet?.tipo === "abrir" && (
        <SheetAbrirSolicitacao
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "ver" && (
        <SheetSolicitacao
          solicitacao={solicitacoes.find((s) => s.id === sheet.solicitacao.id) ?? sheet.solicitacao}
          uid={uid} papel={papel} ministerios={ministerios} voluntarios={voluntarios}
          onFechar={() => setSheet(null)}
        />
      )}
    </>
  );
}
