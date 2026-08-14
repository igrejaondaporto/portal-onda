import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { marcarTourVisto as marcarTourVistoApi, obterConfigTour, composicaoPassos } from "./tour";

const Ctx = createContext(null);

/**
 * Estado do tour, ao nível da sessão (não de uma tela) — precisa
 * sobreviver a trocas de aba a meio da sequência (ex.: passo "Culto"
 * navega para outra página). Modelado em TorradaContext.jsx.
 */
export function TourProvider({ children }) {
  const [passos, setPassos] = useState([]);
  const [passoAtual, setPassoAtual] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [buscaSeq, setBuscaSeq] = useState(0);
  const irParaRef = useRef(() => {});
  const marcarAoTerminarRef = useRef(true);

  const fecharTour = useCallback((marcarVisto) => {
    setAberto(false);
    setPassos([]);
    if (marcarVisto) {
      // fecha otimista — não espera a resposta; pior caso é o tour
      // reaparecer no próximo login, não é dado crítico.
      marcarTourVistoApi().catch(() => {});
    }
  }, []);

  /** `marcarAoConcluir: false` é o caminho de "Rever tour" — reabre a
   *  sequência inteira sem nunca escrever em tourVisto. */
  const iniciarTour = useCallback((novosPassos, { irPara, marcarAoConcluir = true } = {}) => {
    if (!novosPassos?.length) return;
    irParaRef.current = irPara || (() => {});
    marcarAoTerminarRef.current = marcarAoConcluir;
    if (novosPassos[0]?.pagina) irParaRef.current(novosPassos[0].pagina);
    setPassos(novosPassos);
    setPassoAtual(0);
    setAberto(true);
    setBuscaSeq((s) => s + 1);
  }, []);

  const proximo = useCallback(() => {
    setPassoAtual((atual) => {
      const seguinte = atual + 1;
      if (seguinte >= passos.length) {
        fecharTour(marcarAoTerminarRef.current);
        return atual;
      }
      const passo = passos[seguinte];
      if (passo?.pagina) irParaRef.current(passo.pagina);
      setBuscaSeq((s) => s + 1);
      return seguinte;
    });
  }, [passos, fecharTour]);

  const pular = useCallback(() => fecharTour(marcarAoTerminarRef.current), [fecharTour]);

  const valor = {
    passos, passoAtual, aberto, buscaSeq,
    passo: passos[passoAtual] ?? null,
    iniciarTour, proximo, pular,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useTour = () => useContext(Ctx);

/** Dispara o tour automaticamente no primeiro login desta base — vive
 *  dentro de `TourProvider` (precisa de `useTour`), é montado uma vez
 *  por `Sessao.jsx`. Requisito 1: dispara no primeiro login bem
 *  sucedido; funciona também depois de `trocarBase` (a decisão
 *  `mostrarTourAoEntrar` já vem recalculada do zero em cada App.jsx). */
export function TourAutoStart({ baseId, papel, mostrarTourAoEntrar, irPara }) {
  const { iniciarTour } = useTour();
  useEffect(() => {
    // pré-carrega sempre, mesmo quando não vai disparar sozinho — é
    // a mesma leitura (em cache, ver tour.js) que "Rever tour" usa
    // mais tarde; assim, quem já viu o tour antes não espera pela
    // rede a primeira vez que abrir "Rever tour" no menu.
    let cancelado = false;
    obterConfigTour(baseId).then((config) => {
      if (cancelado || !mostrarTourAoEntrar) return;
      const passos = composicaoPassos(config, papel);
      if (passos.length) iniciarTour(passos, { irPara, marcarAoConcluir: true });
    });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseId]);
  return null;
}

/** "Rever tour" — reabre a sequência inteira sem nunca escrever em
 *  tourVisto (login seguinte não deve voltar a mostrar sozinho). */
export function useReverTour(baseId, papel, irPara) {
  const { iniciarTour } = useTour();
  return useCallback(async () => {
    const config = await obterConfigTour(baseId);
    const passos = composicaoPassos(config, papel);
    if (passos.length) iniciarTour(passos, { irPara, marcarAoConcluir: false });
  }, [baseId, papel, irPara, iniciarTour]);
}
