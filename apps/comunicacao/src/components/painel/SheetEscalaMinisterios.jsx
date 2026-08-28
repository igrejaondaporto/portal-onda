import { useState } from "react";
import { guardarEscala, dispensarBaseDeEvento, reincluirBaseEmEvento, obterEstatisticasEscala } from "../../lib/painel";
import { obterRespostas } from "../../lib/enquetes";
import { sugerirLugares, indisponiveisNoCulto } from "../../lib/sugestor";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { BASE_ID } from "@portal/shared/lib/firebase.js";
import { nomeEvento } from "@portal/shared/lib/data.js";

/** Lista aberta de pessoas por ministério — nasce com um lugar vazio,
 *  "+ Adicionar pessoa" acrescenta mais (dois fotógrafos, dois do
 *  Storymaker, o que for preciso nesse culto). Sem titular/aprendiz
 *  fixos: essa etiqueta continua a existir na pessoa (Painel do líder
 *  → Ministérios), só deixou de limitar a escala a 2 lugares. Guarda
 *  tudo de uma vez (ao contrário da Apoio, que grava a cada toque)
 *  porque há uma regra a confirmar antes de gravar: ninguém em dois
 *  lugares.
 *
 *  Ao contrário da Técnica, não há "Responsável"/líder de culto
 *  rotativo aqui — a Comunicação só tem o líder da base fixo (ver
 *  organograma). `liderEscala` fica sempre por definir. */
export default function SheetEscalaMinisterios({ evento, ministerios, voluntarios, onFechar, onGuardado, onExcluir }) {
  const torrada = useTorrada();
  const [aDispensar, setADispensar] = useState(false);
  const [dispensada, setDispensada] = useState((evento?.dispensadaPor || []).includes(BASE_ID));

  async function alternarDispensa() {
    setADispensar(true);
    try {
      if (dispensada) {
        await reincluirBaseEmEvento(evento.id);
        setDispensada(false);
        torrada("De volta à escala deste evento");
      } else {
        await dispensarBaseDeEvento(evento.id);
        setDispensada(true);
        torrada("A base não serve neste evento");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    } finally {
      setADispensar(false);
    }
  }

  const [lugares, setLugares] = useState(() =>
    ministerios.map((m) => {
      const existente = evento?.escala?.lugares?.find((l) => l.ministerioId === m.id);
      const pessoas = existente?.pessoas?.filter(Boolean) ?? [];
      return { ministerioId: m.id, pessoas: pessoas.length ? pessoas : [null] };
    })
  );
  const [aGuardar, setAGuardar] = useState(false);
  const [aSugerir, setASugerir] = useState(false);

  if (!evento) return null;

  // só IFs, sem IA (ver lib/sugestor.js) — preenche o que está vazio,
  // nunca troca quem o líder já escolheu à mão. Vai buscar a enquete
  // de indisponibilidade do mês deste culto (evento.id é "AAAA-MM-DD")
  // para não sugerir quem marcou que não pode — se não houver enquete
  // nesse mês, segue sem essa restrição, nunca trava por causa disso.
  async function sugerir() {
    setASugerir(true);
    try {
      const mes = evento.id.slice(0, 7);
      const [estatisticas, respostas] = await Promise.all([
        obterEstatisticasEscala(90),
        obterRespostas(mes).catch(() => []),
      ]);
      const indisponiveis = indisponiveisNoCulto(respostas, evento.id);
      setLugares((atual) => sugerirLugares(ministerios, voluntarios, estatisticas, atual, indisponiveis));
      if (indisponiveis.size) torrada(`${indisponiveis.size} pessoa${indisponiveis.size === 1 ? "" : "s"} de fora por indisponibilidade`);
    } catch (e) {
      torrada(e.message || "Não foi possível sugerir.");
    } finally {
      setASugerir(false);
    }
  }

  const pessoasDoMinisterio = (ministerioId) =>
    voluntarios.filter((p) => p.ministerios?.[ministerioId]);

  function definirPessoa(ministerioId, indice, valor) {
    setLugares((atual) => atual.map((l) => {
      if (l.ministerioId !== ministerioId) return l;
      const pessoas = [...l.pessoas];
      pessoas[indice] = valor || null;
      return { ...l, pessoas };
    }));
  }

  function adicionarLugar(ministerioId) {
    setLugares((atual) => atual.map((l) =>
      l.ministerioId === ministerioId ? { ...l, pessoas: [...l.pessoas, null] } : l));
  }

  function removerLugar(ministerioId, indice) {
    setLugares((atual) => atual.map((l) => {
      if (l.ministerioId !== ministerioId) return l;
      const pessoas = l.pessoas.filter((_, i) => i !== indice);
      return { ...l, pessoas: pessoas.length ? pessoas : [null] }; // fica sempre pelo menos um lugar visível
    }));
  }

  async function guardar() {
    const limpos = lugares.map((l) => ({ ministerioId: l.ministerioId, pessoas: l.pessoas.filter(Boolean) }));
    const usados = new Set();
    for (const l of limpos) {
      for (const id of l.pessoas) {
        if (usados.has(id)) return torrada("Alguém está em dois lugares ao mesmo tempo — corrige antes de guardar.");
        usados.add(id);
      }
    }
    setAGuardar(true);
    try {
      await guardarEscala(evento.id, { liderEscala: null, lugares: limpos });
      onGuardado("Escala atualizada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{nomeEvento(evento)}</h2>
        <p className="sb2">Quem serve em cada ministério · chegada {evento.horaChegada || "08:30"}</p>

        <button className="btn sec full" style={{ marginTop: 14 }} disabled={aSugerir} onClick={sugerir}>
          {aSugerir ? "A sugerir…" : "Sugestão automática"}
        </button>
        <p className="ds" style={{ marginTop: 6 }}>Preenche só os lugares vazios, com quem serviu há mais tempo. Revê antes de guardar.</p>

        {ministerios.map((m) => {
          const lugar = lugares.find((l) => l.ministerioId === m.id);
          const candidatos = pessoasDoMinisterio(m.id);
          return (
            <div key={m.id} className="caixa" style={{ marginTop: 14 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: m.cor }}>{m.nome}</p>
              {lugar.pessoas.map((pessoaId, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <select
                    className="campo" style={{ flex: 1 }} value={pessoaId ?? ""}
                    onChange={(e) => definirPessoa(m.id, i, e.target.value)}
                  >
                    <option value="">Por definir</option>
                    {candidatos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  {lugar.pessoas.length > 1 && (
                    <button
                      type="button" className="oc-icobt mag" aria-label={`Remover lugar ${i + 1} de ${m.nome}`}
                      onClick={() => removerLugar(m.id, i)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button" className="btn sec" style={{ marginTop: 8, fontSize: 12.5, padding: "8px 14px" }}
                onClick={() => adicionarLugar(m.id)}
              >
                + Adicionar pessoa
              </button>
            </div>
          );
        })}

        <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar} onClick={guardar}>
          {aGuardar ? "A guardar…" : "Guardar escala"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
        {evento.escopo === "global" && (
          <button className="btn sec full" style={{ marginTop: 9 }} disabled={aDispensar} onClick={alternarDispensa}>
            {aDispensar ? "A atualizar…" : dispensada ? "Voltar a servir neste evento" : "Esta base não serve neste evento"}
          </button>
        )}
        {evento.tipo && onExcluir && (
          <button
            className="btn sec full"
            style={{ marginTop: 9, color: "var(--magenta)" }}
            onClick={() => onExcluir(evento.id)}
          >
            Excluir este culto
          </button>
        )}
      </div>
    </>
  );
}
