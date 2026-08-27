/**
 * Deteção de secção do FreeShow — módulo puro, sem Firebase Admin, para
 * poder ser testado isoladamente (ver scripts/sonda-freeshow.mjs) antes
 * de tocar em Firestore. `sondarUmaVez` nunca escreve nada no FreeShow —
 * só `get_projects`/`get_output`.
 */
import { io } from "socket.io-client";

/** Um slide pertence à última secção que aparece antes dele no array. */
export function seccaoDoIndice(shows, projectIndex) {
  let atual = null;
  for (const item of shows || []) {
    if (item.index > projectIndex) break;
    if (item.type === "section") atual = item;
  }
  return atual;
}

/** Confirma id + index juntos — o mesmo show aparece em vários
 *  projetos, e a combinação é o que desambigua. */
export function projetoAtivo(projetos, slideId, projectIndex) {
  for (const [id, p] of Object.entries(projetos || {})) {
    const bate = p.shows?.some((s) => s.id === slideId && s.index === projectIndex);
    if (bate) return { id, ...p };
  }
  return null;
}

const TIMEOUT_MS = 6000;

/** Liga-se uma vez ao FreeShow (túnel público ou localhost), pergunta
 *  get_projects + get_output, calcula a secção atual e fecha a ligação
 *  sempre — sucesso, output vazio, ou timeout. Espelha o modelo de uma
 *  invocação de Cloud Function agendada: liga, pergunta, desliga. */
export function sondarUmaVez(url) {
  return new Promise((resolve) => {
    let socket;
    let dadosProjetos = null;
    let dadosOutput;
    let concluido = false;

    const finalizar = (resultado) => {
      if (concluido) return;
      concluido = true;
      clearTimeout(temporizador);
      socket?.close();
      resolve(resultado);
    };

    const temporizador = setTimeout(() => finalizar({ ok: false, motivo: "timeout" }), TIMEOUT_MS);

    try {
      socket = io(url, { transports: ["websocket", "polling"], reconnection: false, timeout: TIMEOUT_MS });
    } catch (e) {
      return finalizar({ ok: false, motivo: "erro_ligacao", erro: e.message });
    }

    socket.on("connect_error", (e) => finalizar({ ok: false, motivo: "connect_error", erro: e.message }));

    socket.on("connect", () => {
      socket.emit("data", JSON.stringify({ action: "get_projects" }));
      socket.emit("data", JSON.stringify({ action: "get_output" }));
    });

    socket.on("data", (bruto) => {
      let o;
      try { o = typeof bruto === "string" ? JSON.parse(bruto) : bruto; } catch { return; }
      if (o.action === "get_projects") dadosProjetos = o.data;
      if (o.action === "get_output") dadosOutput = o.data;
      if (dadosProjetos !== null && dadosOutput !== undefined) processar();
    });

    function processar() {
      if (!dadosOutput || !dadosOutput.slide) {
        return finalizar({ ok: true, output: null, secao: null });
      }
      const { id: slideId, projectIndex } = dadosOutput.slide;
      const projeto = projetoAtivo(dadosProjetos, slideId, projectIndex);
      if (!projeto) {
        return finalizar({
          ok: true, output: dadosOutput.slide, secao: null, projetoId: null,
          motivo: "projeto_nao_identificado",
        });
      }
      const secao = seccaoDoIndice(projeto.shows, projectIndex);
      finalizar({
        ok: true,
        output: dadosOutput.slide,
        projetoId: projeto.id,
        secao: secao ? { id: secao.id, nome: secao.name, indice: secao.index, cor: secao.color || null } : null,
      });
    }
  });
}

/** Minúsculas, sem acentos — para comparar nomes do FreeShow com a
 *  tabela de correspondência sem depender de capitalização/hífens. */
export function normalizarNome(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
