import { dataPorExtenso } from "@portal/shared/lib/data.js";
import EditorMapaAuditorio from "./EditorMapaAuditorio";

/**
 * Editar um mapa AO VIVO de um domingo já passado, sem fechar nem
 * excluir — pedido 2026-09 ("já aparece ali os dados do mapa de 20 de
 * setembro, mas as opções para Fechar e Excluir, precisa ter também
 * para EDITAR, e aí abre o mapa lá na tela e eu vou editando
 * novamente"). Terceira ação na lista "Mapas por fechar", ao lado de
 * "Fechar agora"/"Excluir".
 *
 * Mesmo `EditorMapaAuditorio` da própria `Acomodacao.jsx` (o mapa de
 * hoje) — só o `eventoId` muda, escolhido aqui em vez de assumido.
 * Sem `onFechar`/`onReabrir`: fechar já tem o botão "Fechar agora" na
 * lista, que atualiza a lista sozinho; dar o mesmo botão aqui dentro
 * deixava-a desatualizada até ao próximo carregamento.
 */
export default function SheetEditarMapa({ eventoId, uid, papel, onFechar }) {
  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label={`Editar mapa de ${dataPorExtenso(eventoId)}`} style={{ maxHeight: "88vh", overflowY: "auto" }}>
        <div className="pux" />
        <h2>{dataPorExtenso(eventoId)}</h2>
        <p className="ds" style={{ marginTop: 4 }}>A editar o mapa deste domingo — as marcações gravam ao vivo, como sempre.</p>
        <div style={{ marginTop: 14 }}>
          <EditorMapaAuditorio eventoId={eventoId} uid={uid} papel={papel} />
        </div>
        <button className="btn sec full" style={{ marginTop: 6 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
