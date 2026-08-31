import PainelChamadas from "@portal/shared/components/PainelChamadas.jsx";

/* A lógica e a UI vivem em @portal/shared — genuinamente igual ao
 * kinder.igrejaonda.pt (ver apps/kinder). Aqui a Técnica vê TODOS os
 * canais (sem canaisPermitidos, mostra todos), diferente do kinder
 * standalone, onde cada estação fica trancada num só. */
export default function Chamadas({ definirCabecalho }) {
  return <PainelChamadas definirCabecalho={definirCabecalho} />;
}
