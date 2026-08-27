import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { chamar } from "@portal/shared/lib/firebase.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { cPlanta } from "../lib/modelo";
import { obterMeuEvento } from "../lib/culto";
import { maiorBlocoLivre, estadoInicialLugares } from "../lib/geometriaAuditorio";
import { useMapaAcomodacao } from "../hooks/useMapaAcomodacao";
import { useSelecaoGrupo } from "../hooks/useSelecaoGrupo";
import { useHistorico } from "../hooks/useHistorico";
import MapaAuditorio from "../components/acomodacao/MapaAuditorio";
import PainelContadores from "../components/acomodacao/PainelContadores";
import BotoesGrupo from "../components/acomodacao/BotoesGrupo";
import ResumosAcomodacao from "../components/acomodacao/ResumosAcomodacao";

function dicaViva(planta, lugares, sel, capacidadeUtil, ocupados, modoReservar) {
  if (modoReservar) return { texto: "Modo reservar — toque num lugar para o marcar (ou desmarcar) a azul.", alerta: false };
  if (sel.length) return { texto: `Sugestão: ${sel.join(" · ")}. Confirme quando estiverem sentados.`, alerta: false };
  const pct = capacidadeUtil ? Math.round((ocupados / capacidadeUtil) * 100) : 0;
  if (pct >= 95) return { texto: `Quase lotado — avise a recepção.`, alerta: true };
  if (pct >= 80) return { texto: `${pct}% cheio. Encaminhe para as fileiras da frente.`, alerta: true };
  if (ocupados === 0) return { texto: "Toque num lugar para ocupar. Dois toques marcam visitante.", alerta: false };
  const maior = maiorBlocoLivre(planta, lugares);
  if (maior && maior.n >= 4) return { texto: `Fileira ${maior.fileira} tem ${maior.n} lugares seguidos livres.`, alerta: false };
  return { texto: "Lugares livres, mas espalhados. Junte grupos nas fileiras do fundo.", alerta: false };
}

export default function Acomodacao({ uid, papel, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const [planta, setPlanta] = useState(null);
  const [meuEvento, setMeuEvento] = useState(null);
  const [modoReservar, setModoReservar] = useState(false);
  const [avisoBloqueio, setAvisoBloqueio] = useState(false);

  useEffect(() => onSnapshot(cPlanta(), (s) => setPlanta(s.exists() ? s.data() : null)), []);
  useEffect(() => { obterMeuEvento(uid).then(setMeuEvento); }, [uid]);

  const eventoId = meuEvento?.id ?? null;
  const { mapa, carregado, souDrive, marcar, garantirMapa, limparMapa } = useMapaAcomodacao(eventoId, uid, papel);
  // antes de qualquer Drive abrir o mapa hoje, o doc do culto ainda não
  // existe — mostra a planta "em repouso" (reservados/bloqueios
  // permanentes) em vez de tudo livre.
  const lugares = mapa?.lugares ?? (planta ? estadoInicialLugares(planta) : {});
  const { sel, n, pedir, limpar } = useSelecaoGrupo(planta, lugares);
  const { empilhar, desempilhar } = useHistorico();

  useEffect(() => {
    if (carregado && !mapa && souDrive) garantirMapa(planta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado, mapa, souDrive, planta]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Acomodação",
      subtitulo: meuEvento ? `Mapa do auditório · ${meuEvento.data}` : "",
      chips: souDrive ? [] : ["Só leitura — não tens a função Acomodação neste culto"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, meuEvento, souDrive]);

  // Quem não tem a função Acomodação hoje continua a ver o mapa ao
  // vivo (acompanha em tempo real o que o Drive está a marcar) — só
  // não consegue mexer. Um popup a sério (não um aviso discreto, que
  // passava despercebido) explica porquê e só fecha quando a pessoa
  // tocar para confirmar.
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
      const novo = atual === "livre" ? "ocupado" : "livre";
      empilhar({ id, estadoAnterior: atual });
      marcar(id, novo);
      return;
    }
    if (tipo === "duplo") {
      empilhar({ id, estadoAnterior: atual });
      marcar(id, "visitante");
      return;
    }
    if (tipo === "longo") {
      const novo = atual === "bloqueado" ? "livre" : "bloqueado";
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

  async function fecharCulto() {
    if (!eventoId) return;
    try {
      await chamar("fecharAcomodacao")({ eventoId });
      torrada("Culto fechado — resumo guardado");
    } catch (e) {
      torrada(e.message || "Não foi possível fechar.");
    }
  }

  if (!planta || !meuEvento) return null;

  const contagem = { livre: 0, ocupado: 0, visitante: 0, reservado: 0, bloqueado: 0 };
  Object.values(lugares).forEach((s) => { if (contagem[s] != null) contagem[s]++; });
  const ocupados = contagem.ocupado + contagem.visitante;
  const capacidadeUtil = Object.keys(lugares).length - contagem.reservado - contagem.bloqueado;
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
              {modoReservar ? "✓ A reservar" : "Reservar"}
            </button>
            <button className="btn sec" onClick={desfazer}>↩ Desfazer</button>
            {papel === "lider_base" && (
              <button className="btn sec" onClick={() => { limparMapa(planta); torrada("Mapa limpo"); }}>
                Limpar mapa
              </button>
            )}
            <button className="btn sec" onClick={fecharCulto}>Fechar culto</button>
          </div>
        </>
      )}
      {mapa?.fechado && (
        <div className="caixa" style={{ marginTop: 12 }}>
          <p className="ds">Este culto já foi fechado — o mapa ficou só de leitura.</p>
        </div>
      )}

      <div className="sect">
        <PainelContadores lugaresEstado={lugares} corInvertida={!!planta.corInvertida} />
      </div>

      <ResumosAcomodacao souLiderBase={papel === "lider_base"} />

      {avisoBloqueio && (
        <>
          <div className="veu on" onClick={() => setAvisoBloqueio(false)} />
          <div className="pin on" role="dialog" aria-modal="true" aria-label="Sem acesso à Acomodação">
            <div className="pux" />
            <h2>Sem acesso para marcar</h2>
            <p className="sb2">
              Só quem tem a função Acomodação neste culto pode mexer no mapa. Fala com o líder da base se precisares.
            </p>
            <button className="btn full" style={{ marginTop: 16 }} onClick={() => setAvisoBloqueio(false)}>Entendi</button>
          </div>
        </>
      )}
    </>
  );
}
