import { useState } from "react";
import { criarVersao, guardarVersao, novaVersaoId, registarUsoVersao } from "../../lib/biblioteca";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import GradeTom from "./GradeTom";

const PAPEIS_VOCAL = ["lead", "colead", "back"];

export default function SheetVersao({ uid, musicaId, versao, voluntarios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(versao?.nome ?? "");
  const [tom, setTom] = useState(versao?.tom ?? "");
  const [bpm, setBpm] = useState(versao?.bpm ?? "");
  const [duracao, setDuracao] = useState(versao?.duracao ?? "");
  const [observacao, setObservacao] = useState(versao?.observacao ?? "");
  const [linkReferencia, setLinkReferencia] = useState(versao?.linkReferencia ?? "");
  const [aGuardar, setAGuardar] = useState(false);

  // Quem canta (pedido do líder: "já coloca sempre a lista de todos
  // os que cantam") — atalho para preencher o Nome, nunca substitui
  // o campo livre (versões sem nome de pessoa, tipo "Original" ou
  // "Acústico", continuam válidas). instrumentos é opcional e só
  // informativo (ver CLAUDE.md desta base), por isso quem não o
  // preencheu simplesmente não aparece aqui — nada trava.
  const cantores = (voluntarios || [])
    .filter((p) => (p.instrumentos || []).some((i) => PAPEIS_VOCAL.includes(i)))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));

  async function guardar() {
    if (!nome.trim()) return torrada("Dá um nome à versão (ex.: Onda, Original).");
    setAGuardar(true);
    try {
      const dados = { nome, tom, bpm: bpm ? Number(bpm) : null, duracao: duracao ? Number(duracao) : null, observacao, linkReferencia };
      let versaoId = versao?.id;
      if (versao) {
        await guardarVersao(musicaId, versao.id, dados);
      } else {
        versaoId = novaVersaoId(musicaId);
        await criarVersao(musicaId, versaoId, { ...dados, criadoPor: uid });
      }
      // sem eventoId: só sincroniza nome/tom no índice por cantor, não
      // conta como "usada num culto" — é o que faz uma versão nova
      // (ou renomeada) já aparecer no Histórico por cantor na hora,
      // mesmo antes de qualquer repertório a usar (ver lib/biblioteca.js).
      registarUsoVersao({ musicaId, versaoId });
      onGuardado(versao ? "Versão atualizada" : "Versão adicionada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar a versão.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{versao ? "Editar versão" : "Nova versão"}</h2>
        <label className="rot" style={{ marginTop: 12 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Onda, Original, Acústico…" autoFocus />
        {cantores.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
            {cantores.map((p) => (
              <button key={p.id} type="button" className="bib-chip" data-on={nome === p.nome ? 1 : 0} onClick={() => setNome(p.nome)}>
                {p.nome}
              </button>
            ))}
          </div>
        )}
        <label className="rot">Tom</label>
        <GradeTom valor={tom} onEscolher={setTom} />
        <label className="rot">BPM</label>
        <input className="campo" inputMode="numeric" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="70" />
        <label className="rot">Duração (segundos)</label>
        <input className="campo" inputMode="numeric" value={duracao} onChange={(e) => setDuracao(e.target.value)} placeholder="310" />
        <label className="rot">Observação</label>
        <input className="campo" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Entra só com teclado…" />
        <label className="rot">Link de referência deste tom (opcional)</label>
        <input
          className="campo" value={linkReferencia} onChange={(e) => setLinkReferencia(e.target.value)}
          placeholder="Cifra Club, áudio… já neste tom"
        />
        <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar} onClick={guardar}>
          {aGuardar ? "A guardar…" : "Guardar"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
