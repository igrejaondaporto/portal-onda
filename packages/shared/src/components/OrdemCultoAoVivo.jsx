import { useEffect, useState } from "react";
import { normalizarNome, cruzarComReal, calcularPrevisoes, marcarPuladas } from "../lib/ordemAoVivo.js";
import { sondarFreeshowAgora } from "../lib/cultoAoVivo.js";
import AvisosLocais from "./AvisosLocais.jsx";

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
  if (atrasoMin <= 5) return "oc-atraso-verde";
  if (atrasoMin <= 10) return "oc-atraso-laranja";
  return "oc-atraso-vermelho";
}

const formatarCronometro = (ms) => {
  const totalSeg = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeg / 60)}:${String(totalSeg % 60).padStart(2, "0")}`;
};

/** Onde estamos agora, em relação ao previsto — só usado quando ainda
 *  não há registo ao vivo (culto de hoje que ainda não começou a
 *  gravar, ou nunca vai começar porque não é a Técnica) ou nos cultos
 *  passados/futuros, sem FreeShow nenhum. */
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

/** A cronologia da ordem do culto, com o horário real por cima do
 * previsto sempre que a Técnica estiver a gravar (`aoVivo`) — sem
 * nada para editar aqui, só leitura; quem inicia/corrige é sempre a
 * Técnica (ver apps/tecnica/src/lib/cultoAoVivo.js). Mesmo desenho da
 * versão da Técnica, sem os controlos — se um dia isto precisar de
 * deixar de estar duplicado entre as duas, portar a Técnica para usar
 * este componente também (com um `podeEditar`), não o inverso. */
export default function OrdemCultoAoVivo({ ordem, chegada, hoje, aoVivo }) {
  const [, reavaliar] = useState(0);

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

  const secaoAoVivo = estado === "gravando" && aoVivo?.secaoAtualId
    ? secoesReais.find((s) => s.idFreeshow === aoVivo.secaoAtualId) : null;
  const chaveAtualAoVivo = secaoAoVivo
    ? normalizarNome(secaoAoVivo.nomeCorrespondente || secaoAoVivo.nomeFreeshow) : null;
  const agoraPrevisto = hoje && !estado ? calcularAgoraPrevisto(ordem.momentos) : null;

  return (
    <>
      <div className="oc-nossa">
        <div className="l"><span>Chegada da Base</span><b>{chegada}</b></div>
        <div className="l"><span>Portas abertas</span><b>{ordem.portasAbertas ?? ordem.inicio ?? "—"}</b></div>
        <div className="l"><span>Fim do culto</span><b>{ordem.fim ?? "—"}</b></div>
        <div className="l"><span>Arrumação a partir de</span><b>{somarMinutos(ordem.fim, 10) ?? "—"}</b></div>
      </div>

      {estado === "gravando" && (
        <p className="oc-aovivo-estado">
          <span className="oc-aovivo-ponto" /> Horário em tempo real do culto
        </p>
      )}
      {estado === "terminado" && (
        <p className="ds" style={{ margin: "0 0 10px" }}>Culto terminado — os horários reais ficaram registados.</p>
      )}

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
          const passada = !!l.real && !atual;
          const previstoExibido = atual ? (somarMinutos(l.real?.horaReal, Number(l.minutos)) ?? l.hora) : l.hora;
          const cronometroMs = atual && l.real?.timestampReal?.toMillis
            ? Date.now() - l.real.timestampReal.toMillis() : null;
          const classes = `oc-mom${(NOSSOS.test(l.momento) && !estado) ? " oc-destaque" : ""}${atual ? " agora" : ""}${passada ? " oc-passada" : ""}`;
          return (
            <div className={classes} key={i}>
              <div className="oc-hora">
                {l.real ? (
                  <>
                    <b className={`oc-hora-real ${corAtraso(l.real.horaReal, l.hora) || ""}`}>{l.real.horaReal}</b>
                    {/* "não previsto" é só um sinal para a Técnica corrigir
                     * (ver OrdemCultoTimeline.jsx) — quem só lê vê a hora
                     * real como qualquer outra secção, sem aviso nenhum */}
                    {!l.extra && <span>previsto {previstoExibido}</span>}
                  </>
                ) : l.pulada ? (
                  <>
                    <b className="oc-hora-pulada">—</b>
                    <span>{l.hora}</span>
                  </>
                ) : estado ? (
                  <>
                    <b className="oc-hora-prevista">{l.horaPrevista}</b>
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
                  {atual && cronometroMs != null && <span className="oc-cronometro">{formatarCronometro(cronometroMs)}</span>}
                  {passada && l.duracaoRealMs != null && <span className="oc-duracao">{formatarCronometro(l.duracaoRealMs)}</span>}
                  {l.real?.editadoManualmente && <span className="oc-editado-marca" title="Hora escrita à mão pela Técnica">editado</span>}
                </p>
                <p className="meta">{[l.responsavel, l.projecao].filter(Boolean).join(" · ") || "—"}</p>
                {l.detalhe && /volunt/i.test(l.detalhe) && <span className="oc-marca">{l.detalhe}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <AvisosLocais avisos={ordem.avisos} style={{ marginTop: 20 }} />

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
