import { useState } from "react";
import SheetEditarMensagem from "./SheetEditarMensagem.jsx";
import { modeloPadraoEnquete, MODELO_PADRAO_LEMBRETE } from "../lib/mensagensEnquete.js";

/**
 * O botão "Editar texto" e a folha que ele abre — numa linha por sítio
 * de uso, para as seis bases com enquete não escreverem seis vezes o
 * mesmo estado.
 *
 * @param tipo       "enquete" | "lembrete"
 * @param mensagens  `mensagens` do `useMensagensEnquete()` da página
 * @param guardar    `guardar` do mesmo gancho
 * @param enquetes   as enquetes abertas, para a pré-visualização
 * @param dominio    ver `dominioDaBase()`
 * @param estilo     ajuste de espaçamento do botão em cada tela
 */
export default function EditarMensagemEnquete({ tipo, mensagens, guardar, enquetes = [], dominio, nomeExemplo, estilo, rotulo = "Editar" }) {
  const [aberto, setAberto] = useState(false);
  const padrao = tipo === "enquete" ? modeloPadraoEnquete(enquetes.length || 1, dominio) : MODELO_PADRAO_LEMBRETE;
  const emVigor = mensagens?.[tipo] || padrao;

  return (
    <>
      <button
        className="btn sec" type="button"
        style={{ padding: "7px 13px", fontSize: 12, whiteSpace: "nowrap", flex: "none", ...estilo }}
        onClick={() => setAberto(true)}
      >
        {rotulo}{mensagens?.[tipo] ? " ✎" : ""}
      </button>
      {aberto && (
        <SheetEditarMensagem
          tipo={tipo} modelo={emVigor} padrao={padrao}
          enquetes={enquetes.length ? enquetes : [{ mes: exemploMes(), prazo: exemploPrazo() }]}
          dominio={dominio} nomeExemplo={nomeExemplo}
          onGuardar={(texto) => guardar(tipo, texto)}
          onFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

// só quando não há nenhuma enquete aberta (o lembrete pode editar-se sem
// enquetes de fundo): dá à pré-visualização algo verosímil em vez de vazio
const pad = (n) => String(n).padStart(2, "0");
function exemploMes() {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function exemploPrazo() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-25`;
}
