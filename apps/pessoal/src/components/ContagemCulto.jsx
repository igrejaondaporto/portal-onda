import { useEffect, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import {
  CATEGORIAS_CONTAGEM,
  finalizarContagem,
  guardarCategoriaContagem,
  limparContagem,
  normalizarValorContagem,
  ouvirContagem,
} from "../lib/contagem";

const GRUPOS = ["Auditório", "Resposta", "Salas"];

function nomeDe(uid, voluntarios) {
  return voluntarios.find((p) => p.id === uid)?.nome ?? null;
}

/** HH:MM local — getter local, nunca toISOString (desvia com o fuso). */
function horaDe(ts) {
  if (!ts?.toDate) return null;
  const d = ts.toDate();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Contagem do culto: nove números independentes, nunca um total calculado.
 * A alteração fica no próprio toque (botões ±) ou ao sair do campo, para
 * ser rápida na porta e continuar disponível quando o Firestore sincroniza
 * uma escrita offline.
 */
export default function ContagemCulto({ eventoId, uid, voluntarios }) {
  const torrada = useTorrada();
  const [contagem, setContagem] = useState(null);
  const [rascunhos, setRascunhos] = useState({});
  const [aGuardar, setAGuardar] = useState({});
  const [aConfirmarLimpar, setAConfirmarLimpar] = useState(false);
  const [aLimpar, setALimpar] = useState(false);
  const [aGuardarTudo, setAGuardarTudo] = useState(false);

  useEffect(() => {
    setRascunhos({});
    return ouvirContagem(eventoId, setContagem);
  }, [eventoId]);

  function valorNoCampo(categoriaId) {
    if (Object.prototype.hasOwnProperty.call(rascunhos, categoriaId)) return rascunhos[categoriaId];
    const valorGuardado = contagem?.categorias?.[categoriaId]?.valor;
    return valorGuardado == null ? "" : String(valorGuardado);
  }

  async function guardar(categoriaId, valor) {
    try {
      const normalizado = normalizarValorContagem(valor);
      const valorGuardado = contagem?.categorias?.[categoriaId]?.valor ?? null;
      if (normalizado === valorGuardado) return;
      setAGuardar((estado) => ({ ...estado, [categoriaId]: true }));
      await guardarCategoriaContagem(eventoId, categoriaId, normalizado, uid);
      setRascunhos((estado) => ({ ...estado, [categoriaId]: normalizado == null ? "" : String(normalizado) }));
    } catch (erro) {
      torrada(erro.message || "Não foi possível atualizar a contagem.");
    } finally {
      setAGuardar((estado) => ({ ...estado, [categoriaId]: false }));
    }
  }

  function alterar(categoriaId, valor) {
    setRascunhos((estado) => ({ ...estado, [categoriaId]: valor }));
  }

  function ajustar(categoriaId, delta) {
    try {
      const atual = normalizarValorContagem(valorNoCampo(categoriaId)) ?? 0;
      const proximo = Math.max(0, atual + delta);
      alterar(categoriaId, String(proximo));
      guardar(categoriaId, proximo);
    } catch (erro) {
      torrada(erro.message || "Não foi possível atualizar a contagem.");
    }
  }

  async function limpar() {
    setALimpar(true);
    try {
      await limparContagem(eventoId);
      setRascunhos({});
      setAConfirmarLimpar(false);
      torrada("Contagem limpa");
    } catch (erro) {
      torrada(erro.message || "Não foi possível limpar a contagem.");
    } finally {
      setALimpar(false);
    }
  }

  const preenchidas = CATEGORIAS_CONTAGEM.filter((categoria) => (
    contagem?.categorias?.[categoria.id]?.valor != null
  )).length;

  async function guardarContagem() {
    setAGuardarTudo(true);
    try {
      await finalizarContagem(eventoId, uid);
      torrada("Contagem guardada");
    } catch (erro) {
      torrada(erro.message || "Não foi possível guardar a contagem.");
    } finally {
      setAGuardarTudo(false);
    }
  }

  return (
    <section className="sect contagem-culto" data-tour="contagem-bloco">
      <div className="cabecalho">
        <div>
          <h3>Contagem do culto</h3>
          <p className="ds" style={{ marginTop: 3 }}>Cada número tem o seu próprio significado.</p>
        </div>
        {preenchidas > 0 && <span className="cap">{preenchidas}/9</span>}
      </div>
      <p className="ds contagem-aviso">Não somes estas categorias entre si. Campo vazio significa que ainda não foi contado.</p>

      {preenchidas > 0 && !aConfirmarLimpar && (
        <button className="btn sec" style={{ marginBottom: 14, fontSize: 12.5, padding: "8px 14px" }} onClick={() => setAConfirmarLimpar(true)}>
          Limpar contagem
        </button>
      )}
      {aConfirmarLimpar && (
        <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>Limpar as nove categorias?</p>
          <p className="ds" style={{ marginTop: 4 }}>Volta tudo a "por contar" — não dá para desfazer.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }} disabled={aLimpar} onClick={limpar}>
              {aLimpar ? "A limpar…" : "Limpar"}
            </button>
            <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aLimpar} onClick={() => setAConfirmarLimpar(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {GRUPOS.map((grupo) => {
        const categorias = CATEGORIAS_CONTAGEM.filter((categoria) => categoria.grupo === grupo);
        return (
          <div className="contagem-grupo" key={grupo}>
            <p className="cap contagem-grupo-titulo">{grupo}</p>
            {categorias.map((categoria) => {
              const registo = contagem?.categorias?.[categoria.id];
              const preenchidoPor = registo?.preenchidoPor ? nomeDe(registo.preenchidoPor, voluntarios) : null;
              const hora = horaDe(registo?.preenchidoEm);
              const origem = registo?.valor == null ? null : (registo?.origem === "automatica"
                ? "Atualizado automaticamente"
                : preenchidoPor ? `Preenchido por ${preenchidoPor}${hora ? ` · ${hora}` : ""}` : null);
              const valor = valorNoCampo(categoria.id);

              return (
                <div className="contagem-linha" key={categoria.id}>
                  <div className="contagem-texto">
                    <label htmlFor={`contagem-${categoria.id}`} className="nmt">{categoria.nome}</label>
                    <p className="ds">{categoria.descricao}</p>
                    {origem && <p className="contagem-autoria">{origem}</p>}
                  </div>
                  <div className="contagem-controlos">
                    <button
                      type="button"
                      className="btn sec contagem-ajuste"
                      aria-label={`Diminuir ${categoria.nome}`}
                      disabled={aGuardar[categoria.id] || (Number(valor || 0) <= 0)}
                      onClick={() => ajustar(categoria.id, -1)}
                    >
                      −
                    </button>
                    <input
                      id={`contagem-${categoria.id}`}
                      className="campo contagem-campo"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={valor}
                      placeholder="—"
                      aria-label={`Contagem de ${categoria.nome}`}
                      onChange={(e) => alterar(categoria.id, e.target.value)}
                      onBlur={(e) => guardar(categoria.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    />
                    <button
                      type="button"
                      className="btn sec contagem-ajuste"
                      aria-label={`Aumentar ${categoria.nome}`}
                      disabled={aGuardar[categoria.id]}
                      onClick={() => ajustar(categoria.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <button className="btn full" style={{ marginTop: 6 }} disabled={aGuardarTudo} onClick={guardarContagem}>
        {aGuardarTudo ? "A guardar…" : "Salvar contagem"}
      </button>
      {contagem?.finalizadoEm && (
        <p className="ds" style={{ marginTop: 8, textAlign: "center" }}>
          Guardada{horaDe(contagem.finalizadoEm) ? ` às ${horaDe(contagem.finalizadoEm)}` : ""} por {nomeDe(contagem.finalizadoPor, voluntarios) ?? "alguém da equipa"}
        </p>
      )}
    </section>
  );
}
