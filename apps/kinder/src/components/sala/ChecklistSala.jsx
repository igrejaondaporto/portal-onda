import { useEffect, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { nomeEvento } from "@portal/shared/lib/data.js";
import { CATEGORIAS, minhaSalaRestrita, nomeCategoria, souLider, varsCategoria } from "../../lib/modelo";
import { obterEventosDoMes, ouvirVoluntarios } from "../../lib/painel";
import {
  hojeLocal, ouvirItensChecklist, ouvirMarcasChecklist, marcarItem, desmarcarItem,
  criarItemChecklist, desativarItemChecklist,
} from "../../lib/kinder";
import SeletorCategoria from "../SeletorCategoria";

const FASES = [["abrir", "Ao abrir a sala"], ["fechar", "Ao fechar a sala"]];

/**
 * Checklist de cada sala no culto de hoje (ou no próximo): higienizar
 * brinquedos, fraldário, materiais da lição prontos… Qualquer
 * voluntário marca (escrita direta — funciona sem rede); só as
 * líderes mudam os itens. Sem dados de crianças.
 */
export default function ChecklistSala({ uid, papel, pessoa }) {
  const torrada = useTorrada();
  const lider = souLider(papel);
  const restrita = minhaSalaRestrita(papel, pessoa);
  const [evento, setEvento] = useState(null);
  const [sala, setSala] = useState(restrita ?? pessoa?.categoria ?? CATEGORIAS[0].id);
  const [itens, setItens] = useState([]);
  const [marcas, setMarcas] = useState({});
  const [voluntarios, setVoluntarios] = useState([]);
  const [novo, setNovo] = useState({ abrir: "", fechar: "" });

  useEffect(() => {
    const agora = new Date();
    const seguinte = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
    const hoje = hojeLocal();
    Promise.all([obterEventosDoMes(agora.getFullYear(), agora.getMonth()), obterEventosDoMes(seguinte.getFullYear(), seguinte.getMonth())])
      .then(([a, b]) => setEvento([...a, ...b].find((e) => e.data >= hoje) ?? null));
  }, []);
  useEffect(() => ouvirItensChecklist(setItens), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => { if (evento) return ouvirMarcasChecklist(evento.id, sala, setMarcas); }, [evento, sala]);
  useEffect(() => { if (restrita) setSala(restrita); }, [restrita]);

  const daSala = itens.filter((i) => i.categoria === sala || i.categoria === "todas");
  const feitos = daSala.filter((i) => marcas[i.id]).length;
  const pct = daSala.length ? Math.round((feitos / daSala.length) * 100) : 0;

  function alternar(item) {
    if (!evento) return;
    const escrita = marcas[item.id] ? desmarcarItem(evento.id, sala, item.id) : marcarItem(evento.id, sala, item.id, uid);
    escrita.catch((e) => torrada(e.message || "Não foi possível atualizar.", true));
  }

  async function juntar(fase) {
    const texto = novo[fase].trim();
    if (!texto) return;
    try {
      await criarItemChecklist({ texto, categoria: sala, fase });
      setNovo((n) => ({ ...n, [fase]: "" }));
    } catch (e) {
      torrada(e.message || "Não foi possível juntar.", true);
    }
  }

  if (!evento) return <div className="vaz" style={{ marginTop: 16 }}>Sem culto marcado nas próximas semanas.</div>;

  return (
    <div className="sect" style={{ marginTop: 12 }}>
      <div className="cabecalho"><h3>{nomeEvento(evento)}</h3><span className="cap">{feitos} de {daSala.length}</span></div>
      {restrita ? (
        <p className="kin-tagcat" style={varsCategoria(restrita)}>{nomeCategoria(restrita)}</p>
      ) : (
        <SeletorCategoria valor={sala} onMudar={setSala} comTodas={false} />
      )}
      <div className="barra" style={{ marginTop: 10 }}><i style={{ width: `${pct}%`, background: varsCategoria(sala)["--c"] }} /></div>
      {FASES.map(([fase, titulo]) => {
        const lista = daSala.filter((i) => i.fase === fase);
        return (
          <div key={fase}>
            <div className="fasecab"><h4>{titulo}</h4><em>{lista.filter((i) => marcas[i.id]).length}/{lista.length}</em></div>
            {lista.length === 0 && <p className="ds">Sem itens para a sala {nomeCategoria(sala)}.</p>}
            {lista.map((i) => {
              const m = marcas[i.id];
              return (
                <div className={`linha${m ? " feita" : ""}`} key={i.id} style={{ cursor: "pointer" }} onClick={() => alternar(i)}>
                  <button className={`chk${m ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); alternar(i); }}>✓</button>
                  <div style={{ flex: 1 }}>
                    <p className="nmt" style={{ fontSize: 15 }}>{i.texto}</p>
                    {m && <p className="ds">{voluntarios.find((p) => p.id === m.por)?.nome ?? "alguém"} · {m.hora}</p>}
                  </div>
                  {lider && (
                    <button className="oc-icobt mag" aria-label={`Tirar ${i.texto}`} onClick={(e) => { e.stopPropagation(); desativarItemChecklist(i.id).catch((er) => torrada(er.message, true)); }}>✕</button>
                  )}
                </div>
              );
            })}
            {lider && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input className="campo" style={{ flex: 1, margin: 0 }} value={novo[fase]} placeholder="Novo item"
                  onChange={(e) => setNovo((n) => ({ ...n, [fase]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") juntar(fase); }} />
                <button className="btn sec" onClick={() => juntar(fase)}>Juntar</button>
              </div>
            )}
          </div>
        );
      })}
      <p className="ds" style={{ marginTop: 12 }}>
        {daSala.length && feitos === daSala.length ? "Está tudo feito nesta sala." : "Cada marca fica com o teu nome e a hora."}
      </p>
    </div>
  );
}
