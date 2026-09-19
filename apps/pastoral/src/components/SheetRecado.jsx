import { useState } from "react";
import { enviarRecadoPastoral } from "../lib/pastoral";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const MAX = 600;

/**
 * Um recado para uma base — de ida, sem resposta.
 *
 * Decisão explícita do dono do produto: o painel observa, não age. Isto
 * é a única coisa que sai daqui para outra base, e de propósito não
 * tem estado nenhum ("feito", "em curso", "respondido"): o pastor
 * escreve, aparece no Início da base, o líder lê e dispensa.
 *
 * Não é uma `solicitacao` — essa tem prazo, transferência, atribuição e
 * histórico de estados, e nada disso se aplica. Reaproveitar aquele
 * modelo daria ao pastor uma fila de pedidos por despachar que ninguém
 * pediu.
 *
 * Desde 2026-09 o recado TAMBÉM chega por notificação push, a quem a
 * tiver ligado (`notificarRecado`, functions/notificacoes.js). Nem
 * toda a gente liga, e no iPhone só funciona com a app instalada — por
 * isso o cartão no Início continua a ser o caminho garantido, e o
 * aviso no fundo desta folha diz as duas coisas em vez de prometer que
 * toca um telemóvel.
 *
 * Todo sheet leva um botão de fechar, mesmo tendo ação primária —
 * regra sem exceção desde o Financeiro (um popup sem saída visível já
 * foi reportado como bug).
 */
export default function SheetRecado({ base, onFechar }) {
  const torrada = useTorrada();
  const [texto, setTexto] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo) return torrada("Escreve o recado primeiro.");
    setAEnviar(true);
    try {
      await enviarRecadoPastoral(base.baseId, limpo, urgente);
      torrada(`Recado enviado à ${base.nome}.`);
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível enviar.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Recado à {base.nome}</h2>
        <p className="sb2">Aparece no Início da base. O líder lê e dispensa — não há resposta.</p>

        <label className="rot" style={{ marginTop: 16 }}>O recado</label>
        <textarea
          className="campo" rows={4} value={texto} maxLength={MAX}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: no próximo domingo a equipa chega às 9h, por causa do batismo."
        />
        <p className="cap" style={{ marginTop: 4 }}>{texto.length}/{MAX}</p>

        {/* mesmo padrão de filtros do resto do produto (`.menu` com
            `data-on`) em vez de uma caixa de seleção — dois estados
            explícitos lêem-se melhor do que um quadrado por marcar */}
        <div className="menu" style={{ position: "static", border: 0, padding: "12px 0 0", background: "none", backdropFilter: "none" }}>
          <button data-on={urgente ? "0" : "1"} onClick={() => setUrgente(false)}>Normal</button>
          <button data-on={urgente ? "1" : "0"} onClick={() => setUrgente(true)}>Urgente</button>
        </div>

        <p className="cap" style={{ marginTop: 14 }}>
          Quem tiver notificações ligadas recebe no telemóvel; quem não tiver vê quando abrir a app.
        </p>

        <button className="btn full" style={{ marginTop: 14 }} disabled={aEnviar} onClick={enviar}>
          {aEnviar ? "A enviar…" : "Enviar recado"}
        </button>
        <button className="btn sec full" style={{ marginTop: 8 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
