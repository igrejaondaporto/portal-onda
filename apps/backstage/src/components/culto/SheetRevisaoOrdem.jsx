import { useMemo, useState } from "react";
import { publicarOrdemCulto } from "../../lib/culto";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";
import { TIPOS_CULTO, tipoCultoDefault } from "@portal/shared/lib/tipoCulto.js";

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
    // `data` vem do analisador (functions/ordemCultoPdf.js) como null
    // sempre que a data do aviso não é um DD/MM inequívoco ("09/out",
    // "26/set" — comum) — nunca "" garantido. Sem o `?? ""` aqui, o
    // campo <input value={a.data}> deste aviso ficava com `null` como
    // valor controlado (React trata como não controlado — o campo
    // parece normal, mas o estado por trás continua `null`).
    () => inicial.avisos.map((a) => ({ _k: chave(), criarCulto: false, ...a, data: a.data ?? "" }))
  );
  // Tipo de culto (Ceia/Contribua/Culto da Família) — obrigatório,
  // pedido do líder da Louvor: é a Backstage que decide, ao publicar,
  // não cada base por si (ver publicarOrdemCulto, functions/index.js).
  // Pré-escolhido com o mesmo default que a Louvor já usava (1º
  // domingo do mês = Ceia), ou o que já estiver gravado se for uma
  // republicação.
  const [tipoCulto, setTipoCulto] = useState(evento.tipoCulto || tipoCultoDefault(evento.data));
  const [aEnviar, setAEnviar] = useState(false);
  const [aConfirmarCancelar, setAConfirmarCancelar] = useState(false);

  const { inicio, fim, portasAbertas } = useMemo(() => {
    const validos = momentos.filter((m) => /^\d{1,2}:\d{2}$/.test(m.hora) && Number(m.minutos) > 0);
    if (!validos.length) return { inicio: null, fim: null, portasAbertas: null };
    const u = validos.at(-1);
    const [h, mi] = u.hora.split(":").map(Number);
    const t = h * 60 + mi + Number(u.minutos);
    // as portas abrem sempre à hora da Contagem, não do Pré-culto
    const contagem = validos.find((m) => /contagem/i.test(m.momento));
    return {
      inicio: validos[0].hora,
      fim: `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
      portasAbertas: contagem?.hora ?? validos[0].hora,
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

  // "Cancelar" fica logo abaixo de "Publicar para a base" — um toque
  // um pouco mais baixo do que o pretendido acertava aqui e fechava a
  // folha na hora, sem aviso nenhum e sem gravar nada (reportado
  // 2026-09: parecia "o botão de publicar não faz nada"). Só pede
  // confirmação quando já há algo para perder — a folha em branco,
  // antes de qualquer preenchimento, continua a fechar direto.
  function pedirCancelar() {
    const temConteudo = momentos.some((m) => m.hora.trim() || m.momento.trim());
    if (temConteudo) setAConfirmarCancelar(true);
    else onFechar();
  }

  async function publicar() {
    const momentosLimpos = momentos
      .filter((m) => m.hora.trim() && m.momento.trim())
      .map(({ _k, ...m }) => ({
        hora: m.hora.trim(), momento: m.momento.trim(), minutos: Number(m.minutos) || 0,
        projecao: m.projecao?.trim() || null, responsavel: m.responsavel?.trim() || null,
        detalhe: m.detalhe?.trim() || null,
      }));
    if (!momentosLimpos.length) return torrada("Adiciona pelo menos um momento com hora e nome.");

    // `a.data` pode ser null (aviso sem data inequívoca, vindo direto
    // do analisador sem passar por atualizarAviso) — a causa real do
    // bug "toco em Publicar e não acontece nada": `a.data.trim()` sem
    // guarda lançava aqui, ANTES do try/catch de baixo, e o toque
    // nunca chegava a pedir nada ao servidor (reportado 2026-09,
    // reproduzido com o PDF real de 27/09: "CULTO DE MULHERES" tinha
    // data:null por vir escrita "09/out", não DD/MM).
    const avisosLimpos = avisos
      .filter((a) => a.nome.trim())
      .map(({ _k, ...a }) => ({ ...a, nome: a.nome.trim(), data: (a.data ?? "").trim(), info: a.info?.trim() || "" }));

    setAEnviar(true);
    try {
      const r = await publicarOrdemCulto({
        eventoId: evento.id, momentos: momentosLimpos, avisos: avisosLimpos,
        inicio, fim, portasAbertas, pdfUrl: inicial.pdfUrl ?? null, origem: inicial.falhou ? "manual" : "auto",
        tipoCulto,
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

        <label className="rot" style={{ marginTop: 12 }}>Tipo de culto</label>
        <div className="subtabs">
          {TIPOS_CULTO.map((t) => (
            <button key={t.id} data-on={tipoCulto === t.id ? 1 : 0} onClick={() => setTipoCulto(t.id)}>{t.nome}</button>
          ))}
        </div>

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

        {!aConfirmarCancelar && (
          <button className="btn full" style={{ marginTop: 20 }} disabled={aEnviar} onClick={publicar}>
            {aEnviar ? "A publicar…" : "Publicar para a base"}
          </button>
        )}
        {!aConfirmarCancelar ? (
          <button className="btn sec full" style={{ marginTop: 9 }} disabled={aEnviar} onClick={pedirCancelar}>Cancelar</button>
        ) : (
          <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Sair sem publicar?</p>
            <p className="ds" style={{ marginTop: 4 }}>
              Os momentos revistos aqui perdem-se — o PDF continua guardado, mas ninguém vê esta ordem até voltares a rever e publicar.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }} onClick={onFechar}>
                Sair sem publicar
              </button>
              <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} onClick={() => setAConfirmarCancelar(false)}>
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
