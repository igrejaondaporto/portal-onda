import { useState } from "react";
import { criarPessoaPastoral, reporPinPastoral } from "../lib/pastoral";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";

/**
 * Novo membro da equipa pastoral, ou repor o código de um que já
 * existe. Pedido 2026-09 ("alterar o código de outro, e poder criar
 * novos utilizadores — todos com permissão de admin"), esclarecido
 * com o dono do produto: só dentro da própria equipa pastoral, nunca
 * nas outras dez bases.
 *
 * Sem foto, sem editar nome/telefone de outra pessoa, sem remover —
 * o pedido foi só estes dois (criar, repor código), e a equipa é
 * pequena. Se um dia vier a fazer falta mais do que isto, o padrão a
 * copiar é `SheetPessoa.jsx` (Apoio).
 */
export default function SheetMembroPastoral({ pessoa, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [papel, setPapel] = useState("voluntario");
  const [aEnviar, setAEnviar] = useState(false);
  const [aRepor, setARepor] = useState(false);

  async function adicionar() {
    const n = nome.trim();
    if (!n) return torrada("Falta o nome.");
    setAEnviar(true);
    try {
      const r = await criarPessoaPastoral(n, telefone.trim(), papel);
      onGuardado(r.pinProvisorio
        ? `${n} adicionado — código provisório ${r.pinProvisorio}`
        : `${n} ligado — já servia noutra base`);
    } catch (e) {
      torrada(e.message || "Não foi possível adicionar.");
      setAEnviar(false);
    }
  }

  async function repor() {
    setARepor(true);
    try {
      const r = await reporPinPastoral(pessoa.id);
      torrada(`Código reposto para ${r.pinProvisorio} — ${pessoa.nome} troca no próximo acesso`);
    } catch (e) {
      torrada(e.message || "Não foi possível repor o código.");
    } finally {
      setARepor(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{pessoa ? pessoa.nome : "Novo na equipa pastoral"}</h2>

        {pessoa ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <Avatar pessoa={pessoa} tamanho={40} />
              <p className="ds">{pessoa.papel === "lider_base" ? "Líder" : "Equipa"}</p>
            </div>
            <p className="ds" style={{ marginTop: 14 }}>
              Repor volta o código para {pessoa.papel === "lider_base" ? "123456" : "1234"} — {pessoa.nome} troca no próximo acesso.
            </p>
            <button className="btn full" style={{ marginTop: 14 }} disabled={aRepor} onClick={repor}>
              {aRepor ? "A repor…" : "Repor código"}
            </button>
          </>
        ) : (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Nome</label>
            <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
            <label className="rot">Telemóvel</label>
            <input className="campo" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="9xx xxx xxx" />
            <p className="ds" style={{ marginTop: 4 }}>
              Se já servir noutra base, o telefone liga ao perfil dela sozinho — sem duplicar.
            </p>
            <label className="rot">Papel</label>
            <div className="subtabs">
              <button data-on={papel === "voluntario" ? 1 : 0} onClick={() => setPapel("voluntario")}>Equipa</button>
              <button data-on={papel === "lider_base" ? 1 : 0} onClick={() => setPapel("lider_base")}>Líder</button>
            </div>
            <p className="ds" style={{ marginTop: 8 }}>
              Qualquer um dos dois já vê o painel inteiro — só o líder fica marcado como responsável, e só pode haver um.
            </p>
            <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={adicionar}>
              {aEnviar ? "A adicionar…" : "Adicionar"}
            </button>
          </>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
