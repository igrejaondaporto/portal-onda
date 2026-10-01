import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { cMapaAcomodacao, contarEstados } from "../../lib/modelo";
import { ouvirContagem } from "../../lib/contagem";

/**
 * Resumo do domingo no Início da líder (pedido 2026-10: "um resuminho,
 * no estilo do Painel Pastoral, só que para a Base Pessoal").
 *
 * Tudo ao vivo e sem Cloud Function nenhuma — os dois documentos já são
 * legíveis pela Pessoal (é ela que os escreve):
 *   - `eventos/{e}/acomodacao/mapa` → no auditório (sentados, já com os
 *     visitantes), visitantes e apelo — `contarEstados`, a mesma conta
 *     do ecrã do Mapa;
 *   - `eventos/{e}/contagem/geral` → em pé e voluntários presentes
 *     (marcados por baixo do Mapa) e as cinco salas (Baby, Fun e Júnior
 *     da Kinder, SHIFT e New — cada sala grava a sua no painel dela).
 *
 * O total segue a conta do Painel Pastoral (`presencaDoCulto`):
 * auditório + em pé + voluntários + crianças. Os visitantes e o apelo
 * já estão dentro do auditório — mostram-se à parte, nunca se somam.
 *
 * Abre no domingo de hoje (ou no último, se hoje não for domingo), com
 * setas para ver os anteriores. O culto principal de cada dia tem o id
 * = data (regra 7 do CLAUDE.md raiz).
 */
const SALAS = [
  { id: "baby", nome: "Baby" },
  { id: "fun", nome: "Fun" },
  { id: "junior", nome: "Júnior" },
  { id: "shift", nome: "SHIFT" },
  { id: "new", nome: "New" },
];

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function ultimoDomingo() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // getDay(): 0 = domingo
  return d;
}

export default function ResumoDomingo() {
  const [recuo, setRecuo] = useState(0); // semanas para trás
  const dia = useMemo(() => {
    const d = ultimoDomingo();
    d.setDate(d.getDate() - recuo * 7);
    return d;
  }, [recuo]);
  const eventoId = iso(dia);
  const ehHoje = eventoId === iso(new Date());

  const [mapa, setMapa] = useState(undefined);
  const [contagem, setContagem] = useState(undefined);
  useEffect(() => {
    setMapa(undefined);
    return onSnapshot(cMapaAcomodacao(eventoId), (s) => setMapa(s.exists() ? s.data() : null), () => setMapa(null));
  }, [eventoId]);
  useEffect(() => {
    setContagem(undefined);
    return ouvirContagem(eventoId, setContagem);
  }, [eventoId]);

  const valor = (id) => contagem?.categorias?.[id]?.valor ?? null;
  const m = mapa?.lugares ? contarEstados(mapa.lugares) : null;
  const auditorio = m ? m.ocupados : null;
  const emPe = valor("emPe");
  const voluntarios = valor("voluntarios");
  const salas = SALAS.map((s) => ({ ...s, n: valor(s.id) }));
  const criancas = salas.some((s) => s.n != null) ? salas.reduce((t, s) => t + (s.n ?? 0), 0) : null;
  const partes = [auditorio, emPe, voluntarios, criancas];
  const total = partes.some((p) => p != null) ? partes.reduce((t, p) => t + (p ?? 0), 0) : null;
  const aCarregar = mapa === undefined || contagem === undefined;

  const n = (v) => (v == null ? "—" : v);
  const dataTxt = dia.toLocaleDateString("pt-PT", { day: "numeric", month: "long" });

  return (
    <section className="sect resumoDomingo" aria-label="Resumo do domingo">
      <div className="rdTopo">
        <button type="button" className="rdSeta" aria-label="Domingo anterior" onClick={() => setRecuo((r) => r + 1)}>‹</button>
        <div style={{ textAlign: "center" }}>
          <span className="cap">{ehHoje ? "Hoje" : recuo === 0 ? "Último domingo" : "Domingo"}</span>
          <b className="rdData">{dataTxt}</b>
        </div>
        <button type="button" className="rdSeta" aria-label="Domingo seguinte" disabled={recuo === 0} onClick={() => setRecuo((r) => Math.max(0, r - 1))}>›</button>
      </div>

      <div className="rdHeroi">
        <span className="rdTotal">{aCarregar ? "…" : n(total)}</span>
        <span className="rdTotalRot">pessoas na igreja{m ? "" : aCarregar ? "" : " — sem Mapa marcado"}</span>
      </div>

      <div className="rdGrelha">
        <div className="rdCartao">
          <span className="rdNum">{n(auditorio)}</span>
          <span className="rdRot">No auditório</span>
          {m && <span className="rdSub">de {m.capacidadeUtil} lugares</span>}
        </div>
        <div className="rdCartao">
          <span className="rdNum">{n(emPe)}</span>
          <span className="rdRot">Em pé</span>
        </div>
        <div className="rdCartao">
          <span className="rdNum">{n(voluntarios)}</span>
          <span className="rdRot">Voluntários</span>
          <span className="rdSub">presentes</span>
        </div>
        <div className="rdCartao">
          <span className="rdNum">{n(criancas)}</span>
          <span className="rdRot">Crianças</span>
          <span className="rdSub">nas 5 salas</span>
        </div>
      </div>

      <div className="rdSalas" aria-label="Crianças por sala">
        {salas.map((s) => (
          <span key={s.id} className="rdSala">
            <b>{n(s.n)}</b>
            <small>{s.nome}</small>
          </span>
        ))}
      </div>

      <div className="rdLinha">
        <span>Visitantes <b>{n(m?.visitantes)}</b></span>
        <span>Apelo <b>{n(m?.apelo)}</b></span>
      </div>
      <p className="ds" style={{ marginTop: 6, fontSize: 11.5 }}>
        Visitantes e apelo já estão contados no auditório. "—" = ainda ninguém marcou.
      </p>
    </section>
  );
}
