import { useState } from "react";
import { guardarPapeisEscala } from "../../lib/modelo";
import { usePapeisEscala } from "../../lib/PapeisEscalaContext.jsx";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const COR_PADRAO = "#0092D4";
const FORM_VAZIO = { nome: "", emoji: "🎵", cor: COR_PADRAO };
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** id novo a partir do nome — nunca muda depois (ver PAPEIS_PADRAO em
 *  lib/modelo.js). Sufixo -2/-3… só se colidir com um já existente
 *  (ativo ou desativado — um id repetido confundiria escalas velhas
 *  com o papel novo). */
function gerarIdPapel(nome, existentes) {
  const base = norm(nome).replace(/[^a-z0-9]+/g, "").slice(0, 24) || "papel";
  let id = base, n = 2;
  while (existentes.has(id)) id = `${base}${n++}`;
  return id;
}

/**
 * Papéis da escala (Lead, Guitarra, Bateria…) — pedido do líder,
 * 2026-09: antes era lista fixa em código (ver CLAUDE.md desta
 * base), agora vive em Definições da base → Papéis da escala,
 * editável por aqui. Cada ação grava logo no Firestore (mesmo
 * padrão de SheetEscala.jsx — "cada toque grava logo"), sem um
 * "Guardar" geral no fim.
 *
 * "Remover" nunca apaga (regra 5 do CLAUDE.md raiz): marca
 * `ativo:false` — o papel some da escala (SheetEscala.jsx) e do
 * perfil de instrumentos (SheetPessoa.jsx) daqui para a frente, mas
 * quem já estiver escalado nesse papel continua visível (ver
 * `SheetEscala.jsx`/`Escala.jsx`) e dá para reativar. O `id` nasce do
 * nome na criação e nunca muda — é o que fica gravado em
 * `escalados[].papel`/`pessoas.instrumentos[]`; editar nome/emoji/cor
 * de um papel não mexe em nada já gravado com esse id.
 *
 * A validação a sério (quem pode entrar na escala) é sempre o que
 * está gravado aqui, replicada no servidor por
 * `papeisValidosDaBase` (functions/index.js) — isto é só a UI.
 */
export default function SecaoPapeisEscala() {
  const torrada = useTorrada();
  const papeis = usePapeisEscala();
  const [aEditarId, setAEditarId] = useState(undefined); // id (editar), "novo", ou undefined (fechado)
  const [form, setForm] = useState(FORM_VAZIO);
  const [aGuardar, setAGuardar] = useState(false);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const ativos = papeis.filter((p) => p.ativo !== false);
  const inativos = papeis.filter((p) => p.ativo === false);

  function abrirNovo() {
    setForm(FORM_VAZIO);
    setAEditarId("novo");
  }
  function abrirEdicao(p) {
    setForm({ nome: p.nome, emoji: p.emoji || "🎵", cor: p.cor || COR_PADRAO });
    setAEditarId(p.id);
  }

  async function guardar(novaLista, msg) {
    setAGuardar(true);
    try {
      await guardarPapeisEscala(novaLista);
      torrada(msg);
      setAEditarId(undefined);
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  function confirmarForm() {
    const nome = form.nome.trim();
    if (!nome) return torrada("Dá um nome ao papel.");
    const emoji = form.emoji.trim() || "🎵";
    if (aEditarId === "novo") {
      const id = gerarIdPapel(nome, new Set(papeis.map((p) => p.id)));
      guardar([...papeis, { id, nome, emoji, cor: form.cor }], `"${nome}" adicionado`);
    } else {
      guardar(
        papeis.map((p) => (p.id === aEditarId ? { ...p, nome, emoji, cor: form.cor } : p)),
        "Papel atualizado",
      );
    }
  }

  function alternarAtivo(p) {
    guardar(
      papeis.map((x) => (x.id === p.id ? { ...x, ativo: !(x.ativo !== false) } : x)),
      p.ativo === false ? `"${p.nome}" reativado` : `"${p.nome}" removido`,
    );
  }

  return (
    <div className="sect">
      <div className="cabecalho"><h3>Papéis da escala</h3></div>
      <p className="ds" style={{ padding: "0 4px 8px" }}>
        Lead, Guitarra, Bateria… os grupos que aparecem ao montar a escala e ao organizar equipamento.
      </p>

      {ativos.map((p) => (
        <div className="linha" key={p.id}>
          <span className="quadmin" style={{ background: p.cor }} />
          <div style={{ flex: 1 }}><p className="nmt">{p.emoji} {p.nome}</p></div>
          <button className="lapis" onClick={() => abrirEdicao(p)} aria-label={`Editar ${p.nome}`}>✎</button>
          <button
            className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5, color: "var(--magenta)" }}
            disabled={aGuardar} onClick={() => alternarAtivo(p)}
          >
            Remover
          </button>
        </div>
      ))}

      {aEditarId !== "novo" && (
        <button className="btn sec full" style={{ marginTop: 10 }} onClick={abrirNovo}>+ Adicionar papel</button>
      )}

      {aEditarId && (
        <div className="caixa" style={{ marginTop: 10 }}>
          <label className="rot">Nome</label>
          <input
            className="campo" value={form.nome} placeholder="Ex.: Percussão"
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
          <label className="rot" style={{ marginTop: 10 }}>Emoji</label>
          <input
            className="campo" style={{ width: 90 }} value={form.emoji} placeholder="🎵"
            onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
          />
          <label className="rot" style={{ marginTop: 10 }}>Cor</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="color" value={form.cor} onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))}
              style={{ width: 40, height: 40, border: 0, borderRadius: 8, padding: 0 }}
            />
            <input className="campo" style={{ flex: 1, margin: 0 }} value={form.cor} onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))} />
          </div>
          <button className="btn full" style={{ marginTop: 12 }} disabled={aGuardar} onClick={confirmarForm}>
            {aGuardar ? "A guardar…" : aEditarId === "novo" ? "Adicionar" : "Guardar"}
          </button>
          <button className="btn sec full" style={{ marginTop: 9 }} disabled={aGuardar} onClick={() => setAEditarId(undefined)}>Cancelar</button>
        </div>
      )}

      {inativos.length > 0 && (
        <>
          <button className="btn sec full" style={{ marginTop: 14 }} onClick={() => setMostrarInativos((v) => !v)}>
            {mostrarInativos ? "Esconder" : "Ver"} {inativos.length} {inativos.length === 1 ? "papel removido" : "papéis removidos"}
          </button>
          {mostrarInativos && inativos.map((p) => (
            <div className="linha" key={p.id}>
              <div style={{ flex: 1 }}><p className="nmt" style={{ opacity: 0.6 }}>{p.emoji} {p.nome}</p></div>
              <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} disabled={aGuardar} onClick={() => alternarAtivo(p)}>
                Reativar
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
