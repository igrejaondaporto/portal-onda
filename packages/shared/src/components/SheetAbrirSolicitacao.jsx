import { useEffect, useState } from "react";
import { abrirSolicitacao, obterSlaDiasMinimos, obterMinisteriosComunicacao, diasAte } from "../lib/solicitacoes.js";
import { useTorrada } from "../lib/TorradaContext.jsx";
import { BASE_ID } from "../lib/firebase.js";

// só para o seletor de base, quando é a própria Comunicação a abrir
// (ver mais abaixo) — lista fixa, as bases não mudam com frequência
const NOMES_BASE = { apoio: "Apoio", tecnica: "Técnica", backstage: "Backstage", comunicacao: "Comunicação (interno)" };

/** "Pedir à Comunicação" — igual em qualquer base, por isso vive em
 *  packages/shared (ver CLAUDE.md raiz). Só líderes de base abrem
 *  (gate no botão que chama isto, não aqui — a Cloud Function
 *  `abrirSolicitacao` também exige líder).
 *
 *  Base solicitante: para as outras três bases é sempre a própria —
 *  nunca escolhem, a Cloud Function usa o token. Só a Comunicação tem
 *  o seletor (`souComunicacao`), porque o pedido dela pode ser "em
 *  nome de" outra base (alguém pediu por fora do sistema) ou um
 *  trabalho interno — só ela precisa de dizer qual das duas.
 *
 *  Ministério: pelo mesmo motivo, só a Comunicação escolhe já na
 *  abertura — as outras bases não sabem o organograma dela, e o líder
 *  atribui isso na triagem (ver `atribuirSolicitacao`,
 *  `apps/comunicacao/CLAUDE.md`). */
export default function SheetAbrirSolicitacao({ onFechar, onGuardado }) {
  const torrada = useTorrada();
  const souComunicacao = BASE_ID === "comunicacao";
  const [titulo, setTitulo] = useState("");
  const [oQue, setOQue] = useState("");
  const [ondeUsa, setOndeUsa] = useState("");
  const [textoFinal, setTextoFinal] = useState("");
  const [linkReferencia, setLinkReferencia] = useState("");
  const [prazo, setPrazo] = useState("");
  const [ministerios, setMinisterios] = useState([]);
  const [ministerioId, setMinisterioId] = useState("");
  const [baseSolicitanteId, setBaseSolicitanteId] = useState(souComunicacao ? "" : BASE_ID);
  const [slaDiasMinimos, setSlaDiasMinimos] = useState(3);
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => { obterSlaDiasMinimos().then(setSlaDiasMinimos); }, []);
  useEffect(() => { if (souComunicacao) obterMinisteriosComunicacao().then(setMinisterios); }, [souComunicacao]);

  const foraDoPrazo = prazo && diasAte(prazo) < slaDiasMinimos;

  async function enviar() {
    if (!titulo.trim()) return torrada("Falta o título.");
    if (!oQue.trim()) return torrada("Falta dizer o que precisas.");
    if (!ondeUsa.trim()) return torrada("Falta dizer onde isto vai ser usado.");
    if (!prazo) return torrada("Falta o prazo.");
    if (souComunicacao && !ministerioId) return torrada("Falta escolher para que ministério é.");
    if (souComunicacao && !baseSolicitanteId) return torrada("Falta escolher de que base é o pedido.");
    setAEnviar(true);
    try {
      await abrirSolicitacao({
        titulo: titulo.trim(), oQue: oQue.trim(), ondeUsa: ondeUsa.trim(),
        textoFinal: textoFinal.trim(), linkReferencia: linkReferencia.trim(), prazo,
        ...(souComunicacao ? { ministerioId, baseSolicitanteId } : {}),
      });
      onGuardado("Pedido enviado à Comunicação");
    } catch (e) {
      torrada(e.message || "Não foi possível enviar.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Pedir à Comunicação</h2>
        <p className="sb2">Peças gráficas, vídeo, fotografia — o que precisares</p>

        <label className="rot" style={{ marginTop: 14 }}>Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Cartaz do Culto de Jovens" />

        <label className="rot">O que precisas</label>
        <textarea className="campo" rows={3} value={oQue} onChange={(e) => setOQue(e.target.value)} placeholder="Descreve o pedido" />

        <label className="rot">Onde vai ser usado</label>
        <input className="campo" value={ondeUsa} onChange={(e) => setOndeUsa(e.target.value)} placeholder="Ex.: Stories do Instagram, domingo" />

        {souComunicacao && (
          <>
            <label className="rot">De que base é o pedido</label>
            <select className="campo" value={baseSolicitanteId} onChange={(e) => setBaseSolicitanteId(e.target.value)}>
              <option value="">Escolhe uma</option>
              {Object.entries(NOMES_BASE).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </>
        )}

        {souComunicacao && (
          <>
            <label className="rot">Para que ministério</label>
            <select className="campo" value={ministerioId} onChange={(e) => setMinisterioId(e.target.value)}>
              <option value="">Escolhe um</option>
              {ministerios.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </>
        )}

        <label className="rot">Texto final (opcional)</label>
        <textarea className="campo" rows={2} value={textoFinal} onChange={(e) => setTextoFinal(e.target.value)} placeholder="Se já tiveres o texto pronto" />

        <label className="rot">Link de referência (opcional)</label>
        <input className="campo" value={linkReferencia} onChange={(e) => setLinkReferencia(e.target.value)} placeholder="Um exemplo, um Drive…" />

        <label className="rot">Prazo</label>
        <input className="campo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        {foraDoPrazo && (
          <p className="ds" style={{ marginTop: 6, color: "var(--magenta)" }}>
            Menos de {slaDiasMinimos} dias — entra na fila marcado como fora do prazo mínimo. A entrega a tempo não é garantida.
          </p>
        )}

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={enviar}>
          {aEnviar ? "A enviar…" : "Enviar pedido"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
