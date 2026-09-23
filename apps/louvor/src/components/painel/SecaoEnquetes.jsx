import { useEffect, useState } from "react";
import {
  ouvirEnquetesGestao, ouvirUltimasEnquetes, ouvirRespostas, obterEventosPorIds,
  fecharEnquete, reabrirEnquete, excluirEnquete, linkWhatsApp,
} from "../../lib/enquetes";
import { useMensagensEnquete, dominioDaBase } from "@portal/shared/lib/useMensagensEnquete.js";
import { textoEnquete, textoLembrete } from "@portal/shared/lib/mensagensEnquete.js";
import EditarMensagemEnquete from "@portal/shared/components/EditarMensagemEnquete.jsx";
import { obterEventosDoMes } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso, dataCurta, MESES } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import SheetAbrirEnquete from "./SheetAbrirEnquete";
import SheetResponderEnquete from "../SheetResponderEnquete";

/**
 * Gestão da enquete de indisponibilidade, dentro do Painel do líder —
 * copiado do padrão da Backstage (lib/enquetes.js + Enquetes.jsx),
 * SEM o "Montar escala" (é uma ferramenta em cima de titular/aprendiz
 * por ministério que a Backstage/Técnica têm — a Louvor não pediu
 * sugestor automático, o rascunho de escala é o mecanismo de montar a
 * escala em cima da votação aqui, ver SecaoRascunhos.jsx).
 */
const telefoneWa = (t) => "351" + String(t || "").replace(/\D/g, "").replace(/^351/, "");

function LinhaResposta({ pessoa, resposta: r, domingos, eventosPorId, onEditar }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--fio)", cursor: "pointer" }} onClick={onEditar}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <Avatar pessoa={pessoa} tamanho={34} fonte={13} />
        <div style={{ flex: 1 }}>
          <p className="nmt">
            {pessoa.nome}
            {r.respondidoPeloLider && <span className="ds" style={{ marginLeft: 6 }}>(respondido pelo líder)</span>}
          </p>
          <p className="ds">
            {r.semIndisponibilidade
              ? "Sem indisponibilidades"
              : `Indisponível em ${r.indisponivelEm.length} culto${r.indisponivelEm.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <span className="seta">✏️</span>
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8, marginLeft: 47 }}>
        {(domingos || []).map((id) => {
          const ev = eventosPorId[id];
          const indisponivel = !r.semIndisponibilidade && (r.indisponivelEm || []).includes(id);
          return (
            <span
              key={id}
              style={{
                fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 100, color: "#fff",
                background: indisponivel ? "var(--magenta)" : "var(--verde)",
              }}
            >
              {dataCurta(ev?.data || id)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CartaoEnquete({ enquete, voluntarios, eventosPorId, onExcluida }) {
  const torrada = useTorrada();
  const { mensagens, guardar: guardarMensagem } = useMensagensEnquete();
  const [respostas, setRespostas] = useState([]);
  const [aFechar, setAFechar] = useState(false);
  const [aReabrir, setAReabrir] = useState(false);
  const [aConfirmarExcluir, setAConfirmarExcluir] = useState(false);
  const [aExcluir, setAExcluir] = useState(false);
  const [respostaAlvo, setRespostaAlvo] = useState(null); // { pessoa, resposta|null } — edição/voto pelo líder
  const fechada = enquete.estado === "fechada";

  useEffect(() => ouvirRespostas(enquete.id, setRespostas), [enquete.id]);

  const responderamIds = new Set(respostas.map((r) => r.id));
  const naoResponderam = voluntarios.filter((p) => !responderamIds.has(p.id));
  const respostasComPessoa = respostas
    .map((r) => ({ resposta: r, pessoa: voluntarios.find((p) => p.id === r.id) }))
    .filter((x) => x.pessoa);

  async function fechar() {
    setAFechar(true);
    try {
      await fecharEnquete(enquete.id);
      torrada("Enquete fechada");
    } catch (e) {
      torrada(e.message || "Não foi possível fechar a enquete.");
    } finally {
      setAFechar(false);
    }
  }

  async function reabrir() {
    setAReabrir(true);
    try {
      await reabrirEnquete(enquete.id);
      torrada("Enquete reaberta");
    } catch (e) {
      torrada(e.message || "Não foi possível reabrir a enquete.");
    } finally {
      setAReabrir(false);
    }
  }

  function lembrar(pessoa) {
    const texto = textoLembrete(mensagens.lembrete, pessoa);
    window.open(`https://wa.me/${telefoneWa(pessoa.telefone)}?text=${encodeURIComponent(texto)}`, "_blank");
  }

  async function excluir() {
    setAExcluir(true);
    try {
      await excluirEnquete(enquete.id);
      torrada("Enquete excluída");
      onExcluida?.();
    } catch (e) {
      torrada(e.message || "Não foi possível excluir.");
      setAExcluir(false);
    }
  }

  return (
    <div className="caixa" style={{ marginTop: 14 }}>
      <div className="cabecalho">
        <h3>Enquete de {MESES[Number(enquete.id.split("-")[1]) - 1]}</h3>
        <span className={`tag ${fechada ? "cinz" : "lim"}`}>{fechada ? "fechada" : "aberta"}</span>
      </div>
      <p className="ds" style={{ padding: "6px 0 2px" }}>Prazo até {dataPorExtenso(enquete.prazo)}</p>
      <p className="ds">
        {(enquete.domingos || []).map((id) => eventosPorId[id]?.tipo || dataPorExtenso(eventosPorId[id]?.data || id)).join(" · ")}
      </p>

      <label className="rot" style={{ marginTop: 16 }}>Respondeu ({respostas.length}/{voluntarios.length})</label>
      {respostasComPessoa.map(({ resposta: r, pessoa }) => (
        <LinhaResposta
          key={r.id} pessoa={pessoa} resposta={r} domingos={enquete.domingos} eventosPorId={eventosPorId}
          onEditar={() => setRespostaAlvo({ pessoa, resposta: r })}
        />
      ))}

      {naoResponderam.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
            <label className="rot" style={{ marginTop: 0 }}>Ainda não respondeu ({naoResponderam.length})</label>
            <EditarMensagemEnquete
              tipo="lembrete" rotulo="Editar mensagem" mensagens={mensagens} guardar={guardarMensagem}
              dominio={dominioDaBase()} nomeExemplo={naoResponderam[0]?.nome?.split(" ")[0]}
            />
          </div>
          {naoResponderam.map((p) => (
            <div className="linha" key={p.id}>
              <Avatar pessoa={p} tamanho={34} fonte={13} />
              <div style={{ flex: 1 }}><p className="nmt">{p.nome}</p></div>
              <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} onClick={() => lembrar(p)}>Lembrar</button>
              <button
                className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5, marginLeft: 6 }}
                onClick={() => setRespostaAlvo({ pessoa: p, resposta: null })}
              >
                Votar
              </button>
            </div>
          ))}
        </>
      )}

      {fechada ? (
        <button className="btn sec full" style={{ marginTop: 16 }} disabled={aReabrir} onClick={reabrir}>
          {aReabrir ? "A reabrir…" : "🔒 Reabrir"}
        </button>
      ) : (
        <button className="btn sec full" style={{ marginTop: 16 }} disabled={aFechar} onClick={fechar}>
          {aFechar ? "A fechar…" : "Fechar enquete"}
        </button>
      )}

      {aConfirmarExcluir ? (
        <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 9 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>Excluir esta enquete?</p>
          <p className="ds" style={{ marginTop: 4 }}>As respostas apagam-se junto. Não afeta a escala já gravada.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }} disabled={aExcluir} onClick={excluir}>
              {aExcluir ? "A excluir…" : "Excluir"}
            </button>
            <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aExcluir} onClick={() => setAConfirmarExcluir(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={() => setAConfirmarExcluir(true)}>
          Excluir enquete
        </button>
      )}

      {respostaAlvo && (
        <SheetResponderEnquete
          enquetes={[enquete]}
          eventosPorId={eventosPorId}
          minhasRespostas={respostaAlvo.resposta ? { [enquete.id]: respostaAlvo.resposta } : {}}
          pessoaAlvo={{ id: respostaAlvo.pessoa.id, nome: respostaAlvo.pessoa.nome }}
          onFechar={() => setRespostaAlvo(null)}
          onGuardado={(msg) => { setRespostaAlvo(null); torrada(msg); }}
        />
      )}
    </div>
  );
}

function UltimasEnquetes({ voluntarios }) {
  const [enquetes, setEnquetes] = useState([]);
  const [eventosPorId, setEventosPorId] = useState({});
  const [expandida, setExpandida] = useState(null);

  useEffect(() => ouvirUltimasEnquetes(3, setEnquetes), []);
  useEffect(() => {
    const ids = [...new Set(enquetes.flatMap((e) => e.domingos || []))];
    if (!ids.length) { setEventosPorId({}); return; }
    obterEventosPorIds(ids).then(setEventosPorId);
  }, [enquetes]);

  if (!enquetes.length) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <label className="rot">Últimas enquetes</label>
      {enquetes.map((e) => {
        const aberta = expandida === e.id;
        return (
          <div key={e.id}>
            <div className="linha" style={{ cursor: "pointer" }} onClick={() => setExpandida(aberta ? null : e.id)}>
              <div style={{ flex: 1 }}>
                <p className="nmt">Enquete de {MESES[Number(e.id.split("-")[1]) - 1]}</p>
                <p className="ds">{e.estado === "aberta" ? "Aberta" : "Fechada"} · prazo {dataPorExtenso(e.prazo)}</p>
              </div>
              <span className="seta">{aberta ? "︿" : "›"}</span>
            </div>
            {aberta && (
              <>
                <CartaoEnquete enquete={e} voluntarios={voluntarios} eventosPorId={eventosPorId} />
                <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setExpandida(null)}>Ocultar</button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SecaoEnquetes({ voluntarios }) {
  const torrada = useTorrada();
  const { mensagens, guardar: guardarMensagem } = useMensagensEnquete();
  const hoje = new Date();
  const [enquetesGestao, setEnquetesGestao] = useState(undefined); // undefined = ainda a carregar
  const [eventosPorId, setEventosPorId] = useState({});
  const [sheet, setSheet] = useState(null);
  const [escalaMesQueVemCriada, setEscalaMesQueVemCriada] = useState(null); // null = ainda a verificar

  useEffect(() => ouvirEnquetesGestao(setEnquetesGestao), []);
  useEffect(() => {
    const ids = [...new Set((enquetesGestao || []).flatMap((e) => e.domingos || []))];
    if (!ids.length) { setEventosPorId({}); return; }
    obterEventosPorIds(ids).then(setEventosPorId);
  }, [enquetesGestao]);

  // o alerta de "manda a enquete" só faz sentido enquanto a escala do
  // mês seguinte ainda não tiver sido montada
  useEffect(() => {
    const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    obterEventosDoMes(proximo.getFullYear(), proximo.getMonth()).then((eventos) => {
      const criada = eventos.some((e) => (e.escala?.pessoas || []).length > 0);
      setEscalaMesQueVemCriada(criada);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abertas = (enquetesGestao || []).filter((e) => e.estado === "aberta");
  const listaAbertas = abertas.map((e) => ({ mes: e.id, prazo: e.prazo }));
  const textoGrupo = textoEnquete(mensagens.enquete, listaAbertas, dominioDaBase());
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  const mesQueVemId = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, "0")}`;
  const jaHaEnqueteDoMesQueVem = (enquetesGestao || []).some((e) => e.id === mesQueVemId);
  const semEnqueteParaOMesQueVem =
    Array.isArray(enquetesGestao) && hoje.getDate() >= 15
    && escalaMesQueVemCriada === false && !jaHaEnqueteDoMesQueVem;

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(textoGrupo);
      torrada("Texto copiado");
    } catch {
      torrada("Não foi possível copiar — copia manualmente.");
    }
  }

  return (
    <div className="sect">
      <div className="cabecalho">
        <h3>Enquete de indisponibilidade</h3>
        <button className="btn sec" style={{ padding: "8px 15px", fontSize: 13 }} onClick={() => setSheet({ tipo: "abrirEnquete" })}>
          Abrir enquete
        </button>
      </div>

      {enquetesGestao === undefined && <div className="vaz">A carregar…</div>}

      {enquetesGestao !== undefined && abertas.length === 0 && (
        <>
          {semEnqueteParaOMesQueVem && (
            <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--magenta)" }}>Ainda não há enquete para o mês que vem</p>
              <p className="ds" style={{ marginTop: 4 }}>Já passou o dia 15 — é boa altura para abrir.</p>
            </div>
          )}
          <div className="vaz">Nenhuma enquete aberta agora.</div>
        </>
      )}

      {abertas.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <label className="rot">Texto pronto para o WhatsApp</label>
            <EditarMensagemEnquete
              tipo="enquete" mensagens={mensagens} guardar={guardarMensagem}
              enquetes={listaAbertas} dominio={dominioDaBase()}
            />
          </div>
          <p style={{ lineHeight: 1.6, fontSize: 13.5, whiteSpace: "pre-wrap" }}>
            {textoGrupo}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} onClick={copiarTexto}>Copiar texto</button>
            <a
              className="btn" style={{ flex: 1, fontSize: 12.5, textAlign: "center" }}
              href={linkWhatsApp(textoGrupo)}
              target="_blank" rel="noreferrer"
            >
              Abrir WhatsApp
            </a>
          </div>
        </>
      )}

      {(enquetesGestao || []).map((e) => (
        <CartaoEnquete key={e.id} enquete={e} voluntarios={voluntarios} eventosPorId={eventosPorId} />
      ))}

      <UltimasEnquetes voluntarios={voluntarios} />

      {sheet?.tipo === "abrirEnquete" && (
        <SheetAbrirEnquete
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </div>
  );
}
