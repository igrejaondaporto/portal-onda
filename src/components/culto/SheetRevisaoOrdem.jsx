import { useMemo, useState } from "react";
import { publicarOrdemCulto } from "../../lib/culto";
import { useTorrada } from "../../lib/TorradaContext";
import { dataPorExtenso } from "../../lib/data";

let contador = 0;
const chave = () => `l${Date.now()}_${contador++}`;

const linhaVazia = () => ({ _k: chave(), hora: "", momento: "", minutos: 5, responsavel: "", projecao: "", detalhe: "" });
const avisoVazio = () => ({ _k: chave(), nome: "", data: "", info: "", criarCulto: false });

/** Rede de segurança do analisador automático: o líder revê, corrige,
 *  apaga, reordena e só grava quando carregar em Publicar. */
export default function SheetRevisaoOrdem({ evento, inicial, onFechar, onPublicado }) {
  const torrada = useTorrada();
  const [momentos, setMomentos] = useState(
    () => (inicial.momentos.length ? inicial.momentos : [linhaVazia()])
      .map((m) => ({ _k: chave(), projecao: "", detalhe: "", responsavel: "", ...m, minutos: m.minutos ?? 5 }))
  );
  const [avisos, setAvisos] = useState(
    () => inicial.avisos.map((a) => ({ _k: chave(), criarCulto: false, ...a }))
  );
  const [aEnviar, setAEnviar] = useState(false);

  const { inicio, fim } = useMemo(() => {
    const validos = momentos.filter((m) => /^\d{1,2}:\d{2}$/.test(m.hora) && Number(m.minutos) > 0);
    if (!validos.length) return { inicio: null, fim: null };
    const u = validos.at(-1);
    const [h, mi] = u.hora.split(":").map(Number);
    const t = h * 60 + mi + Number(u.minutos);
    return {
      inicio: validos[0].hora,
      fim: `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
    };
  }, [momentos]);

  function atualizarMomento(i, campo, valor) {
    setMomentos((ms) => ms.map((m, j) => (j === i ? { ...m, [campo]: valor } : m)));
  }
  function moverMomento(i, d) {
    setMomentos((ms) => {
      const j = i + d;
      if (j < 0 || j >= ms.length) return ms;
      const novo = [...ms];
      [novo[i], novo[j]] = [novo[j], novo[i]];
      return novo;
    });
  }
  const apagarMomento = (i) => setMomentos((ms) => ms.filter((_, j) => j !== i));
  const novaLinha = () => setMomentos((ms) => [...ms, linhaVazia()]);

  function atualizarAviso(i, campo, valor) {
    setAvisos((as) => as.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));
  }
  const apagarAviso = (i) => setAvisos((as) => as.filter((_, j) => j !== i));
  const novoAviso = () => setAvisos((as) => [...as, avisoVazio()]);

  async function publicar() {
    const momentosLimpos = momentos
      .filter((m) => m.hora.trim() && m.momento.trim())
      .map(({ _k, ...m }) => ({
        hora: m.hora.trim(), momento: m.momento.trim(), minutos: Number(m.minutos) || 0,
        projecao: m.projecao?.trim() || null, responsavel: m.responsavel?.trim() || null,
        detalhe: m.detalhe?.trim() || null,
      }));
    if (!momentosLimpos.length) return torrada("Adiciona pelo menos um momento com hora e nome.");

    const avisosLimpos = avisos
      .filter((a) => a.nome.trim())
      .map(({ _k, ...a }) => ({ ...a, nome: a.nome.trim(), data: a.data.trim(), info: a.info?.trim() || "" }));

    setAEnviar(true);
    try {
      const r = await publicarOrdemCulto({
        eventoId: evento.id, momentos: momentosLimpos, avisos: avisosLimpos,
        inicio, fim, pdfUrl: inicial.pdfUrl ?? null, origem: inicial.falhou ? "manual" : "auto",
      });
      torrada(
        r.cultosEspeciaisCriados?.length
          ? `Publicado — e ${r.cultosEspeciaisCriados.length} culto${r.cultosEspeciaisCriados.length === 1 ? "" : "s"} especial${r.cultosEspeciaisCriados.length === 1 ? "" : "is"} criado${r.cultosEspeciaisCriados.length === 1 ? "" : "s"} a partir dos avisos`
          : "Publicado — a base já vê a ordem do culto"
      );
      onPublicado(r.cultosEspeciaisCriados || []);
    } catch (e) {
      torrada(e.message || "Não foi possível publicar.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label="Rever a ordem do culto">
        <div className="pux" />
        <h2>Rever a ordem do culto</h2>
        <p className="sb2">{dataPorExtenso(evento.data)}</p>

        {inicial.falhou && (
          <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 12 }}>
            <p style={{ fontSize: 13, color: "var(--magenta)", fontWeight: 600 }}>
              Não consegui ler a tabela deste PDF automaticamente.
            </p>
            <p className="ds" style={{ marginTop: 4 }}>
              O PDF já ficou guardado — preenche os momentos à mão abaixo, ou fecha e deixa só o PDF para os voluntários.
            </p>
          </div>
        )}

        <p className="rot" style={{ marginTop: 16 }}>Momentos ({momentos.length})</p>
        {momentos.map((m, i) => (
          <div className="oc-linha" key={m._k}>
            <div className="campos">
              <input
                value={m.hora} onChange={(e) => atualizarMomento(i, "hora", e.target.value)}
                placeholder="10:30" inputMode="numeric"
              />
              <input
                value={m.momento} onChange={(e) => atualizarMomento(i, "momento", e.target.value)}
                placeholder="Momento"
              />
              <input
                value={m.minutos} onChange={(e) => atualizarMomento(i, "minutos", e.target.value)}
                placeholder="min" inputMode="numeric"
              />
            </div>
            <input
              value={m.responsavel ?? ""} onChange={(e) => atualizarMomento(i, "responsavel", e.target.value)}
              placeholder="Responsável (ex.: Pr. Nome)" style={{ marginTop: 8 }}
            />
            <input
              value={m.detalhe ?? ""} onChange={(e) => atualizarMomento(i, "detalhe", e.target.value)}
              placeholder="Detalhe (ex.: TODOS OS VOLUNTÁRIOS)" style={{ marginTop: 8 }}
            />
            <div className="acoes">
              <button className="oc-icobt" disabled={i === 0} onClick={() => moverMomento(i, -1)} title="Subir">↑</button>
              <button className="oc-icobt" disabled={i === momentos.length - 1} onClick={() => moverMomento(i, 1)} title="Descer">↓</button>
              <button className="oc-icobt mag" onClick={() => apagarMomento(i)} title="Apagar">✕</button>
            </div>
          </div>
        ))}
        <button className="btn sec full" style={{ marginTop: 10 }} onClick={novaLinha}>Acrescentar momento</button>

        {avisos.length > 0 || inicial.avisos.length > 0 ? (
          <>
            <p className="rot" style={{ marginTop: 20 }}>Avisos locais ({avisos.length})</p>
            {avisos.map((a, i) => (
              <div className="oc-avisoEd" key={a._k}>
                <input value={a.nome} onChange={(e) => atualizarAviso(i, "nome", e.target.value)} placeholder="Nome do evento" />
                <div className="campos" style={{ gridTemplateColumns: "76px 1fr", marginTop: 8 }}>
                  <input value={a.data} onChange={(e) => atualizarAviso(i, "data", e.target.value)} placeholder="DD/MM" />
                  <input value={a.info} onChange={(e) => atualizarAviso(i, "info", e.target.value)} placeholder="Onde / detalhe" />
                </div>
                <div className="oc-toggle">
                  <span>Criar culto na escala</span>
                  <button
                    type="button" className="oc-sw" data-on={a.criarCulto ? 1 : 0}
                    onClick={() => atualizarAviso(i, "criarCulto", !a.criarCulto)}
                    aria-label="Criar culto na escala para este aviso"
                  />
                </div>
                <div className="acoes">
                  <button className="oc-icobt mag" onClick={() => apagarAviso(i)} title="Apagar">✕</button>
                </div>
              </div>
            ))}
            <button className="btn sec full" style={{ marginTop: 10 }} onClick={novoAviso}>Acrescentar aviso</button>
            <p className="ds" style={{ marginTop: 10, lineHeight: 1.5 }}>
              Os avisos com o interruptor ligado entram na escala como cultos especiais, prontos a receber voluntários
              e funções — sem sobrescrever nenhum culto que já exista nesse dia.
            </p>
          </>
        ) : null}

        <button className="btn full" style={{ marginTop: 20 }} disabled={aEnviar} onClick={publicar}>
          {aEnviar ? "A publicar…" : "Publicar para a base"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} disabled={aEnviar} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
