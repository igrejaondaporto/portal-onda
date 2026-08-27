import OrdemCultoAoVivo from "@portal/shared/components/OrdemCultoAoVivo.jsx";

/** A cronologia nativa que os voluntários veem — sem clicar em nada.
 *  Quando a Técnica está a gravar o culto com o FreeShow, mostra o
 *  horário real por cima do previsto, ao vivo — só leitura aqui, quem
 *  inicia/corrige é sempre a Técnica (ver
 *  apps/tecnica/src/lib/cultoAoVivo.js). Sem gravação nenhuma, mostra
 *  só o previsto do PDF, como sempre mostrou. */
export default function OrdemCultoTimeline({ ordem, chegada, hoje, aoVivo }) {
  return <OrdemCultoAoVivo ordem={ordem} chegada={chegada} hoje={hoje} aoVivo={aoVivo} />;
}
