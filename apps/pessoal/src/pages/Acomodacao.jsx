import { useCallback, useEffect, useMemo, useState } from "react";
import { chamar } from "@portal/shared/lib/firebase.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";
import EditorMapaAuditorio from "../components/acomodacao/EditorMapaAuditorio";
import ResumosAcomodacao from "../components/acomodacao/ResumosAcomodacao";
import MapasPorFechar from "../components/acomodacao/MapasPorFechar";

/** "AAAA-MM-DD" de hoje, no fuso do próprio telemóvel — quem usa isto
 *  já está na igreja, por isso é sempre a data certa. Componentes
 *  locais (não `toISOString`, que é UTC e trocaria o dia perto da
 *  meia-noite) — mesmo cuidado de `dataPorExtenso`/`diaSemanaAbrev`
 *  em packages/shared/src/lib/data.js. */
function hojeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Acomodacao({ uid, papel, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const [souDrive, setSouDrive] = useState(papel === "lider_base");

  // O mapa é sempre o de HOJE — não o culto em que a pessoa está
  // escalada (`obterMeuEvento` podia saltar para o domingo seguinte
  // assim que ninguém da escala de hoje tivesse uma escala futura
  // gerada, e a líder deixava de conseguir ver o mapa de hoje já
  // fechado). Sem "corrigir data": a data nunca está errada, porque
  // nunca se escolhe — é sempre a de agora. Editar um domingo PASSADO
  // é outro caminho, de propósito (pedido 2026-09) — ver "Editar" em
  // `MapasPorFechar.jsx`/`SheetEditarMapa.jsx`, nunca aqui.
  const eventoId = useMemo(() => hojeLocal(), []);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Mapa</em>,
      subtitulo: `Auditório · ${dataPorExtenso(eventoId)}`,
      chips: souDrive ? [] : ["Só leitura — não tens a função Mapa nem és o responsável deste culto"],
    });
  }, [ativo, definirCabecalho, eventoId, souDrive]);

  async function fecharCulto() {
    try {
      await chamar("fecharAcomodacao")({ eventoId });
      torrada("Culto fechado — resumo guardado");
    } catch (e) {
      torrada(e.message || "Não foi possível fechar.");
    }
  }

  // Direto no aviso de fechado — não obriga a ir a "Cultos fechados"
  // (que lista por resumo arquivado; um mapa fechado sem resumo, ex.:
  // um documento antigo de antes de o mapa passar a seguir sempre a
  // data de hoje, nem aparecia lá, e ficava preso sem botão nenhum).
  async function reabrirCulto() {
    try {
      await chamar("reabrirAcomodacao")({ eventoId });
      torrada("Mapa reaberto — já dá para marcar");
    } catch (e) {
      torrada(e.message || "Não foi possível reabrir.");
    }
  }

  const onSouDriveChange = useCallback((v) => setSouDrive(v), []);

  return (
    <>
      <EditorMapaAuditorio
        eventoId={eventoId} uid={uid} papel={papel}
        onFechar={fecharCulto} onReabrir={reabrirCulto}
        onSouDriveChange={onSouDriveChange}
      />

      <ResumosAcomodacao souLiderBase={papel === "lider_base"} />
      <MapasPorFechar souLiderBase={papel === "lider_base"} uid={uid} papel={papel} />
    </>
  );
}
