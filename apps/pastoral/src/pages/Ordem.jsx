import { useEffect, useMemo, useState } from "react";
import { ouvirEventos, proximoCulto } from "../lib/culto";
import { limparOrdemCulto, publicarOrdemCulto } from "../lib/pastoral";
import {
  apagarModelo, avisoVazio, duracaoTotal, encadearHoras, guardarModelo, horasDaOrdem,
  limparAvisos, limparMomentos, modeloParaFormulario, momentoVazio, ordemParaFormulario, ouvirModelos,
} from "../lib/ordem";
import { hojeISO, nomeEvento } from "@portal/shared/lib/data.js";
import { TIPOS_CULTO, tipoCultoDefault } from "@portal/shared/lib/tipoCulto.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import OrdemImprimivel from "../components/OrdemImprimivel";
import NavCulto from "../components/NavCulto";

function janela() {
  const h = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(new Date(h.getFullYear(), h.getMonth() + 3, 0))];
}

/**
 * Montar a ordem do culto — o que até agora era um PDF.
 *
 * ── O que isto substitui, e o que não ──────────────────────────
 *
 * O PDF continua a existir e a Backstage continua a poder subi-lo
 * (decisão explícita: nenhum domingo fica dependente de uma tela nova
 * no primeiro mês). O que muda é haver um caminho onde não há nada
 * para adivinhar: `functions/ordemCultoPdf.js` reconstrói uma grelha
 * de seis colunas a partir das coordenadas de cada pedaço de texto, e
 * já engoliu três avisos de quatro por causa disso. Aqui os campos são
 * campos.
 *
 * O documento gravado é o MESMO (`eventos/{e}.ordem`), pela MESMA
 * Cloud Function que a Backstage usa (`publicarOrdemCulto`, com a
 * claim `pode_publicar_culto`). Nenhuma das dez bases precisa de saber
 * de onde veio a ordem que está a ler — é isso que faz esta tela
 * nascer compatível com todas, sem uma linha de código em nenhuma.
 *
 * ── Publica direto ─────────────────────────────────────────────
 *
 * Decisão do dono do produto: o pastor publica, não envia para
 * aprovação. A Backstage continua a poder editar por cima (tem a mesma
 * claim) e continua a ser dona das notas dela, que aparecem por cima
 * da ordem e nunca se confundem com o que o pastor escreveu.
 *
 * ── Publicar continua desligado por omissão (2026-09) ────────────
 *
 * `publicarOrdemCulto` SUBSTITUI o campo `ordem` inteiro — não há
 * merge por secção. Isso é ótimo enquanto só a Backstage publica (é o
 * que já fazia sempre) e perigoso no dia em que duas telas com a mesma
 * claim escrevem no mesmo documento sem se avisarem uma à outra:
 * publicar pelo painel depois de a Backstage já ter subido o PDF apaga
 * o que lá estava, sem aviso nenhum.
 *
 * Por isso `culto.podePublicar` fica `false` em `bases/pastoral`
 * (`scripts/seedPastoral.mjs`) até a equipa decidir mudar para este
 * caminho a sério. **Mas isso já não esconde a tela inteira** (mudou
 * 2026-09): compor, imprimir e guardar modelos nunca tocam no
 * documento partilhado — só `publicarOrdemCulto`/`limparOrdemCulto`
 * tocam, por isso só os botões "Publicar"/"Retirar" ficam desativados
 * sem a claim, com uma legenda a dizer porquê. Pedido explícito do
 * dono do produto: montar a ordem já com a equipa a ver a folha antes
 * de decidir publicar de vez, em vez de uma tela vazia até essa
 * decisão. `podePublicarCulto` (o mesmo booleano que já protege a
 * Cloud Function do lado do servidor) é quem decide os dois botões —
 * sem ele, publicar falharia com permission-denied mesmo carregando
 * no botão, por isso ele nunca aparece clicável sem a claim.
 */
export default function Ordem({ ativo, definirCabecalho, podePublicarCulto }) {
  const torrada = useTorrada();
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState(null);
  const [momentos, setMomentos] = useState([momentoVazio()]);
  const [avisos, setAvisos] = useState([]);
  const [tipoCulto, setTipoCulto] = useState("");
  const [modelos, setModelos] = useState([]);
  const [modelosProntos, setModelosProntos] = useState(false);
  const [aPublicar, setAPublicar] = useState(false);
  const [nomeModelo, setNomeModelo] = useState("");
  const [aGuardarModelo, setAGuardarModelo] = useState(false);
  const [carregadoDe, setCarregadoDe] = useState(null);
  const [aAdicionarTipo, setAAdicionarTipo] = useState(false);
  const [outroTipo, setOutroTipo] = useState("");

  const [de, ate] = useMemo(janela, []);
  const hoje = useMemo(hojeISO, []);

  useEffect(() => ouvirEventos(de, ate, setEventos), [de, ate]);
  // `modelosProntos` marca a primeira emissão — sem isto não dá para
  // distinguir "ainda a carregar" de "carregou e está mesmo vazio", e
  // o culto sem ordem arriscava carregar com uma linha em branco antes
  // do "Domingo típico" chegar a tempo.
  useEffect(() => ouvirModelos((m) => { setModelos(m); setModelosProntos(true); }), []);

  useEffect(() => {
    if (!eventos.length) return;
    setEventoId((atual) => (atual && eventos.some((e) => e.id === atual) ? atual : proximoCulto(eventos, hoje)?.id ?? null));
  }, [eventos, hoje]);

  const evento = eventos.find((e) => e.id === eventoId) ?? null;

  // ao trocar de culto, carrega o que já lá está. Sem ordem nenhuma,
  // começa já da espinha do "Domingo típico" em vez de uma folha em
  // branco (pedido explícito do dono do produto — "já monte baseado
  // na ordem que sempre usamos") — só espera os modelos carregarem
  // uma vez, para não mostrar vazio e trocar logo a seguir debaixo do
  // dedo de quem já estivesse a escrever. `carregadoDe` evita
  // reescrever o formulário a cada emissão do listener de eventos:
  // sem isto, escrever num campo e o snapshot chegar a seguir apagava
  // o que se tinha acabado de escrever.
  useEffect(() => {
    if (!evento || carregadoDe === evento.id) return;
    if (evento.ordem) {
      const form = ordemParaFormulario(evento.ordem);
      setMomentos(form.momentos);
      setAvisos(form.avisos);
      setTipoCulto(evento.tipoCulto || tipoCultoDefault(evento.data));
      setCarregadoDe(evento.id);
      return;
    }
    if (!modelosProntos) return;
    const padrao = modelos.find((m) => m.padrao);
    setMomentos(padrao ? modeloParaFormulario(padrao).momentos : [momentoVazio()]);
    setAvisos([]);
    setTipoCulto(tipoCultoDefault(evento.data));
    setCarregadoDe(evento.id);
  }, [evento, carregadoDe, modelos, modelosProntos]);

  const horas = useMemo(() => horasDaOrdem(momentos), [momentos]);
  const total = duracaoTotal(momentos);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Ordem do culto",
      subtitulo: evento ? nomeEvento(evento) : "Escolhe o culto",
      chips: [
        `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`,
        !podePublicarCulto ? "Rascunho — ainda não publica" : evento?.ordem ? "Já publicada" : "Por publicar",
      ],
    });
  }, [ativo, definirCabecalho, podePublicarCulto, evento, total]);

  /* ── momentos ────────────────────────────────────────────── */
  const atualizar = (i, campo, valor) =>
    setMomentos((ms) => ms.map((m, j) => (j === i ? { ...m, [campo]: valor } : m)));

  function mover(i, d) {
    setMomentos((ms) => {
      const j = i + d;
      if (j < 0 || j >= ms.length) return ms;
      const novo = [...ms];
      [novo[i], novo[j]] = [novo[j], novo[i]];
      return novo;
    });
  }

  const apagar = (i) => setMomentos((ms) => (ms.length === 1 ? [momentoVazio()] : ms.filter((_, j) => j !== i)));

  const atualizarAviso = (i, campo, valor) =>
    setAvisos((as) => as.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));

  /* ── publicar ────────────────────────────────────────────── */
  async function publicar() {
    const ms = limparMomentos(momentos);
    if (!ms.length) return torrada("Põe pelo menos um momento com hora e nome.");
    // além dos fixos, aceita um tipo escrito à mão (ver "+ Outro" mais
    // abaixo) — a validação a sério é a mesma da Cloud Function
    if (!tipoCulto?.trim()) return torrada("Escolhe (ou escreve) o tipo de culto.");

    setAPublicar(true);
    try {
      const r = await publicarOrdemCulto({
        eventoId, momentos: ms, avisos: limparAvisos(avisos),
        inicio: horas.inicio, fim: horas.fim, portasAbertas: horas.portasAbertas,
        // sem PDF — é este o caminho novo. `origem:"manual"` já era
        // aceite pela função (a Backstage grava-o quando o analisador
        // falha e o líder escreve tudo à mão); não é um campo novo.
        pdfUrl: null, origem: "manual", tipoCulto,
      });
      const criados = r.cultosEspeciaisCriados?.length ?? 0;
      torrada(criados
        ? `Publicado — e ${criados} culto${criados === 1 ? "" : "s"} especia${criados === 1 ? "l" : "is"} criado${criados === 1 ? "" : "s"} a partir dos avisos`
        : "Publicado — as dez bases já veem a ordem deste culto");
    } catch (e) {
      torrada(e.message || "Não foi possível publicar.");
    } finally {
      setAPublicar(false);
    }
  }

  async function limpar() {
    setAPublicar(true);
    try {
      await limparOrdemCulto(eventoId);
      setMomentos([momentoVazio()]);
      setAvisos([]);
      torrada("Ordem retirada — este culto voltou a ficar sem ordem publicada.");
    } catch (e) {
      torrada(e.message || "Não foi possível retirar.");
    } finally {
      setAPublicar(false);
    }
  }

  /* ── modelos ─────────────────────────────────────────────── */
  async function guardar() {
    if (!nomeModelo.trim()) return torrada("Dá um nome ao modelo.");
    if (!limparMomentos(momentos).length) return torrada("Não há momentos para guardar.");
    setAGuardarModelo(true);
    try {
      await guardarModelo(null, nomeModelo, momentos);
      setNomeModelo("");
      torrada("Modelo guardado.");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAGuardarModelo(false);
    }
  }

  function carregar(modelo) {
    const form = modeloParaFormulario(modelo);
    setMomentos(form.momentos);
    torrada(`"${modelo.nome}" carregado — as horas e os nomes ficaram, os responsáveis não.`);
  }

  function usarOutroTipo() {
    if (!outroTipo.trim()) return;
    setTipoCulto(outroTipo.trim());
    setOutroTipo("");
    setAAdicionarTipo(false);
  }

  return (
    <>
      <NavCulto
        eventos={eventos} eventoId={eventoId} evento={evento}
        onEscolher={(id) => { setEventoId(id); setCarregadoDe(null); }}
        extra={evento?.ordem ? <span className="tag lim">com ordem</span> : null}
      />

      {!podePublicarCulto && (
        <div className="caixa" style={{ marginTop: 14 }}>
          <p className="ds" style={{ marginTop: 0 }}>
            A ordem oficial continua a subir pela Backstage, em PDF — como sempre. Aqui dá para montar e imprimir
            um rascunho já, mas <b>publicar às dez bases ainda está desligado</b>: publicar por aqui e pela
            Backstage é o mesmo documento, e o segundo a publicar apaga o que o primeiro tinha posto.
          </p>
        </div>
      )}

      {!eventos.length && (
        <div className="vaz" style={{ marginTop: 12 }}>
          Não há cultos nos próximos três meses. Os domingos de cada ano são gerados uma vez, no Painel do líder
          de qualquer base.
        </div>
      )}

      {/* ── modelos ─────────────────────────────────────────── */}
      <div className="sect">
        <div className="cabecalho"><h3>Modelos</h3><span className="cap">{modelos.length}</span></div>
        <p className="ds" style={{ marginTop: 0 }}>
          Carrega a espinha de um domingo típico, ou guarda a de agora como modelo novo. As horas e os nomes
          ficam; os responsáveis não — quem prega muda todas as semanas, e um modelo que trouxesse o nome da
          semana passada publicava o pregador errado.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            className="campo" style={{ marginTop: 0, flex: 1 }} value={nomeModelo}
            placeholder="Guardar isto como modelo" onChange={(e) => setNomeModelo(e.target.value)}
          />
          <button className="btn sec" style={{ flex: "none" }} disabled={aGuardarModelo} onClick={guardar}>Guardar</button>
        </div>
        {modelos.length > 0 && modelos.map((m) => (
          <div className="linha" key={m.id} style={{ marginTop: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="nmt">{m.nome}</p>
              <p className="ds">{m.momentos?.length ?? 0} momentos</p>
            </div>
            <button className="btn sec" style={{ flex: "none" }} onClick={() => carregar(m)}>Usar</button>
            <button
              className="btn sec" style={{ flex: "none", color: "var(--magenta)" }}
              onClick={() => apagarModelo(m.id).then(() => torrada("Modelo apagado."))}
            >
              Apagar
            </button>
          </div>
        ))}
      </div>

      {/* ── os momentos ─────────────────────────────────────── */}
      <div className="sect">
        <div className="cabecalho">
          <h3>Momentos</h3>
          <span className="cap">{Math.floor(total / 60)}h{String(total % 60).padStart(2, "0")} no total</span>
        </div>

        {momentos.map((m, i) => (
          <div className="caixa" key={m._k} style={{ marginTop: i === 0 ? 8 : 10 }}>
            {/* 118px, não 84px: um <input type="time"> pede espaço para
                as duas dezenas E os dois pontos — a 84px o browser
                cortava e só dava para ver a hora, nunca os minutos
                (bug real, reportado 2026-09) */}
            <div style={{ display: "grid", gridTemplateColumns: "118px 1fr", gap: 9 }}>
              <div>
                <input
                  className="campo" style={{ marginTop: 0 }} type="time" value={m.hora}
                  onChange={(e) => atualizar(i, "hora", e.target.value)} aria-label="Hora"
                />
                <p className="cap" style={{ marginTop: 4 }}>Hora</p>
              </div>
              <div>
                <input
                  className="campo" style={{ marginTop: 0 }} value={m.momento} placeholder="O que é (ex.: Louvor)"
                  onChange={(e) => atualizar(i, "momento", e.target.value)} aria-label="Momento"
                />
                <p className="cap" style={{ marginTop: 4 }}>O nome que aparece na ordem</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "118px 1fr", gap: 9, marginTop: 9 }}>
              <div>
                <input
                  className="campo" style={{ marginTop: 0 }} type="number" min="0" inputMode="numeric"
                  value={m.minutos} onChange={(e) => atualizar(i, "minutos", e.target.value)} aria-label="Minutos"
                />
                <p className="cap" style={{ marginTop: 4 }}>Minutos</p>
              </div>
              <div>
                <input
                  className="campo" style={{ marginTop: 0 }} value={m.responsavel ?? ""} placeholder="Quem (opcional)"
                  onChange={(e) => atualizar(i, "responsavel", e.target.value)} aria-label="Responsável"
                />
                <p className="cap" style={{ marginTop: 4 }}>Quem executa (opcional)</p>
              </div>
            </div>
            <div>
              <input
                className="campo" value={m.projecao ?? ""} placeholder="Projeção (opcional)"
                onChange={(e) => atualizar(i, "projecao", e.target.value)} aria-label="Projeção"
              />
              <p className="cap" style={{ marginTop: 4 }}>O que entra no telão (opcional)</p>
            </div>
            <div>
              <input
                className="campo" value={m.detalhe ?? ""} placeholder="Detalhe (opcional)"
                onChange={(e) => atualizar(i, "detalhe", e.target.value)} aria-label="Detalhe"
              />
              <p className="cap" style={{ marginTop: 4 }}>Nota extra para quem monta (opcional)</p>
            </div>
            {/* setas em vez de arrasto: uma dependência a menos e
                funciona melhor a um polegar só — mesma decisão do
                Repertório da Louvor e da checklist da Técnica */}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn sec" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
              <button className="btn sec" onClick={() => mover(i, 1)} disabled={i === momentos.length - 1} aria-label="Descer">↓</button>
              <button className="btn sec" style={{ marginLeft: "auto", color: "var(--magenta)" }} onClick={() => apagar(i)}>
                Apagar
              </button>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn sec" style={{ flex: 1 }} onClick={() => setMomentos((ms) => [...ms, momentoVazio()])}>
            + Momento
          </button>
          <button className="btn sec" style={{ flex: 1 }} onClick={() => setMomentos(encadearHoras)}>
            Recalcular horas
          </button>
        </div>
        <p className="cap" style={{ marginTop: 8 }}>
          "Recalcular horas" reescreve as horas a partir da primeira e das durações. É um botão e não automático:
          um culto pode ter uma folga de propósito entre dois momentos, e recalcular sozinho apagava-a.
        </p>
      </div>

      {/* ── avisos ──────────────────────────────────────────── */}
      <div className="sect">
        <div className="cabecalho"><h3>Avisos</h3><span className="cap">para anunciar no culto</span></div>
        {avisos.map((a, i) => (
          <div className="caixa" key={a._k} style={{ marginTop: i === 0 ? 8 : 10 }}>
            <input
              className="campo" style={{ marginTop: 0 }} value={a.nome} placeholder="O evento (ex.: Conferência)"
              onChange={(e) => atualizarAviso(i, "nome", e.target.value)} aria-label="Evento"
            />
            <input
              className="campo" value={a.data} placeholder="Quando (ex.: 27-28/11)"
              onChange={(e) => atualizarAviso(i, "data", e.target.value)} aria-label="Data"
            />
            <input
              className="campo" value={a.info ?? ""} placeholder="Informações (opcional)"
              onChange={(e) => atualizarAviso(i, "info", e.target.value)} aria-label="Informações"
            />
            {/* dd/mm — é o formato que publicarOrdemCulto sabe
                transformar num evento; com outro, ignora em silêncio,
                por isso o texto de ajuda diz qual é */}
            <div className="menu" style={{ position: "static", border: 0, padding: "10px 0 0", background: "none", backdropFilter: "none" }}>
              <button data-on={a.criarCulto ? "0" : "1"} onClick={() => atualizarAviso(i, "criarCulto", false)}>Só avisar</button>
              <button data-on={a.criarCulto ? "1" : "0"} onClick={() => atualizarAviso(i, "criarCulto", true)}>Criar culto</button>
            </div>
            {a.criarCulto && (
              <p className="cap" style={{ marginTop: 6 }}>
                Cria um culto especial nessa data, se a data estiver em dd/mm. Nunca sobrescreve um culto que já exista.
              </p>
            )}
            <button
              className="btn sec full" style={{ marginTop: 10, color: "var(--magenta)" }}
              onClick={() => setAvisos((as) => as.filter((_, j) => j !== i))}
            >
              Apagar aviso
            </button>
          </div>
        ))}
        <button className="btn sec full" style={{ marginTop: 12 }} onClick={() => setAvisos((as) => [...as, avisoVazio()])}>
          + Aviso
        </button>
      </div>

      {/* ── tipo de culto ───────────────────────────────────── */}
      <div className="sect">
        <div className="cabecalho"><h3>Tipo de culto</h3></div>
        <p className="ds" style={{ marginTop: 0 }}>
          Obrigatório. É por aqui que a Louvor sabe o que preparar, e é uma decisão de quem publica a ordem —
          não de cada base por si.
        </p>
        <div className="menu" style={{ position: "static", border: 0, padding: "10px 0 0", background: "none", backdropFilter: "none" }}>
          {TIPOS_CULTO.map((t) => (
            <button key={t.id} data-on={tipoCulto === t.id ? "1" : "0"} onClick={() => { setTipoCulto(t.id); setAAdicionarTipo(false); }}>{t.nome}</button>
          ))}
          {/* um tipo escrito à mão (ex.: "Culto de Natal") também
              aparece aqui como botão, escolhido, até se trocar de
              culto — não é gravado numa lista partilhada nenhuma, só
              vale para esta ordem (publicarOrdemCulto já aceita
              qualquer texto não vazio, ver functions/index.js) */}
          {tipoCulto && !TIPOS_CULTO.some((t) => t.id === tipoCulto) && (
            <button data-on="1">{tipoCulto}</button>
          )}
          <button data-on={aAdicionarTipo ? "1" : "0"} onClick={() => setAAdicionarTipo((v) => !v)}>+ Outro</button>
        </div>
        {aAdicionarTipo && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              className="campo" style={{ marginTop: 0, flex: 1 }} value={outroTipo}
              placeholder="Nome do tipo de culto" onChange={(e) => setOutroTipo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && usarOutroTipo()}
            />
            <button className="btn sec" style={{ flex: "none" }} onClick={usarOutroTipo}>Usar</button>
          </div>
        )}
      </div>

      {/* ── resumo e publicar ───────────────────────────────── */}
      <div className="caixa" style={{ marginTop: 18, background: "var(--agua)", borderColor: "transparent" }}>
        <p className="ds" style={{ marginTop: 0 }}>
          Portas <b>{horas.portasAbertas ?? "—"}</b> · começa <b>{horas.inicio ?? "—"}</b> · acaba <b>{horas.fim ?? "—"}</b>
        </p>
        <p className="cap" style={{ marginTop: 6 }}>
          As portas abrem à hora da Contagem, não à do Pré-culto — é o que a Base Pessoal usa para saber quando abrir.
        </p>
      </div>

      <button
        className="btn full" style={{ marginTop: 14 }}
        disabled={aPublicar || !eventoId || !podePublicarCulto}
        onClick={publicar}
      >
        {aPublicar ? "A publicar…" : evento?.ordem ? "Republicar às dez bases" : "Publicar às dez bases"}
      </button>
      {!podePublicarCulto && (
        <p className="cap" style={{ marginTop: 6, textAlign: "center" }}>Desligado até a equipa decidir ativar.</p>
      )}

      {/* imprime o que está no formulário, publicado ou não — quem
          monta quer ver a folha antes de publicar, e não depois. O
          diálogo do browser dá "Guardar como PDF" na mesma. */}
      <button
        className="btn sec full" style={{ marginTop: 8 }}
        disabled={!limparMomentos(momentos).length}
        onClick={() => window.print()}
      >
        Imprimir / guardar em PDF
      </button>

      {evento?.ordem && podePublicarCulto && (
        <button className="btn sec full" style={{ marginTop: 8, marginBottom: 20, color: "var(--magenta)" }} disabled={aPublicar} onClick={limpar}>
          Retirar a ordem deste culto
        </button>
      )}

      {/* fica sempre montado e escondido fora da impressão: montar só
          ao carregar em Imprimir arriscava o window.print disparar
          antes de o React pintar, e a folha saía em branco */}
      <OrdemImprimivel
        evento={evento}
        momentos={limparMomentos(momentos)}
        avisos={limparAvisos(avisos)}
        horas={horas}
      />
    </>
  );
}
