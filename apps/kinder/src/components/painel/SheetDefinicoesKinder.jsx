import { useEffect, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { CATEGORIAS, FAIXAS_PADRAO } from "../../lib/modelo";
import { guardarDefinicao, dadosRegisto } from "../../lib/kinder";

/**
 * Idades de cada sala (só servem para sugerir a sala de uma criança
 * nova — a líder pode sempre mudar) e o texto do consentimento que os
 * pais aceitam no registo. Mudar o texto sobe a versão: cada família
 * fica com a versão que aceitou.
 */
export default function SheetDefinicoesKinder({ onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [faixas, setFaixas] = useState(null);
  const [texto, setTexto] = useState("");
  const [original, setOriginal] = useState(null);
  const [linkGrupo, setLinkGrupo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    dadosRegisto()
      .then((d) => {
        setFaixas(d.faixas);
        setTexto(d.consentimento.texto);
        setOriginal(d.consentimento);
        setLinkGrupo(d.grupoPais?.link || "");
      })
      .catch(() => { setFaixas(FAIXAS_PADRAO); torrada("Não foi possível carregar as definições.", true); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mudarFaixa = (cat, campo, valor) =>
    setFaixas((f) => ({ ...f, [cat]: { ...f[cat], [campo]: valor === "" ? "" : Number(valor) } }));

  async function guardar() {
    const invalida = CATEGORIAS.find((c) => !Number.isInteger(faixas[c.id].min) || !Number.isInteger(faixas[c.id].max) || faixas[c.id].min > faixas[c.id].max);
    if (invalida) return torrada(`As idades de ${invalida.nome} não estão certas.`, true);
    if (!texto.trim()) return torrada("O consentimento não pode ficar vazio.", true);
    if (linkGrupo.trim() && !/^https:\/\//.test(linkGrupo.trim())) return torrada("O link do grupo tem de começar por https://", true);
    setAEnviar(true);
    try {
      await guardarDefinicao("categorias", { faixas });
      if (texto.trim() !== original?.texto) {
        const n = Number(String(original?.versao || "").replace(/\D/g, "")) || 0;
        await guardarDefinicao("consentimento", { texto: texto.trim(), versao: `v${n + 1}` });
      }
      await guardarDefinicao("grupoPais", { link: linkGrupo.trim() });
      onGuardado("Definições guardadas");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.", true);
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Salas e consentimento</h2>
        {!faixas ? <div className="vaz" style={{ marginTop: 12 }}>A carregar…</div> : (
          <>
            <p className="rot" style={{ marginTop: 14 }}>Idades (anos completos)</p>
            {CATEGORIAS.map((c) => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 8, alignItems: "center", marginTop: 6 }}>
                <p className="nmt">{c.nome}</p>
                <input className="campo" style={{ margin: 0 }} type="number" min="0" value={faixas[c.id].min} onChange={(e) => mudarFaixa(c.id, "min", e.target.value)} aria-label={`${c.nome} desde`} />
                <input className="campo" style={{ margin: 0 }} type="number" min="0" value={faixas[c.id].max} onChange={(e) => mudarFaixa(c.id, "max", e.target.value)} aria-label={`${c.nome} até`} />
              </div>
            ))}
            <p className="ds" style={{ marginTop: 6 }}>Só sugerem a sala de uma criança nova; podes sempre mudá-la na ficha.</p>
            <label className="rot">Texto do consentimento {original?.versao ? `(${original.versao})` : ""}</label>
            <textarea className="campo" rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} />
            <p className="ds" style={{ marginTop: 6 }}>
              <span className="kin-alerta">Validar este texto com a igreja antes de o usar com os pais.</span>
            </p>
            <label className="rot" style={{ marginTop: 14 }}>Link do grupo dos pais do Kinder (opcional)</label>
            <input className="campo" type="url" value={linkGrupo} onChange={(e) => setLinkGrupo(e.target.value)} placeholder="https://chat.whatsapp.com/…" />
            <p className="ds" style={{ marginTop: 6 }}>
              Mostrado no fim do registo a quem se disser membro da Onda. Vazio = não aparece nada.
            </p>
            <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
          </>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
