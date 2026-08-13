import { useEffect, useState } from "react";
import { abrirEnquete } from "../../lib/enquetes";
import { obterEventosDoMes, criarCultoEspecial } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

const pad2 = (n) => String(n).padStart(2, "0");

// sugestão inicial: o mês seguinte ao de hoje — é sempre esse que se
// pergunta (ver CLAUDE.md: "se hoje ≥ dia 15 e não existe enquete
// aberta para o mês seguinte")
function mesSeguinte(hoje) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

// "2026-09" → "2026-10" — para quem costuma abrir a enquete de dois
// em dois meses de uma vez, sem ter de voltar aqui daqui a 15 dias
function proximoMes(mesStr) {
  const [ano, m] = mesStr.split("-").map(Number);
  const d = new Date(ano, m, 1); // m já é 1-based, então isto já é o mês seguinte
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export default function SheetAbrirEnquete({ onFechar, onGuardado }) {
  const torrada = useTorrada();
  const hoje = new Date();
  const [mes, setMes] = useState(mesSeguinte(hoje));
  const [prazo, setPrazo] = useState(`${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}-25`);
  const [eventos, setEventos] = useState([]);
  const [selecionados, setSelecionados] = useState({});
  const [aCarregar, setACarregar] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [aAdicionarEspecial, setAAdicionarEspecial] = useState(false);
  const [nomeEspecial, setNomeEspecial] = useState("");
  const [diaEspecial, setDiaEspecial] = useState("");
  const [aCriarEspecial, setACriarEspecial] = useState(false);
  const [tambemMesSeguinte, setTambemMesSeguinte] = useState(false);

  useEffect(() => {
    const [ano, m] = mes.split("-").map(Number);
    setACarregar(true);
    obterEventosDoMes(ano, m - 1)
      .then((evs) => {
        setEventos(evs);
        setSelecionados(Object.fromEntries(evs.map((e) => [e.id, true])));
      })
      .finally(() => setACarregar(false));
  }, [mes]);

  function alternar(id) {
    setSelecionados((s) => ({ ...s, [id]: !s[id] }));
  }

  async function adicionarEspecial() {
    const nome = nomeEspecial.trim();
    const dia = parseInt(diaEspecial, 10);
    const [ano, m] = mes.split("-").map(Number);
    const maxDia = new Date(ano, m, 0).getDate();
    if (!nome) return torrada("Falta o nome do culto especial.");
    if (!dia || dia < 1 || dia > maxDia) return torrada(`O dia tem de estar entre 1 e ${maxDia}`);

    const data = `${ano}-${pad2(m)}-${pad2(dia)}`;
    if (eventos.some((e) => e.id === data)) return torrada("Já há um culto nesse dia.");
    setACriarEspecial(true);
    try {
      await criarCultoEspecial({ data, tipo: nome, horaCulto: "10:30", horaChegada: "08:00" });
      const novo = { id: data, data, tipo: nome };
      setEventos((evs) => [...evs, novo].sort((a, b) => a.data.localeCompare(b.data)));
      setSelecionados((s) => ({ ...s, [data]: true }));
      setNomeEspecial(""); setDiaEspecial(""); setAAdicionarEspecial(false);
      torrada(`${nome} criado`);
    } catch (e) {
      torrada(e.message || "Não foi possível criar o culto especial.");
    } finally {
      setACriarEspecial(false);
    }
  }

  async function guardar() {
    const domingos = eventos.filter((e) => selecionados[e.id]).map((e) => e.id);
    if (!domingos.length) return torrada("Escolhe pelo menos um culto.");
    if (!prazo) return torrada("Falta o prazo.");
    setAEnviar(true);
    try {
      await abrirEnquete({ mes, prazo, domingos });
      let mensagem = "Enquete aberta";
      if (tambemMesSeguinte) {
        const mes2 = proximoMes(mes);
        const [ano2, m2] = mes2.split("-").map(Number);
        const eventos2 = await obterEventosDoMes(ano2, m2 - 1);
        if (eventos2.length) {
          await abrirEnquete({ mes: mes2, prazo, domingos: eventos2.map((e) => e.id) });
          mensagem = "Enquetes de dois meses abertas";
        } else {
          torrada(`Sem cultos criados para o mês seguinte ainda — só abri a de ${mes}.`);
        }
      }
      onGuardado(mensagem);
    } catch (e) {
      torrada(e.message || "Não foi possível abrir a enquete.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Abrir enquete de indisponibilidade</h2>
        <p className="sb2">"Tens alguma indisponibilidade este mês?"</p>

        <label className="rot">Mês</label>
        <input className="campo" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />

        <label className="rot">Prazo para responder</label>
        <input className="campo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />

        <div className="linha" style={{ cursor: "pointer", marginTop: 8 }} onClick={() => setTambemMesSeguinte((v) => !v)}>
          <button className={`chk${tambemMesSeguinte ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); setTambemMesSeguinte((v) => !v); }}>✓</button>
          <div style={{ flex: 1 }}>
            <p className="nmt">Já abrir também o mês seguinte</p>
            <p className="ds">Junta todos os cultos dele automaticamente, com o mesmo prazo</p>
          </div>
        </div>

        <label className="rot" style={{ marginTop: 14 }}>Cultos deste mês</label>
        {aCarregar && <div className="vaz">A carregar…</div>}
        {!aCarregar && !eventos.length && <div className="vaz">Sem cultos criados para este mês ainda.</div>}
        {eventos.map((ev) => (
          <div className="linha" style={{ cursor: "pointer" }} key={ev.id} onClick={() => alternar(ev.id)}>
            <button className={`chk${selecionados[ev.id] ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); alternar(ev.id); }}>✓</button>
            <div style={{ flex: 1 }}>
              <p className="nmt">{ev.tipo || dataPorExtenso(ev.data)}</p>
              {ev.tipo && <p className="ds">{dataPorExtenso(ev.data)}</p>}
            </div>
          </div>
        ))}

        {!aAdicionarEspecial ? (
          <button className="btn sec full" style={{ marginTop: 8 }} onClick={() => setAAdicionarEspecial(true)}>
            + Adicionar culto especial
          </button>
        ) : (
          <div className="caixa" style={{ marginTop: 8 }}>
            <label className="rot">Nome do culto</label>
            <input className="campo" value={nomeEspecial} onChange={(e) => setNomeEspecial(e.target.value)} placeholder="Ex.: Culto de Jovens" />
            <label className="rot" style={{ marginTop: 8 }}>Dia do mês</label>
            <input className="campo" type="number" min="1" max="31" value={diaEspecial} onChange={(e) => setDiaEspecial(e.target.value)} placeholder="14" />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aCriarEspecial} onClick={() => setAAdicionarEspecial(false)}>Cancelar</button>
              <button className="btn" style={{ flex: 1, fontSize: 12.5 }} disabled={aCriarEspecial} onClick={adicionarEspecial}>
                {aCriarEspecial ? "A criar…" : "Criar e adicionar"}
              </button>
            </div>
          </div>
        )}

        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar || aCarregar} onClick={guardar}>
          {aEnviar ? "A abrir…" : "Abrir enquete"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
