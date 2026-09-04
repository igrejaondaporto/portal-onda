import { useState } from "react";
import { criarVersao, guardarVersao, novaVersaoId } from "../../lib/biblioteca";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import GradeTom from "./GradeTom";

export default function SheetVersao({ uid, musicaId, versao, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(versao?.nome ?? "");
  const [tom, setTom] = useState(versao?.tom ?? "");
  const [bpm, setBpm] = useState(versao?.bpm ?? "");
  const [duracao, setDuracao] = useState(versao?.duracao ?? "");
  const [observacao, setObservacao] = useState(versao?.observacao ?? "");
  const [linkReferencia, setLinkReferencia] = useState(versao?.linkReferencia ?? "");
  const [aGuardar, setAGuardar] = useState(false);

  async function guardar() {
    if (!nome.trim()) return torrada("Dá um nome à versão (ex.: Onda, Original).");
    setAGuardar(true);
    try {
      const dados = { nome, tom, bpm: bpm ? Number(bpm) : null, duracao: duracao ? Number(duracao) : null, observacao, linkReferencia };
      if (versao) {
        await guardarVersao(musicaId, versao.id, dados);
      } else {
        await criarVersao(musicaId, novaVersaoId(musicaId), { ...dados, criadoPor: uid });
      }
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
