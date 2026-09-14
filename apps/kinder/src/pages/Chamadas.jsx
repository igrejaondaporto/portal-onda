import { useEffect } from "react";
import { minhaSalaRestrita } from "../lib/modelo";
import PainelChamadas from "@portal/shared/components/PainelChamadas.jsx";

const SALAS = ["baby", "fun", "junior"];

/**
 * Chamar os pais pelo telão — separador próprio (era sub-aba do
 * Culto, ganhou menu quando os outros crescerem a mais para caber
 * numa sub-aba). Presa à sala, como tudo o resto no Portal — até
 * para a líder de sala; só a líder geral chama e vê o histórico das
 * três (ver `minhaSalaRestrita`, a única excepção é a Escala).
 *
 * `definirCabecalho` próprio (não o do `PainelChamadas`): como esta
 * página, tal como as outras, fica sempre montada (só o `display`
 * do pai muda), o efeito do `PainelChamadas` só corre uma vez, no
 * arranque — sem `ativo`, o cabeçalho ficava agarrado ao que a
 * última página visitada tinha escrito. */
export default function Chamadas({ papel, pessoa, ativo, definirCabecalho }) {
  const restrita = minhaSalaRestrita(papel, pessoa);
  const canais = restrita ? [restrita] : SALAS;

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({ titulo: <em>Chamadas</em>, subtitulo: "Escreve o nome e aparece na projeção", chips: [] });
  }, [ativo, definirCabecalho]);

  return <PainelChamadas canaisPermitidos={canais} canaisHistorico={canais} ativo={ativo} />;
}
