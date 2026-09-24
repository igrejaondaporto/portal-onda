import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { cPlanta, contarEstados, alternarApelo } from "../../lib/modelo";
import { maiorBlocoLivre, estadoInicialLugares } from "../../lib/geometriaAuditorio";
import { useMapaAcomodacao } from "../../hooks/useMapaAcomodacao";
import { useSelecaoGrupo } from "../../hooks/useSelecaoGrupo";
import { useHistorico } from "../../hooks/useHistorico";
import MapaAuditorio from "./MapaAuditorio";
import PainelContadores from "./PainelContadores";
import BotoesGrupo from "./BotoesGrupo";

function dicaViva(planta, lugares, sel, capacidadeUtil, ocupados, modoReservar) {
  if (modoReservar) return { texto: "Modo reservar — toque num lugar para o marcar (ou desmarcar) a azul.", alerta: false };
  if (sel.length) return { texto: `Sugestão: ${sel.join(" · ")}. Confirme quando estiverem sentados.`, alerta: false };
  const pct = capacidadeUtil ? Math.round((ocupados / capacidadeUtil) * 100) : 0;
  if (pct >= 95) return { texto: `Quase lotado — avise a recepção.`, alerta: true };
  if (pct >= 80) return { texto: `${pct}% cheio. Encaminhe para as fileiras da frente.`, alerta: true };
  if (ocupados === 0) return { texto: "Toque num lugar para ocupar. Dois toques marcam visitante; manter o dedo, apelo.", alerta: false };
  const maior = maiorBlocoLivre(planta, lugares);
  if (maior && maior.n >= 4) return { texto: `Fileira ${maior.fileira} tem ${maior.n} lugares seguidos livres.`, alerta: false };
  return { texto: "Lugares livres, mas espalhados. Junte grupos nas fileiras do fundo.", alerta: false };
}

/**
 * O grelhado do auditório + os controlos de marcar — extraído de
 * `Acomodacao.jsx` (pedido 2026-09: "em Mapas... precisa ser possível
 * EDITAR mapas antigos... abre o mapa lá na tela e eu vou editando
 * novamente") para servir dois donos: a própria `Acomodacao.jsx`
 * (sempre o mapa de HOJE, ver o comentário lá — essa regra não mudou)
 * e `SheetEditarMapa.jsx` (um domingo já passado, escolhido na lista
 * "Mapas por fechar"). `useMapaAcomodacao` já era genérico por
 * `eventoId` — só faltava este componente não estar preso a "hoje".
 *
 * `onFechar`/`onReabrir` são opcionais: só `Acomodacao.jsx` os passa.
 * A sheet de edição de um mapa antigo não os recebe de propósito —
 * fechar/reabrir já têm um botão próprio na lista "Mapas por fechar"
 * (que atualiza a própria lista ao fechar); dar o mesmo botão aqui
 * dentro deixava a lista desatualizada até ao próximo carregamento.
 */
export default function EditorMapaAuditorio({ eventoId, uid, papel, onFechar, onReabrir, onSouDriveChange }) {
  const torrada = useTorrada();
  const [planta, setPlanta] = useState(null);
  const [modoReservar, setModoReservar] = useState(false);
  const [avisoBloqueio, setAvisoBloqueio] = useState(false);
  const [aConfirmarLimpar, setAConfirmarLimpar] = useState(false);

  useEffect(() => onSnapshot(cPlanta(), (s) => setPlanta(s.exists() ? s.data() : null)), []);

  const { mapa, carregado, souDrive, marcar, garantirMapa, limparMapa } = useMapaAcomodacao(eventoId, uid, papel);
  // `Acomodacao.jsx` precisa de `souDrive` para o subtítulo ("Só
  // leitura…") sem duplicar esta subscrição inteira — reporta para
  // cima em vez de o cliente ter de chamar `useMapaAcomodacao` outra
  // vez com o mesmo eventoId.
  useEffect(() => { onSouDriveChange?.(souDrive); }, [souDrive, onSouDriveChange]);
  const lugares = mapa?.lugares ?? (planta ? estadoInicialLugares(planta) : {});
  const { sel, n, pedir, limpar } = useSelecaoGrupo(planta, lugares);
  const { empilhar, desempilhar } = useHistorico();

  useEffect(() => {
    if (carregado && !mapa && souDrive) garantirMapa(planta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado, mapa, souDrive, planta]);

  function onTocar(id, tipo) {
    if (!souDrive) {
      setAvisoBloqueio(true);
      return;
    }
    const atual = lugares[id] ?? "livre";
    if (modoReservar) {
      if (tipo !== "simples") return;
      const novo = atual === "reservado" ? "livre" : "reservado";
      empilhar({ id, estadoAnterior: atual });
      marcar(id, novo);
      return;
    }
    if (tipo === "simples") {
      if (atual === "reservado") { torrada("Reservado — ative \"Reservar\" para libertar"); return; }
      if (atual === "bloqueado") { torrada("Lugar bloqueado"); return; }
      const novo = atual === "livre" ? "ocupado" : "livre";
      empilhar({ id, estadoAnterior: atual });
      marcar(id, novo);
      return;
    }
    if (tipo === "duplo") {
      if (atual === "bloqueado") return;
      empilhar({ id, estadoAnterior: atual });
      // um apelo que afinal era visitante continua apelo
      marcar(id, atual === "apelo" ? "apeloVisitante" : "visitante");
      return;
    }
    if (tipo === "longo") {
      // manter o dedo = APELO (pedido 2026-09 — antes bloqueava a
      // cadeira; os bloqueios agora só vêm da planta). Outra vez no
      // mesmo lugar desfaz, e a pessoa continua sentada.
      const novo = alternarApelo(atual);
      if (!novo) { torrada(atual === "reservado" ? "Reservado — ative \"Reservar\" para libertar" : "Lugar bloqueado"); return; }
      empilhar({ id, estadoAnterior: atual });
      marcar(id, novo);
    }
  }

  function confirmarGrupo() {
    empilhar({ grupo: sel.map((id) => ({ id, estadoAnterior: lugares[id] ?? "livre" })) });
    sel.forEach((id) => marcar(id, "ocupado"));
    torrada(`${sel.length} lugares ocupados`);
    limpar();
  }

  function pedirGrupo(tamanho) {
    const r = pedir(tamanho);
    if (!r.ok) torrada(`Não há ${tamanho} lugares seguidos livres`);
  }

  function desfazer() {
    const u = desempilhar();
    if (!u) { torrada("Nada para desfazer"); return; }
    if (u.grupo) u.grupo.forEach((x) => marcar(x.id, x.estadoAnterior));
    else marcar(u.id, u.estadoAnterior);
    torrada("Desfeito");
  }

  if (!planta) return null;

  const { ocupados, capacidadeUtil } = contarEstados(lugares);
  const dica = dicaViva(planta, lugares, sel, capacidadeUtil, ocupados, modoReservar);

  return (
    <>
      <div className="caixa" style={{ padding: 8, marginBottom: 12 }}>
        <MapaAuditorio
          planta={planta} lugaresEstado={lugares} corInvertida={!!planta.corInvertida}
          selecao={sel} onTocar={onTocar} dicaTexto={dica.texto} dicaAlerta={dica.alerta}
        />
      </div>

      {souDrive && !mapa?.fechado && (
        <>
          <div className="sect">
            <BotoesGrupo n={n} onPedir={pedirGrupo} onConfirmar={confirmarGrupo} onCancelar={limpar} />
          </div>
          <div
            style={{
              display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap",
              WebkitUserSelect: "none", userSelect: "none", touchAction: "manipulation",
            }}
          >
            <button
              className="btn sec" onClick={() => setModoReservar((m) => !m)}
              style={modoReservar ? { background: "#3B82F6", color: "#fff", borderColor: "#3B82F6" } : undefined}
            >
              {modoReservar ? "✓ A reservar" : "Reservas"}
            </button>
            <button className="btn sec" onClick={desfazer}>↩ Desfazer</button>
            <button className="btn sec" style={{ color: "var(--magenta)" }} onClick={() => setAConfirmarLimpar(true)}>
              Limpar tudo
            </button>
            {onFechar && <button className="btn sec" onClick={() => onFechar(eventoId)}>Fechar culto</button>}
          </div>
          {aConfirmarLimpar && (
            <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Limpar todo o mapa?</p>
              <p className="ds" style={{ marginTop: 4 }}>
                Volta todos os lugares a livre (reservados e bloqueios permanentes ficam). Não dá para desfazer.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }}
                  onClick={() => { limparMapa(planta); setAConfirmarLimpar(false); torrada("Mapa limpo"); }}
                >
                  Limpar
                </button>
                <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} onClick={() => setAConfirmarLimpar(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {mapa?.fechado && (
        <div className="caixa" style={{ marginTop: 12 }}>
          <p className="ds">Este culto já foi fechado — o mapa ficou só de leitura.</p>
          {souDrive && onReabrir && (
            <button className="btn sec full" style={{ marginTop: 8 }} onClick={() => onReabrir(eventoId)}>
              Reabrir para marcar de novo
            </button>
          )}
        </div>
      )}

      <div className="sect">
        <PainelContadores lugaresEstado={lugares} corInvertida={!!planta.corInvertida} />
      </div>

      {avisoBloqueio && (
        <>
          <div className="veu on" onClick={() => setAvisoBloqueio(false)} />
          <div className="pin on" role="dialog" aria-modal="true" aria-label="Sem acesso ao Mapa">
            <div className="pux" />
            <h2>Sem acesso para marcar</h2>
            <p className="sb2">
              Só quem tem a função Mapa, a líder da base ou o responsável deste culto podem mexer no mapa. Fala com um deles se precisares.
            </p>
            <button className="btn full" style={{ marginTop: 16 }} onClick={() => setAvisoBloqueio(false)}>Entendi</button>
          </div>
        </>
      )}
    </>
  );
}
