import { useEffect, useMemo, useState } from "react";
import {
  NOTAS, MOEDAS, rotuloDenominacao, totalDe, emEuros,
  ouvirContagens, guardarContagem, novaContagemId, domingoMaisRecente,
} from "../lib/oferta";
import { Nota, Moeda } from "../components/DinheiroEuro";
import { eur, dataPorExtenso } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const vazio = (denominacoes) => Object.fromEntries(denominacoes.map((d) => [d, 0]));

/** Uma linha da contagem: a nota/moeda desenhada, o subtotal, e o
 *  contador. O campo aceita escrever o número direto (teclado
 *  numérico) — contar 37 moedas de 10 cêntimos a tocar no "+" 37
 *  vezes seria absurdo; os botões são só para o ajuste fino. */
function LinhaDenominacao({ centimos, quantidade, onMudar, children }) {
  const subtotal = centimos * (quantidade || 0);
  return (
    <div className="linha" style={{ gap: 11 }}>
      {children}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="nmt">{rotuloDenominacao(centimos)}</p>
        <p
          className="ds"
          style={{ fontVariantNumeric: "tabular-nums", ...(subtotal ? { color: "var(--azul)", fontWeight: 700 } : null) }}
        >
          {subtotal ? eur(emEuros(subtotal)) : "—"}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "none" }}>
        <button
          className="btn sec" aria-label="menos um"
          style={{ padding: 0, width: 32, height: 32, fontSize: 18, lineHeight: 1, flex: "none" }}
          onClick={() => onMudar(Math.max(0, (quantidade || 0) - 1))}
        >
          −
        </button>
        <input
          className="campo" type="number" inputMode="numeric" min="0" max="9999"
          value={quantidade || 0}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onMudar(Math.max(0, Math.min(9999, Number(e.target.value) || 0)))}
          style={{ width: 54, marginTop: 0, padding: "7px 4px", textAlign: "center", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
        />
        <button
          className="btn sec" aria-label="mais um"
          style={{ padding: 0, width: 32, height: 32, fontSize: 18, lineHeight: 1, flex: "none" }}
          onClick={() => onMudar(Math.min(9999, (quantidade || 0) + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Contagem da oferta do culto, nota a nota e moeda a moeda. Guarda
 *  em cêntimos (ver lib/oferta.js) e mostra sempre os três números
 *  que interessam a quem fecha o saco: notas, moedas e o total. */
export default function Oferta({ uid, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const [contagens, setContagens] = useState([]);
  const [id, setId] = useState(() => novaContagemId());
  const [data, setData] = useState(() => domingoMaisRecente());
  const [notas, setNotas] = useState(() => vazio(NOTAS));
  const [moedas, setMoedas] = useState(() => vazio(MOEDAS));
  const [observacao, setObservacao] = useState("");
  const [aEditar, setAEditar] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => ouvirContagens(setContagens), []);

  const totalNotas = useMemo(() => totalDe(notas), [notas]);
  const totalMoedas = useMemo(() => totalDe(moedas), [moedas]);
  const total = totalNotas + totalMoedas;

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Oferta</em>,
      subtitulo: "Contagem do culto, nota a nota",
      chips: [],
    });
  }, [ativo, definirCabecalho]);

  function limpar() {
    setId(novaContagemId());
    setData(domingoMaisRecente());
    setNotas(vazio(NOTAS));
    setMoedas(vazio(MOEDAS));
    setObservacao("");
    setAEditar(false);
  }

  function abrir(c) {
    setId(c.id);
    setData(c.data);
    setNotas({ ...vazio(NOTAS), ...(c.notas || {}) });
    setMoedas({ ...vazio(MOEDAS), ...(c.moedas || {}) });
    setObservacao(c.observacao ?? "");
    setAEditar(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function guardar() {
    if (!total) return torrada("A contagem está a zero — conta alguma coisa primeiro.");
    setAGuardar(true);
    try {
      await guardarContagem(uid, id, { data, notas, moedas, observacao: observacao.trim() });
      torrada(aEditar ? "Contagem corrigida" : `Contagem de ${eur(emEuros(total))} guardada`);
      limpar();
    } catch (e) {
      torrada(e.message || "Não foi possível guardar a contagem.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="destaque" style={{ cursor: "default" }}>
        <div>
          <p style={{ fontSize: 12.5, opacity: 0.85 }}>{aEditar ? "A corrigir contagem" : "Total contado"}</p>
          <p style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.035em", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
            {eur(emEuros(total))}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 12.5, opacity: 0.85 }}>Notas {eur(emEuros(totalNotas))}</p>
          <p style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>Moedas {eur(emEuros(totalMoedas))}</p>
        </div>
      </div>

      <label className="rot">Culto</label>
      <input className="campo" type="date" value={data} onChange={(e) => setData(e.target.value)} />

      <div className="sect">
        <div className="cabecalho"><h3>Notas</h3><span className="cap">{eur(emEuros(totalNotas))}</span></div>
        {NOTAS.map((c) => (
          <LinhaDenominacao
            key={c} centimos={c} quantidade={notas[c]}
            onMudar={(n) => setNotas((m) => ({ ...m, [c]: n }))}
          >
            <Nota centimos={c} />
          </LinhaDenominacao>
        ))}
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Moedas</h3><span className="cap">{eur(emEuros(totalMoedas))}</span></div>
        {MOEDAS.map((c) => (
          <LinhaDenominacao
            key={c} centimos={c} quantidade={moedas[c]}
            onMudar={(n) => setMoedas((m) => ({ ...m, [c]: n }))}
          >
            <Moeda centimos={c} />
          </LinhaDenominacao>
        ))}
      </div>

      <label className="rot">Observação (opcional)</label>
      <textarea
        className="campo" rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)}
        placeholder="Ex.: envelope com 50 € para missões, contado à parte"
      />

      <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar} onClick={guardar}>
        {aEditar ? "Guardar correção" : "Guardar contagem"}
      </button>
      {(aEditar || total > 0) && (
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={limpar}>
          {aEditar ? "Cancelar correção" : "Limpar"}
        </button>
      )}

      <div className="sect">
        <div className="cabecalho"><h3>Contagens anteriores</h3></div>
        {contagens.length ? contagens.slice(0, 20).map((c) => (
          <div className="linha" key={c.id} style={{ cursor: "pointer" }} onClick={() => abrir(c)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="nmt">{eur(emEuros(c.total))}</p>
              <p className="ds">
                {c.data ? dataPorExtenso(c.data) : "sem data"} · notas {eur(emEuros(c.totalNotas))} · moedas {eur(emEuros(c.totalMoedas))}
              </p>
            </div>
            <span className="seta">›</span>
          </div>
        )) : <div className="vaz">Ainda não há contagens guardadas.</div>}
      </div>
    </>
  );
}
