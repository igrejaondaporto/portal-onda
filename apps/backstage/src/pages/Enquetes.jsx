import { useEffect, useState } from "react";
import { ouvirVoluntarios, obterEventosDoMes } from "../lib/painel";
import { ouvirEnquetesMontar, ouvirUltimasEnquetes, ouvirRespostas, obterEventosPorIds, fecharEnquete, reabrirEnquete, textoWhatsApp, linkWhatsApp } from "../lib/enquetes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso, dataCurta, MESES } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import SheetAbrirEnquete from "../components/painel/SheetAbrirEnquete";

const telefoneWa = (t) => "351" + String(t || "").replace(/\D/g, "").replace(/^351/, "");

/** Sem ministérios nesta base (ver CLAUDE.md) — a diferença para o
 *  cartão da Técnica é só essa: uma lista plana de respostas, sem
 *  agrupar por ministério e sem o Sugestor de escala (que é uma
 *  ferramenta em cima de titular/aprendiz por ministério, que a
 *  Backstage não tem). O líder monta a escala à mão no ecrã Escala,
 *  como já faz hoje, usando as respostas daqui como referência. */
function LinhaResposta({ pessoa, resposta: r, domingos, eventosPorId }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--fio)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <Avatar pessoa={pessoa} tamanho={34} fonte={13} />
        <div style={{ flex: 1 }}>
          <p className="nmt">{pessoa.nome}</p>
          <p className="ds">
            {r.semIndisponibilidade
              ? "Sem indisponibilidades"
              : `Indisponível em ${r.indisponivelEm.length} culto${r.indisponivelEm.length === 1 ? "" : "s"}`}
          </p>
        </div>
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

function CartaoEnquete({ enquete, voluntarios, eventosPorId }) {
  const torrada = useTorrada();
  const [respostas, setRespostas] = useState([]);
  const [aFechar, setAFechar] = useState(false);
  const [aReabrir, setAReabrir] = useState(false);
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
    const texto = `Olá ${pessoa.nome.split(" ")[0]}, ainda não recebi a tua resposta à enquete de indisponibilidades. Podes responder no Início do portal? 🙏`;
    window.open(`https://wa.me/${telefoneWa(pessoa.telefone)}?text=${encodeURIComponent(texto)}`, "_blank");
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
        <LinhaResposta key={r.id} pessoa={pessoa} resposta={r} domingos={enquete.domingos} eventosPorId={eventosPorId} />
      ))}

      {naoResponderam.length > 0 && (
        <>
          <label className="rot" style={{ marginTop: 16 }}>Ainda não respondeu ({naoResponderam.length})</label>
          {naoResponderam.map((p) => (
            <div className="linha" key={p.id}>
              <Avatar pessoa={p} tamanho={34} fonte={13} />
              <div style={{ flex: 1 }}><p className="nmt">{p.nome}</p></div>
              <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} onClick={() => lembrar(p)}>Lembrar</button>
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
    <div className="sect">
      <div className="cabecalho"><h3>Últimas enquetes</h3></div>
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

export default function Enquetes({ ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const hoje = new Date();
  const [voluntarios, setVoluntarios] = useState([]);
  const [enquetesMontar, setEnquetesMontar] = useState(undefined); // undefined = ainda a carregar
  const [eventosPorId, setEventosPorId] = useState({});
  const [sheet, setSheet] = useState(null);
  const [escalaMesQueVemCriada, setEscalaMesQueVemCriada] = useState(null); // null = ainda a verificar

  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirEnquetesMontar(setEnquetesMontar), []);
  useEffect(() => {
    const ids = [...new Set((enquetesMontar || []).flatMap((e) => e.domingos || []))];
    if (!ids.length) { setEventosPorId({}); return; }
    obterEventosPorIds(ids).then(setEventosPorId);
  }, [enquetesMontar]);

  // o alerta de "manda a enquete" só faz sentido enquanto a escala do
  // mês seguinte ainda não tiver sido montada — checa direto nos
  // eventos, não só na existência de uma enquete (ver CLAUDE.md raiz)
  useEffect(() => {
    const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    obterEventosDoMes(proximo.getFullYear(), proximo.getMonth()).then((eventos) => {
      const criada = eventos.some((e) => (e.escala?.pessoas || []).length > 0);
      setEscalaMesQueVemCriada(criada);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({ titulo: "Enquetes", subtitulo: "Indisponibilidade e escala do mês", chips: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  const abertas = (enquetesMontar || []).filter((e) => e.estado === "aberta");
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  const mesQueVemId = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, "0")}`;
  const jaHaEnqueteDoMesQueVem = (enquetesMontar || []).some((e) => e.id === mesQueVemId);
  const semEnqueteParaOMesQueVem =
    Array.isArray(enquetesMontar) && hoje.getDate() >= 15
    && escalaMesQueVemCriada === false && !jaHaEnqueteDoMesQueVem;

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(textoWhatsApp(abertas.map((e) => ({ mes: e.id, prazo: e.prazo }))));
      torrada("Texto copiado");
    } catch {
      torrada("Não foi possível copiar — copia manualmente.");
    }
  }

  return (
    <>
      <div className="sect">
        {enquetesMontar === undefined && <div className="vaz">A carregar…</div>}

        {enquetesMontar !== undefined && abertas.length === 0 && (
          <>
            {semEnqueteParaOMesQueVem && (
              <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--magenta)" }}>Ainda não há enquete para o mês que vem</p>
                <p className="ds" style={{ marginTop: 4 }}>Já passou o dia 15 — é boa altura para abrir.</p>
              </div>
            )}
            <div className="cabecalho"><h3>Enquete de indisponibilidade</h3></div>
            <div className="vaz">Nenhuma enquete aberta agora.</div>
            <button className="btn full" style={{ marginTop: 12 }} onClick={() => setSheet({ tipo: "abrirEnquete" })}>
              Abrir enquete
            </button>
          </>
        )}

        {abertas.length > 0 && (
          <>
            <div className="cabecalho"><h3>Texto pronto para o WhatsApp</h3></div>
            <p style={{ lineHeight: 1.6, fontSize: 13.5, whiteSpace: "pre-wrap" }}>
              {textoWhatsApp(abertas.map((e) => ({ mes: e.id, prazo: e.prazo })))}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} onClick={copiarTexto}>Copiar texto</button>
              <a
                className="btn" style={{ flex: 1, fontSize: 12.5, textAlign: "center" }}
                href={linkWhatsApp(textoWhatsApp(abertas.map((e) => ({ mes: e.id, prazo: e.prazo }))))}
                target="_blank" rel="noreferrer"
              >
                Abrir WhatsApp
              </a>
            </div>
          </>
        )}

        {(enquetesMontar || []).map((e) => (
          <CartaoEnquete key={e.id} enquete={e} voluntarios={voluntarios} eventosPorId={eventosPorId} />
        ))}
      </div>

      <UltimasEnquetes voluntarios={voluntarios} />

      {sheet?.tipo === "abrirEnquete" && (
        <SheetAbrirEnquete
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
