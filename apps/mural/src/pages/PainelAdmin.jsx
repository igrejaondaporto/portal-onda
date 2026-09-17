import { useEffect, useMemo, useState } from "react";
import { ouvirTodosAnuncios, removerAnuncio, moderarAnuncio, resumoSemanalMural } from "../lib/anuncios.js";
import { nomeCategoria } from "../lib/util.js";
import FotoAnuncio from "../components/FotoAnuncio.jsx";
import MiniAvatar from "../components/MiniAvatar.jsx";

/** Painel de moderação — "caso queiramos excluir ou editar algum
 *  anúncio" (pedido explícito, 2026-09). Editar em si fica para uma
 *  fase seguinte junto da pré-aprovação (ver apps/mural/CLAUDE.md);
 *  por agora dá para reportar, manter e remover, que é o que resolve
 *  o problema de hoje. */
export default function PainelAdmin() {
  const [secao, setSecao] = useState("anuncios");
  const [todos, setTodos] = useState([]);
  const [busca, setBusca] = useState("");
  const [resumo, setResumo] = useState(null);
  const [aCarregarResumo, setACarregarResumo] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [aTrabalhar, setATrabalhar] = useState(null);

  useEffect(() => ouvirTodosAnuncios(setTodos), []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return todos.filter((a) => !q || `${a.titulo} ${a.autorNome}`.toLowerCase().includes(q));
  }, [todos, busca]);
  const reportados = todos.filter((a) => a.ativo && (a.numReports || 0) > 0);

  async function remover(id) {
    setATrabalhar(id);
    await removerAnuncio(id).catch(() => {});
    setATrabalhar(null);
  }
  async function moderar(id, acao) {
    setATrabalhar(id);
    await moderarAnuncio(id, acao).catch(() => {});
    setATrabalhar(null);
  }
  async function pedirResumo() {
    setACarregarResumo(true);
    const r = await resumoSemanalMural().catch(() => null);
    setResumo(r);
    setACarregarResumo(false);
  }
  function copiar() {
    navigator.clipboard?.writeText(resumo.texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  return (
    <>
      <div className="subtabs">
        <button data-on={secao === "anuncios" ? 1 : 0} onClick={() => setSecao("anuncios")}>Anúncios</button>
        <button data-on={secao === "reportados" ? 1 : 0} onClick={() => setSecao("reportados")}>
          Reportados{reportados.length > 0 ? ` (${reportados.length})` : ""}
        </button>
        <button data-on={secao === "resumo" ? 1 : 0} onClick={() => setSecao("resumo")}>Resumo</button>
      </div>

      {secao === "anuncios" && (
        <>
          <div className="numeros">
            <div><b>{todos.filter((a) => a.ativo).length}</b><span>no mural</span></div>
            <div><b>{todos.length}</b><span>ao todo</span></div>
            <div><b>{reportados.length}</b><span>reportados</span></div>
          </div>
          <div className="procura">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" placeholder="Procurar por título ou pessoa…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {filtrados.map((a) => (
            <div key={a.id} className="linha" style={{ alignItems: "flex-start", gap: 14 }}>
              <FotoAnuncio anuncio={a} estilo={{ marginTop: 2 }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="nmt" style={{ display: "block", opacity: a.ativo ? 1 : 0.5 }}>{a.titulo}</span>
                <span className="ds" style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                  <MiniAvatar nome={a.autorNome} foto={a.autorFoto} />
                  {a.autorNome} · {nomeCategoria(a.tipo, a.categoria)} {!a.ativo && "· removido"}
                </span>
              </span>
              {a.ativo && (
                <button className="sair" style={{ padding: "6px 0", color: "var(--magenta)", alignSelf: "center" }} disabled={aTrabalhar === a.id} onClick={() => window.confirm(`Remover "${a.titulo}"?`) && remover(a.id)}>
                  Remover
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {secao === "reportados" && (
        <>
          {reportados.length === 0 && <p className="vaz">Nada reportado — está tudo em ordem.</p>}
          {reportados.map((a) => (
            <div key={a.id} className="caixa" style={{ borderColor: "var(--magenta)", borderWidth: 1.5 }}>
              <span className="cap" style={{ color: "var(--magenta)" }}>Reportado {a.numReports}×</span>
              <h4 style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>{a.titulo}</h4>
              <p className="ds">{a.autorNome} · {a.autorLocal || "Igreja Onda"}</p>
              {(a.ultimosReports || []).slice(0, 3).map((r, i) => (
                <p key={i} className="ds" style={{ marginTop: 4 }}>Motivo: “{r.motivo || "sem motivo indicado"}”</p>
              ))}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="btn sec" style={{ flex: 1 }} disabled={aTrabalhar === a.id} onClick={() => moderar(a.id, "manter")}>Manter</button>
                <button className="btn" style={{ flex: 1, background: "var(--magenta)" }} disabled={aTrabalhar === a.id} onClick={() => moderar(a.id, "remover")}>Remover</button>
              </div>
            </div>
          ))}
          <p className="nota">Quem remove és tu — o anúncio sai do mural (regra 5: nunca se apaga a sério, só desativa).</p>
        </>
      )}

      {secao === "resumo" && (
        <>
          <p className="ds" style={{ padding: "14px 0 2px" }}>Para colares no grupo · uma vez por semana</p>
          <div className="caixa">
            <h4 style={{ fontSize: 15, fontWeight: 700 }}>Uma mensagem, em vez de vinte</h4>
            <p className="ds">Gera o texto com os anúncios dos últimos 7 dias, por região. Copias, colas, e acabou.</p>
          </div>
          <button className="btn full" disabled={aCarregarResumo} onClick={pedirResumo}>
            {aCarregarResumo ? "A gerar…" : resumo ? "Atualizar" : "Gerar resumo"}
          </button>
          {resumo && (
            <>
              <div className="resumotexto">{resumo.texto}</div>
              <button className="btn full" onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar texto"}</button>
            </>
          )}
        </>
      )}
    </>
  );
}
