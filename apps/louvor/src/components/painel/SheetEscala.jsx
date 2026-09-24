import { useEffect, useState } from "react";
import { guardarEscala, obterEstatisticasEscala, dispensarBaseDeEvento, reincluirBaseEmEvento } from "../../lib/painel";
import { publicarEscala } from "../../lib/rascunho";
import { nomePapel, papeisAtivos } from "../../lib/modelo";
import { usePapeisEscala } from "../../lib/PapeisEscalaContext.jsx";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { BASE_ID } from "@portal/shared/lib/firebase.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import { nomeEvento, dataCurta } from "@portal/shared/lib/data.js";

/**
 * Cada toque grava logo no Firestore — não há "guardar" no fim.
 * Agrupado por instrumento (`pessoa.instrumentos`, definido no perfil
 * em SheetPessoa.jsx) — cada bloco só lista quem toca aquilo, como um
 * "ministério" dentro da base. Quem toca mais do que um aparece em
 * mais do que um bloco; escalar num bloco onde já está escalado
 * noutro move-a para aqui (nunca em dois papéis ao mesmo tempo, ver
 * guardarEscalaLouvor). Quem não tem nenhum instrumento no perfil
 * (não canta nem toca nada — fica só "Voluntário" no papel de base,
 * ver PainelLider.jsx) nem aparece aqui — pedido do líder, 2026-09:
 * essas pessoas não servem em papel nenhum da escala.
 *
 * `aoMudar(escalados, liderEscala)`, se vier, substitui a escrita
 * direta na escala ao vivo (guardarEscala) — é o que SecaoRascunhos
 * usa para reaproveitar esta mesma interação num item de rascunho,
 * que só grava a valer quando o rascunho inteiro é guardado. Nesse
 * caso `evento` é um objeto sintético (id do culto real + o
 * escalados/liderEscala do item), sem `escopo`/`tipo` — "dispensar" e
 * "excluir culto" não fazem sentido a meio de um rascunho.
 */
export default function SheetEscala({ evento, voluntarios, onFechar, onGuardado, onExcluir, aoMudar }) {
  const torrada = useTorrada();
  const papeis = usePapeisEscala();
  const [escalados, setEscalados] = useState(evento?.escala?.escalados ?? []);
  const [liderEscala, setLiderEscala] = useState(evento?.escala?.liderEscala ?? null);
  const [estatisticas, setEstatisticas] = useState({});
  const [ordem, setOrdem] = useState("vezes");
  const [aDispensar, setADispensar] = useState(false);
  const [dispensada, setDispensada] = useState((evento?.dispensadaPor || []).includes(BASE_ID));
  const [publicado, setPublicado] = useState(!!evento?.escala?.publicado);
  const [aPublicar, setAPublicar] = useState(false);

  useEffect(() => { obterEstatisticasEscala(90).then(setEstatisticas); }, []);

  if (!evento) return null;

  // grava otimista (o toque já muda o ecrã), mas se o servidor recusar
  // desfaz e avisa — nunca fica um estado no ecrã que não bateu certo
  // com o gravado.
  async function persistir(novosEscalados, novoLider, anterior) {
    if (aoMudar) { aoMudar(novosEscalados, novoLider); return; }
    try {
      await guardarEscala(evento.id, { escalados: novosEscalados, liderEscala: novoLider });
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setEscalados(anterior.escalados);
      setLiderEscala(anterior.liderEscala);
    }
  }

  function tirar(id) {
    const anterior = { escalados, liderEscala };
    const novosEscalados = escalados.filter((e) => e.pessoaId !== id);
    const novoLider = liderEscala === id ? null : liderEscala;
    setEscalados(novosEscalados);
    setLiderEscala(novoLider);
    persistir(novosEscalados, novoLider, anterior);
  }

  function juntarComPapel(id, papel) {
    const anterior = { escalados, liderEscala };
    const novosEscalados = [...escalados, { pessoaId: id, papel }];
    const novoLider = liderEscala ?? id;
    setEscalados(novosEscalados);
    setLiderEscala(novoLider);
    persistir(novosEscalados, novoLider, anterior);
  }

  function trocarPapel(id, papel) {
    const anterior = { escalados, liderEscala };
    const novosEscalados = escalados.map((e) => (e.pessoaId === id ? { ...e, papel } : e));
    setEscalados(novosEscalados);
    persistir(novosEscalados, liderEscala, anterior);
  }

  function definirLider(id) {
    const anterior = { escalados, liderEscala };
    setLiderEscala(id);
    persistir(escalados, id, anterior);
  }

  async function publicar() {
    setAPublicar(true);
    try {
      await publicarEscala(evento.id);
      setPublicado(true);
      torrada("Escala publicada");
    } catch (e) {
      torrada(e.message || "Não foi possível publicar.");
    } finally {
      setAPublicar(false);
    }
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

  function linhaEstatistica(p) {
    const stat = estatisticas[p.id];
    const semServico = !stat?.vezes;
    const texto = semServico
      ? "Ainda não serviu neste trimestre"
      : `${stat.vezes} ${stat.vezes === 1 ? "vez" : "vezes"} · última a ${dataCurta(stat.ultima)}`;
    return { stat, semServico, texto };
  }

  // Linha dentro de um bloco de instrumento — clicar no nome escala
  // aqui (ou move para aqui, se já estava noutro papel); clicar de
  // novo, já escalado, tira. Sem seletor: já se sabe o papel, é o
  // bloco onde está.
  function linhaNoBloco(p, papelId) {
    const entrada = escalados.find((e) => e.pessoaId === p.id);
    const lid = liderEscala === p.id;
    const aquiEscalado = entrada?.papel === papelId;
    const { semServico, stat, texto } = linhaEstatistica(p);
    return (
      <div key={p.id} className="opcao" style={{ cursor: "default", ...(semServico ? { background: "rgba(214,32,105,.06)", borderRadius: 12 } : {}) }}>
        <span
          onClick={() => (aquiEscalado ? tirar(p.id) : entrada ? trocarPapel(p.id, papelId) : juntarComPapel(p.id, papelId))}
          style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer" }}
        >
          <Avatar pessoa={p} tamanho={38} fonte={15} />
          <span style={{ flex: 1 }}>
            <b style={{ fontSize: 15.5, fontWeight: 700 }}>{p.nome}</b>
            <span style={{ display: "block", fontSize: 12, color: "var(--cinza)" }}>
              {entrada && !aquiEscalado ? `já escalado como ${nomePapel(papeis, entrada.papel)}` : aquiEscalado ? `escalado${lid ? " · líder de escala" : ""}` : "por escalar"}
            </span>
            <span style={{ display: "block", fontSize: 12, marginTop: 2, color: semServico ? "var(--magenta)" : "var(--cinza)", fontWeight: semServico ? 600 : 400 }}>
              {texto}
              {stat?.liderVezes ? <span style={{ opacity: 0.75 }}> · {stat.liderVezes}x líder</span> : null}
            </span>
          </span>
        </span>
        {aquiEscalado && (
          <button className={`estrela${lid ? " on" : ""}`} onClick={() => definirLider(p.id)} title="Líder de escala">★</button>
        )}
        {aquiEscalado && (
          <span className="chk on" onClick={() => tirar(p.id)} style={{ cursor: "pointer" }}>✓</span>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{nomeEvento(evento)}</h2>
        <p className="sb2">{escalados.length} pessoas · chegada {evento.horaChegada || "07:00"}</p>
        <p className="ds" style={{ textAlign: "center", marginTop: 8 }}>
          Toca no nome, dentro do instrumento, para escalar. A estrela define quem é o líder de escala.
        </p>
        <div className="subtabs" style={{ marginTop: 14 }}>
          <button data-on={ordem === "vezes" ? 1 : 0} onClick={() => setOrdem("vezes")}>Menos vezes primeiro</button>
          <button data-on={ordem === "nome" ? 1 : 0} onClick={() => setOrdem("nome")}>Nome</button>
        </div>

        {/* Papéis desativados (Definições da base → Papéis da escala)
          * só reaparecem aqui se alguém já estiver escalado nesse
          * papel neste culto — para nunca esconder quem já lá está
          * sem dar como tirar; senão o bloco nem monta (ninguém tem
          * esse instrumento no perfil de qualquer forma, já que
          * SheetPessoa.jsx só oferece papéis ativos). */}
        {[...papeisAtivos(papeis), ...papeis.filter((p) => p.ativo === false && escalados.some((e) => e.papel === p.id))].map((papel) => {
          const pessoasDoPapel = voluntariosOrdenados.filter((p) => (p.instrumentos || []).includes(papel.id));
          const nEscalados = escalados.filter((e) => e.papel === papel.id).length;
          if (!pessoasDoPapel.length && !nEscalados) return null;
          return (
            <div key={papel.id} style={{ marginTop: 18 }}>
              <div className="cabecalho" style={{ paddingTop: 0, marginBottom: 2 }}>
                <h3>{papel.emoji} {papel.nome}</h3>
                <span className="cap">{nEscalados ? `${nEscalados} escalado${nEscalados === 1 ? "" : "s"}` : "ninguém ainda"}</span>
              </div>
              {pessoasDoPapel.map((p) => linhaNoBloco(p, papel.id))}
            </div>
          );
        })}

        {!aoMudar && (
          publicado ? (
            <p className="ds" style={{ textAlign: "center", marginTop: 18, color: "var(--verde)", fontWeight: 600 }}>
              ✓ Publicada — os voluntários já veem esta escala
            </p>
          ) : (
            <button className="btn full" style={{ marginTop: 18, background: "var(--verde)" }} disabled={aPublicar || !escalados.length} onClick={publicar}>
              {aPublicar ? "A publicar…" : "Publicar esta escala"}
            </button>
          )
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
