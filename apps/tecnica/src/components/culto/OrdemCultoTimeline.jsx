import { useEffect, useState } from "react";
import { MESES } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { iniciarCultoAoVivo, descartarCultoAoVivo, editarSecaoAoVivo, sondarFreeshowAgora } from "../../lib/cultoAoVivo";
import { normalizarNome, cruzarComReal, calcularPrevisoes, marcarPuladas } from "@portal/shared/lib/ordemAoVivo.js";

const NOSSOS = /volunt|café dos|pré-culto/i;
const paraMinutos = (hora) => { const [h, m] = hora.split(":").map(Number); return h * 60 + m; };
const somarMinutos = (hora, minutos) => {
  if (!hora) return null;
  const t = paraMinutos(hora) + minutos;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** Verde até 5 min de atraso, laranja até 10, vermelho acima disso —
 *  começar adiantado conta sempre como verde. */
function corAtraso(horaReal, horaPrevista) {
  if (!horaReal || !horaPrevista) return null;
  const atrasoMin = paraMinutos(horaReal) - paraMinutos(horaPrevista);
  if (atrasoMin <= 5) return "tec-atraso-verde";
  if (atrasoMin <= 10) return "tec-atraso-laranja";
  return "tec-atraso-vermelho";
}

const formatarCronometro = (ms) => {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeg / 60)}:${String(totalSeg % 60).padStart(2, "0")}`;
};

/** Onde estamos agora, em relação ao previsto — só usado quando ainda
 *  não há registo ao vivo (culto de hoje que ainda não começou a
 *  gravar) ou nos cultos passados/futuros, sem FreeShow nenhum. */
function calcularAgoraPrevisto(momentos) {
  if (!momentos.length) return { fase: "sem-horas" };
  const agora = new Date();
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  if (minAgora < paraMinutos(momentos[0].hora)) return { fase: "antes" };
  for (let i = 0; i < momentos.length; i++) {
    const inicio = paraMinutos(momentos[i].hora);
    const fim = inicio + Number(momentos[i].minutos || 0);
    if (minAgora >= inicio && minAgora < fim) return { fase: "durante", indice: i };
  }
  return { fase: "depois" };
}

/** A cronologia nativa que os voluntários veem — sem clicar em nada.
 *  Espelha a vista de resultado do culto-transcrito.html. No culto de
 *  hoje, cruza o previsto (do PDF) com o real (do FreeShow, via
 *  eventos/{e}/cultoAoVivo/registo) — o horário real fica em destaque,
 *  o previsto vira referência ao lado; secções ainda por vir mostram
 *  a previsão em cascata, recalculada a partir do atraso real
 *  acumulado até aqui (ver @portal/shared/lib/ordemAoVivo.js). */
export default function OrdemCultoTimeline({ ordem, chegada, hoje, eventoId, aoVivo }) {
  const torrada = useTorrada();
  const [, reavaliar] = useState(0);
  const [aEditar, setAEditar] = useState(null); // chave normalizada do momento em edição
  const [horaRascunho, setHoraRascunho] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [aIniciar, setAIniciar] = useState(false);
  const [aConfirmarDescartar, setAConfirmarDescartar] = useState(false);

  // a cada segundo enquanto se grava — é o que faz o cronómetro contar
  // e a bolinha de progresso andar sozinhos, sem depender de cliques
  useEffect(() => {
    const gravando = aoVivo?.estado === "gravando";
    if (!hoje && !gravando) return;
    const id = setInterval(() => reavaliar((n) => n + 1), gravando ? 1000 : 30000);
    return () => clearInterval(id);
  }, [hoje, aoVivo?.estado]);

  // enquanto este ecrã estiver aberto e o culto estiver mesmo a
  // gravar, pede à sonda para correr a cada poucos segundos, em vez de
  // esperar pelo próximo minuto do agendador — só acelera quem está a
  // olhar agora; a sonda automática continua a correr por trás na mesma
  useEffect(() => {
    if (aoVivo?.estado !== "gravando") return;
    const id = setInterval(() => { sondarFreeshowAgora().catch(() => {}); }, 5000);
    return () => clearInterval(id);
  }, [aoVivo?.estado]);

  if (!ordem) return null;

  const estado = aoVivo?.estado ?? null;
  const secoesReais = aoVivo?.secoesReais ?? [];
  const { linhas } = cruzarComReal(ordem.momentos, secoesReais);
  const comPrevisao = marcarPuladas(calcularPrevisoes(linhas));

  // a secção atual vem de secaoAtualId (só a sonda escreve isto) —
  // NUNCA do último item de secoesReais: esse array também recebe
  // edições manuais fora de ordem, e "agora" não pode saltar para o
  // que alguém acabou de corrigir à mão enquanto o FreeShow está
  // mesmo é noutra secção qualquer.
  const secaoAoVivo = estado === "gravando" && aoVivo?.secaoAtualId
    ? secoesReais.find((s) => s.idFreeshow === aoVivo.secaoAtualId) : null;
  const chaveAtualAoVivo = secaoAoVivo
    ? normalizarNome(secaoAoVivo.nomeCorrespondente || secaoAoVivo.nomeFreeshow) : null;
  // só faz sentido comparar com o relógio quando ainda não há nada
  // gravado — depois disso, "agora" é sempre o que o FreeShow diz
  const agoraPrevisto = hoje && !estado ? calcularAgoraPrevisto(ordem.momentos) : null;

  async function iniciar() {
    setAIniciar(true);
    try {
      await iniciarCultoAoVivo(eventoId);
      torrada("A gravar os horários reais deste culto");
    } catch (e) {
      torrada(e.message || "Não foi possível começar a gravar.");
    } finally {
      setAIniciar(false);
    }
  }

  async function descartar() {
    setAIniciar(true);
    try {
      await descartarCultoAoVivo(eventoId);
      setAConfirmarDescartar(false);
      torrada("Registo apagado — pronto para recomeçar");
    } catch (e) {
      torrada(e.message || "Não foi possível descartar.");
    } finally {
      setAIniciar(false);
    }
  }

  function abrirEdicao(l) {
    setAEditar(normalizarNome(l.momento));
    setHoraRascunho(l.real?.horaReal || l.horaPrevista || l.hora);
  }

  async function guardarEdicao(nomeMomento) {
    if (!/^\d{1,2}:\d{2}$/.test(horaRascunho)) return torrada("Escreve uma hora válida.");
    setAGuardar(true);
    try {
      await editarSecaoAoVivo(eventoId, nomeMomento, horaRascunho);
      setAEditar(null);
    } catch (e) {
      torrada(e.message || "Não foi possível guardar a hora.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="oc-nossa">
        <div className="l"><span>Chegada da Base</span><b>{chegada}</b></div>
        <div className="l"><span>Portas abertas</span><b>{ordem.portasAbertas ?? ordem.inicio ?? "—"}</b></div>
        <div className="l"><span>Fim do culto</span><b>{ordem.fim ?? "—"}</b></div>
        <div className="l"><span>Arrumação a partir de</span><b>{somarMinutos(ordem.fim, 10) ?? "—"}</b></div>
      </div>

      <div className="tec-aovivo-barra">
        {estado === "gravando" ? (
          <>
            <span className="tec-aovivo-ponto" /> A gravar os horários reais
            {aoVivo?.iniciadoPor === "automatico" ? " · começou sozinho" : ""}
            {!aConfirmarDescartar ? (
              <button className="btn sec" style={{ marginLeft: "auto", padding: "7px 12px", fontSize: 12 }} onClick={() => setAConfirmarDescartar(true)}>
                Descartar e recomeçar
              </button>
            ) : (
              <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button className="btn" style={{ background: "var(--magenta)", padding: "7px 12px", fontSize: 12 }} disabled={aIniciar} onClick={descartar}>
                  Confirmar
                </button>
                <button className="btn sec" style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => setAConfirmarDescartar(false)}>Cancelar</button>
              </span>
            )}
          </>
        ) : estado === "terminado" ? (
          <>Culto terminado — os horários reais ficaram registados.</>
        ) : (
          <button className="btn full" disabled={aIniciar} onClick={iniciar}>
            {aIniciar ? "A começar…" : "Começou o culto"}
          </button>
        )}
      </div>

      {agoraPrevisto?.fase === "antes" && (
        <p className="ds" style={{ margin: "0 0 4px", color: "var(--magenta)", fontWeight: 600 }}>
          Ainda não começou — abre às {ordem.inicio}
        </p>
      )}
      {agoraPrevisto?.fase === "depois" && (
        <p className="ds" style={{ margin: "0 0 4px" }}>Este culto já terminou.</p>
      )}

      <div>
        {comPrevisao.map((l, i) => {
          const chave = normalizarNome(l.momento);
          const atual = chave === chaveAtualAoVivo || (!chaveAtualAoVivo && agoraPrevisto?.indice === i);
          // já passou por aqui (tem hora real e não é a que está no ar)
          // — pinta a bolinha e o trilho de verde para mostrar que já
          // foi percorrido, à parte da cor do horário (que é sobre
          // atraso, não sobre "já aconteceu")
          const passada = !!l.real && !atual;
          const emEdicao = aEditar === chave;
          // previsão para a secção que está mesmo agora no ar = hora
          // real de início + duração prevista do PDF — não o horário
          // estático que estava previsto para ela começar (esse já não
          // interessa, já sabemos quando começou de verdade)
          const previstoExibido = atual ? (somarMinutos(l.real?.horaReal, Number(l.minutos)) ?? l.hora) : l.hora;
          // cronómetro: enquanto é a atual, conta ao vivo desde que
          // recebeu o sinal; assim que passa a outra secção, fica
          // parado com o tempo que durou de verdade (duracaoRealMs)
          const cronometroMs = atual && l.real?.timestampReal?.toMillis
            ? Date.now() - l.real.timestampReal.toMillis() : null;
          // oc-destaque (ponto lima, "isto é da tua base") só antes de
          // haver registo ao vivo — com gravação a decorrer, o ponto é
          // sempre cinza/rosa/verde conforme o estado real, nunca lima,
          // senão as duas cores entram em conflito na mesma bolinha
          const classes = `oc-mom${(NOSSOS.test(l.momento) && !estado) ? " oc-destaque" : ""}${atual ? " agora" : ""}${passada ? " tec-passada" : ""}`;
          return (
            <div className={classes} key={i}>
              <div className="oc-hora">
                {l.real ? (
                  <>
                    <b className={`tec-hora-real ${corAtraso(l.real.horaReal, l.hora) || ""}`}>{l.real.horaReal}</b>
                    <span>{l.extra ? "não previsto" : `previsto ${previstoExibido}`}</span>
                  </>
                ) : l.pulada ? (
                  <>
                    <b className="tec-hora-pulada">—</b>
                    <span>{l.hora}</span>
                  </>
                ) : estado ? (
                  <>
                    <b className="tec-hora-prevista">{l.horaPrevista}</b>
                    <span>previsão</span>
                  </>
                ) : (
                  <>
                    <b>{l.hora}</b>
                    <span>{l.minutos}min</span>
                  </>
                )}
              </div>
              <div className="oc-trilho" />
              <div className="txt">
                <p className="nm">
                  {l.momento}
                  {atual && <span className="oc-agora">agora</span>}
                  {atual && cronometroMs != null && <span className="tec-cronometro">{formatarCronometro(cronometroMs)}</span>}
                  {passada && l.duracaoRealMs != null && <span className="tec-duracao">{formatarCronometro(l.duracaoRealMs)}</span>}
                  {l.real?.editadoManualmente && <span className="tec-editado-marca" title="Hora escrita à mão">editado</span>}
                </p>
                <p className="meta">{[l.responsavel, l.projecao].filter(Boolean).join(" · ") || "—"}</p>
                {l.detalhe && /volunt/i.test(l.detalhe) && <span className="oc-marca">{l.detalhe}</span>}

                {estado && (
                  emEdicao ? (
                    <span className="tec-editar-hora-form">
                      <input
                        className="campo" type="time" value={horaRascunho}
                        onChange={(e) => setHoraRascunho(e.target.value)}
                      />
                      <button className="btn sec" style={{ padding: "7px 12px", fontSize: 12 }} disabled={aGuardar} onClick={() => guardarEdicao(l.momento)}>
                        {aGuardar ? "…" : "Guardar"}
                      </button>
                      <button className="btn sec" style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => setAEditar(null)}>Cancelar</button>
                    </span>
                  ) : (
                    <button className="tec-editar-hora" onClick={() => abrirEdicao(l)}>
                      {l.real ? "Corrigir hora" : "Marcar hora à mão"}
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {ordem.avisos?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p className="cap">Avisos locais</p>
          {ordem.avisos.map((a, i) => {
            const [d, mm] = String(a.data || "").split("/");
            return (
              <div className="oc-aviso" key={i}>
                <span className="oc-dt"><b>{d}</b><span>{MESES[Number(mm) - 1]?.slice(0, 3).toLowerCase()}</span></span>
                <div style={{ flex: 1 }}>
                  <p className="nm" style={{ fontSize: 14.5, fontWeight: 700 }}>{a.nome}</p>
                  <p className="ds">{a.info}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ordem.pdfUrl && (
        <a
          className="btn sec full" href={ordem.pdfUrl} target="_blank" rel="noreferrer"
          style={{ marginTop: 16, textDecoration: "none", display: "block", textAlign: "center" }}
        >
          Ver o PDF original
        </a>
      )}
    </>
  );
}
