import { useState } from "react";
import { guardarOuFundirVersao, registarUsoVersao, desativarVersao } from "../../lib/biblioteca";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import GradeTom from "./GradeTom";
import { PAPEIS_VOCAL } from "../../lib/modelo";

export default function SheetVersao({ uid, musicaId, versao, voluntarios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(versao?.nome ?? "");
  const [tom, setTom] = useState(versao?.tom ?? "");
  const [bpm, setBpm] = useState(versao?.bpm ?? "");
  const [duracao, setDuracao] = useState(versao?.duracao ?? "");
  const [observacao, setObservacao] = useState(versao?.observacao ?? "");
  const [linkReferencia, setLinkReferencia] = useState(versao?.linkReferencia ?? "");
  const [aGuardar, setAGuardar] = useState(false);
  const [aConfirmarExcluir, setAConfirmarExcluir] = useState(false);
  const [aExcluir, setAExcluir] = useState(false);

  // Quem canta (pedido do líder: "não é sugestor, é lista fixa") —
  // Nome deixou de ser texto livre: só dá para escolher um voluntário
  // com papel de voz (PAPEIS_VOCAL). instrumentos é opcional e só
  // informativo (ver CLAUDE.md desta base), por isso quem não o
  // preencheu simplesmente não aparece aqui — nada trava. Uma versão
  // já existente com um nome fora da lista (ex.: "Onda", de antes
  // desta mudança) continua a aparecer como opção própria, para editar
  // sem ser forçado a trocar de nome.
  const cantores = (voluntarios || [])
    .filter((p) => (p.instrumentos || []).some((i) => PAPEIS_VOCAL.includes(i)))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  const nomeAtualForaDaLista = versao?.nome && !cantores.some((p) => p.nome === versao.nome) ? versao.nome : null;

  async function guardar() {
    if (!nome.trim()) return torrada("Escolhe quem canta esta versão.");
    setAGuardar(true);
    try {
      const dados = { nome, tom, bpm: bpm ? Number(bpm) : null, duracao: duracao ? Number(duracao) : null, observacao, linkReferencia };
      // funde automaticamente se já existir outra versão ativa com o
      // mesmo nome nesta música (ver guardarOuFundirVersao) — nunca
      // duas versões do mesmo cantor na mesma música.
      const versaoId = await guardarOuFundirVersao(musicaId, versao?.id ?? null, dados, uid);
      // sem eventoId: só sincroniza nome/tom no índice por cantor, não
      // conta como "usada num culto" — é o que faz uma versão nova
      // (ou renomeada) já aparecer no Histórico por cantor na hora,
      // mesmo antes de qualquer repertório a usar (ver lib/biblioteca.js).
      registarUsoVersao({ musicaId, versaoId });
      onGuardado(versaoId !== versao?.id ? "Versões agrupadas" : versao ? "Versão atualizada" : "Versão adicionada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar a versão.");
    } finally {
      setAGuardar(false);
    }
  }

  async function excluir() {
    setAExcluir(true);
    try {
      await desativarVersao(musicaId, versao.id);
      onGuardado("Versão excluída");
    } catch (e) {
      torrada(e.message || "Não foi possível excluir a versão.");
      setAExcluir(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{versao ? "Editar versão" : "Nova versão"}</h2>
        <label className="rot" style={{ marginTop: 12 }}>Nome (quem canta)</label>
        {!cantores.length && !nomeAtualForaDaLista && (
          <div className="vaz">Ainda ninguém marcado com Voz no perfil.</div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {nomeAtualForaDaLista && (
            <button type="button" className="bib-chip" data-on={nome === nomeAtualForaDaLista ? 1 : 0} onClick={() => setNome(nomeAtualForaDaLista)}>
              {nomeAtualForaDaLista}
            </button>
          )}
          {cantores.map((p) => (
            <button key={p.id} type="button" className="bib-chip" data-on={nome === p.nome ? 1 : 0} onClick={() => setNome(p.nome)}>
              {p.nome}
            </button>
          ))}
        </div>
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

        {versao && !aConfirmarExcluir && (
          <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={() => setAConfirmarExcluir(true)}>
            Excluir versão
          </button>
        )}
        {versao && aConfirmarExcluir && (
          <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 9 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Excluir esta versão?</p>
            <p className="ds" style={{ marginTop: 4 }}>
              Some das listas — o histórico fica guardado, mas deixa de aparecer para escolher.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }} disabled={aExcluir} onClick={excluir}>
                {aExcluir ? "A excluir…" : "Excluir"}
              </button>
              <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aExcluir} onClick={() => setAConfirmarExcluir(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
