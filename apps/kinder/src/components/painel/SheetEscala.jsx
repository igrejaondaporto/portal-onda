import { useEffect, useState } from "react";
import { guardarEscala, guardarMestraKinder, obterEstatisticasEscala, dispensarBaseDeEvento, reincluirBaseEmEvento } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { BASE_ID } from "@portal/shared/lib/firebase.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import { nomeEvento, dataCurta } from "@portal/shared/lib/data.js";
import { CATEGORIAS, nomeCategoria, varsCategoria } from "../../lib/modelo";

/**
 * Cada toque grava logo no Firestore — não há "guardar" no fim.
 * "Concluir" só fecha a folha.
 *
 * A Kinder não tem um "líder de escala" único: cada sala tem a sua
 * própria Mestra, escolhida entre quem está escalado nessa sala
 * nesse dia (a estrela). Por isso a lista aqui vem sempre agrupada
 * por sala, com uma estrela por grupo — nunca uma só para a folha
 * toda (ver guardarMestraKinder, functions/index.js).
 *
 * `voluntarios` já vem filtrado pela sala de quem está a montar (ver
 * PainelLider — a líder geral vê as três, a líder de sala só a sua);
 * `sala` (o id, só quando restrita) é só para o texto do cabeçalho —
 * a restrição em si já está feita na lista que chega aqui.
 */
export default function SheetEscala({ evento, voluntarios, sala, onFechar, onGuardado, onExcluir }) {
  const torrada = useTorrada();
  const [pessoas, setPessoas] = useState(evento?.escala?.pessoas ?? []);
  const [mestras, setMestras] = useState(evento?.escala?.mestras ?? {});
  const [estatisticas, setEstatisticas] = useState({});
  const [ordem, setOrdem] = useState("vezes");
  const [aDispensar, setADispensar] = useState(false);
  const [dispensada, setDispensada] = useState((evento?.dispensadaPor || []).includes(BASE_ID));

  useEffect(() => { obterEstatisticasEscala(90).then(setEstatisticas); }, []);

  if (!evento) return null;

  // grava otimista (o toque já muda o ecrã), mas se o servidor recusar
  // (ex.: pessoa já escalada nesse dia noutra base) desfaz e avisa —
  // nunca fica um estado no ecrã que não bateu certo com o gravado.
  async function persistirPessoas(novasPessoas, anteriores) {
    try {
      await guardarEscala(evento.id, { pessoas: novasPessoas, liderEscala: null });
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setPessoas(anteriores);
    }
  }

  function alternar(id, catId) {
    const anteriores = pessoas;
    const dentro = pessoas.includes(id);
    const novasPessoas = dentro ? pessoas.filter((x) => x !== id) : [...pessoas, id];
    setPessoas(novasPessoas);
    persistirPessoas(novasPessoas, anteriores);
    // saiu da escala e era a mestra da sala — tira também
    if (dentro && mestras[catId] === id) definirMestra(catId, null);
  }

  function definirMestra(catId, id) {
    const anterior = mestras[catId] ?? null;
    setMestras((m) => ({ ...m, [catId]: id }));
    guardarMestraKinder(evento.id, catId, id).catch((e) => {
      torrada(e.message || "Não foi possível guardar.");
      setMestras((m) => ({ ...m, [catId]: anterior }));
    });
  }

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

  const voluntariosOrdenados = [...voluntarios].sort((a, b) => {
    if (ordem === "nome") return a.nome.localeCompare(b.nome, "pt");
    const va = estatisticas[a.id]?.vezes ?? 0;
    const vb = estatisticas[b.id]?.vezes ?? 0;
    return va - vb || a.nome.localeCompare(b.nome, "pt");
  });

  const salasNaFolha = sala ? CATEGORIAS.filter((c) => c.id === sala) : CATEGORIAS;
  const semSala = sala ? [] : voluntariosOrdenados.filter((p) => !p.categoria);

  function linha(p, catId) {
    const dentro = pessoas.includes(p.id);
    const ehMestra = catId && mestras[catId] === p.id;
    const stat = estatisticas[p.id];
    const semServico = !stat?.vezes;
    const statTexto = semServico
      ? "Ainda não serviu neste trimestre"
      : `${stat.vezes} ${stat.vezes === 1 ? "vez" : "vezes"} · última a ${dataCurta(stat.ultima)}`;
    return (
      <div
        className="opcao" style={{ cursor: "default", ...(semServico ? { background: "rgba(214,32,105,.06)", borderRadius: 12 } : {}) }}
        key={p.id}
      >
        <span
          onClick={() => alternar(p.id, catId)}
          style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer" }}
        >
          <Avatar pessoa={p} tamanho={38} fonte={15} />
          <span style={{ flex: 1 }}>
            <b style={{ fontSize: 15.5, fontWeight: 700 }}>{p.nome}</b>
            <span style={{ display: "block", fontSize: 12, color: "var(--cinza)" }}>
              {dentro ? (ehMestra ? "mestra" : "na escala") : "fora deste culto"}
            </span>
            <span style={{ display: "block", fontSize: 12, marginTop: 2, color: semServico ? "var(--magenta)" : "var(--cinza)", fontWeight: semServico ? 600 : 400 }}>
              {statTexto}
              {stat?.liderVezes ? <span style={{ opacity: 0.75 }}> · {stat.liderVezes}x líder</span> : null}
            </span>
          </span>
        </span>
        {dentro && catId && (
          <button className={`estrela${ehMestra ? " on" : ""}`} onClick={() => definirMestra(catId, ehMestra ? null : p.id)} title="Mestra">
            ★
          </button>
        )}
        <span className={`chk${dentro ? " on" : ""}`} onClick={() => alternar(p.id, catId)} style={{ cursor: "pointer" }}>
          ✓
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{nomeEvento(evento)}</h2>
        <p className="sb2">
          {sala ? `Sala ${nomeCategoria(sala)} · ` : ""}
          {pessoas.filter((id) => voluntarios.some((v) => v.id === id)).length} pessoas · chegada {evento.horaChegada || "08:00"}
        </p>
        <p className="ds" style={{ textAlign: "center", marginTop: 8 }}>
          {sala ? `Só a sala ${nomeCategoria(sala)} aparece aqui. ` : ""}
          Toca no nome para juntar ou tirar da escala. A estrela escolhe a Mestra de cada sala.
        </p>
        <div className="subtabs" style={{ marginTop: 14 }}>
          <button data-on={ordem === "vezes" ? 1 : 0} onClick={() => setOrdem("vezes")}>Menos vezes primeiro</button>
          <button data-on={ordem === "nome" ? 1 : 0} onClick={() => setOrdem("nome")}>Nome</button>
        </div>
        {salasNaFolha.map((c) => {
          const daSala = voluntariosOrdenados.filter((p) => p.categoria === c.id);
          if (!daSala.length) return null;
          return (
            <div key={c.id} style={{ marginTop: 16 }}>
              <p className="rot"><span className="kin-tagcat" style={varsCategoria(c.id)}>{c.nome}</span></p>
              {daSala.map((p) => linha(p, c.id))}
            </div>
          );
        })}
        {semSala.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p className="rot">Sem sala</p>
            {semSala.map((p) => linha(p, null))}
          </div>
        )}
        <button className="btn full" style={{ marginTop: 20 }} onClick={() => onGuardado("Escala atualizada")}>
          Concluir
        </button>
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
