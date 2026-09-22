import { useEffect, useState } from "react";
import { chamar } from "@portal/shared/lib/firebase.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

/**
 * Mapas AO VIVO que nunca foram fechados — a lista que faltava.
 *
 * Reportado 2026-09: o Painel Pastoral já mostrava ocupação de
 * domingos passados no "Quão cheio esteve o auditório", enquanto
 * "Cultos fechados" (logo acima) dizia "nenhum ainda" — porque o
 * painel lê o mapa AO VIVO sempre que não há resumo fechado (decisão
 * de propósito: "alguém preencheu mas não fechou, os números vão pros
 * painéis da mesma forma"). Até agora não havia como ver isto aqui,
 * muito menos corrigir — `Acomodacao.jsx` só mostra o mapa de HOJE,
 * nunca um domingo passado.
 *
 * Cada linha dá duas saídas: **Fechar agora** (a mesma
 * `fecharAcomodacao` de sempre — já aceita qualquer culto, não só o
 * de hoje) move o culto para "Cultos fechados" a sério, com o resumo
 * gravado; **Excluir** (`limparMapaAcomodacaoAoVivo`) zera os lugares
 * de volta a "livre" sem fechar — para quando os números eram um
 * teste ou um engano, não um domingo a sério por fechar. Nenhum dos
 * dois apaga o documento (regra 5 do CLAUDE.md raiz).
 *
 * Só a líder vê os botões — mesmo motivo de `ResumosAcomodacao.jsx`:
 * saber quem teve a função Mapa em CADA culto passado pediria mais
 * uma leitura por linha, e o servidor já confirma a permissão a
 * sério de qualquer forma.
 */
export default function MapasPorFechar({ souLiderBase }) {
  const torrada = useTorrada();
  const [cultos, setCultos] = useState(null);
  const [aAgir, setAAgir] = useState(null);
  const [confirmarLimpar, setConfirmarLimpar] = useState(null);

  useEffect(() => {
    let vivo = true;
    chamar("mapasAcomodacaoPorFechar")()
      .then((r) => { if (vivo) setCultos(r.data.cultos); })
      .catch(() => { if (vivo) setCultos([]); });
    return () => { vivo = false; };
  }, []);

  async function fechar(eventoId) {
    setAAgir(eventoId);
    try {
      await chamar("fecharAcomodacao")({ eventoId });
      setCultos((lista) => lista.filter((c) => c.eventoId !== eventoId));
      torrada("Culto fechado — já aparece em Cultos fechados");
    } catch (e) {
      torrada(e.message || "Não foi possível fechar.");
    } finally {
      setAAgir(null);
    }
  }

  async function limpar(eventoId) {
    setAAgir(eventoId);
    try {
      await chamar("limparMapaAcomodacaoAoVivo")({ eventoId });
      setCultos((lista) => lista.filter((c) => c.eventoId !== eventoId));
      setConfirmarLimpar(null);
      torrada("Mapa limpo");
    } catch (e) {
      torrada(e.message || "Não foi possível limpar.");
    } finally {
      setAAgir(null);
    }
  }

  // ninguém vê nada enquanto carrega, e nada aparece se a lista vier
  // vazia — não é para ocupar espaço no ecrã do dia a dia quando não
  // há nenhum por fechar, mesmo critério de ResumosAcomodacao
  if (!cultos || cultos.length === 0) return null;

  return (
    <div className="caixa" style={{ marginTop: 12, background: "#FFF7E0", border: 0 }}>
      <p className="nmt" style={{ margin: 0 }}>Mapas por fechar</p>
      <p className="ds" style={{ marginTop: 3 }}>
        {cultos.length} domingo{cultos.length === 1 ? "" : "s"} com gente marcada no mapa, mas nunca fechado — é
        daqui que o Painel Pastoral está a tirar os números até alguém decidir.
      </p>
      {cultos.map((c) => {
        const chaveAgir = aAgir === c.eventoId;
        return (
          <div key={c.eventoId} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,.06)" }}>
            <p className="nmt" style={{ fontSize: 14.5 }}>{dataPorExtenso(c.eventoId)}</p>
            <p className="ds" style={{ marginTop: 2 }}>
              {c.ocupados} ocupados · {c.visitantes} visitantes · {Math.round((c.percentagem ?? 0) * 100)}% de lotação
            </p>
            {souLiderBase && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  className="btn sec" style={{ flex: 1, padding: "8px 12px", fontSize: 12.5 }}
                  disabled={chaveAgir} onClick={() => fechar(c.eventoId)}
                >
                  {chaveAgir ? "…" : "Fechar agora"}
                </button>
                <button
                  className="btn sec" style={{ flex: 1, padding: "8px 12px", fontSize: 12.5, color: "var(--magenta)" }}
                  disabled={chaveAgir} onClick={() => setConfirmarLimpar(c.eventoId)}
                >
                  Excluir
                </button>
              </div>
            )}
            {confirmarLimpar === c.eventoId && (
              <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>Excluir {dataPorExtenso(c.eventoId)}?</p>
                <p className="ds" style={{ marginTop: 4 }}>
                  Volta todos os lugares a livre. O culto não fica fechado, e não dá para desfazer.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }}
                    disabled={chaveAgir} onClick={() => limpar(c.eventoId)}
                  >
                    {chaveAgir ? "A excluir…" : "Excluir"}
                  </button>
                  <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} onClick={() => setConfirmarLimpar(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
