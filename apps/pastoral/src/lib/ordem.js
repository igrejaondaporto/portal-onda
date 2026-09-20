/**
 * Montar a ordem do culto — o que até agora o pastor mandava em PDF.
 *
 * ── O que muda, e o que não muda ────────────────────────────────
 *
 * O PDF continua a existir e a Backstage continua a poder subi-lo:
 * decisão explícita (2026-09), para nenhum domingo ficar dependente de
 * uma tela nova no primeiro mês. O que muda é haver um caminho em que
 * não há nada para adivinhar — `functions/ordemCultoPdf.js` lê
 * coordenadas de texto para reconstruir uma grelha de seis colunas, e
 * já engoliu avisos inteiros por causa disso (ver o cabeçalho desse
 * ficheiro). Aqui os campos são campos.
 *
 * O documento gravado é EXATAMENTE o mesmo: `eventos/{e}.ordem`, com
 * `momentos[]` e `avisos[]`, pela mesma `publicarOrdemCulto` que a
 * Backstage usa desde que isto existe. Nenhuma base precisa de saber
 * de onde veio a ordem que está a ler — e é isso que faz este ecrã
 * nascer já compatível com as dez.
 *
 * `origem: "manual"` distingue as duas no documento (o campo já era
 * aceite pela função: a Backstage grava-o quando o analisador falha e
 * o líder escreve tudo à mão). Não é um campo novo.
 */
import { deleteDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { cModeloOrdem, cModelosOrdem } from "./modelo";

let contador = 0;
/** Chave só de interface — nunca vai para o Firestore (é tirada no
 *  `limpar` antes de publicar), só serve de `key` ao React enquanto as
 *  linhas ainda não têm identidade nenhuma. Mesmo padrão do
 *  SheetRevisaoOrdem da Backstage. */
export const chave = () => `l${Date.now()}_${contador++}`;

export const momentoVazio = () => ({
  _k: chave(), hora: "", momento: "", minutos: 5,
  responsavel: "", projecao: "", detalhe: "",
});

export const avisoVazio = () => ({ _k: chave(), nome: "", data: "", info: "", criarCulto: false });

const HORA = /^\d{1,2}:\d{2}$/;

const emMinutos = (hora) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};
const emHora = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * Recalcula as horas a partir da primeira e das durações — o que faz
 * montar um culto valer a pena em vez de escrever doze horas à mão.
 * Empurrar o início dez minutos passa a ser mexer num campo, e não
 * rever a coluna inteira (que é exatamente onde se erra: uma hora
 * esquecida no meio, e a ordem impressa deixa de bater certo com a
 * que está na app).
 *
 * Não é automático: é um botão. Um culto pode ter um intervalo de
 * propósito entre dois momentos, e recalcular sozinho a cada tecla
 * apagaria essa folga sem ninguém pedir.
 */
export function encadearHoras(momentos) {
  const primeira = momentos.find((m) => HORA.test(m.hora));
  if (!primeira) return momentos;
  let relogio = emMinutos(primeira.hora);
  let comecou = false;
  return momentos.map((m) => {
    if (!comecou && m !== primeira) return m;      // antes do primeiro com hora, não mexe
    comecou = true;
    const linha = { ...m, hora: emHora(relogio) };
    relogio += Number(m.minutos) || 0;
    return linha;
  });
}

/** As três horas que a ordem publica além dos momentos. Mesma conta do
 *  SheetRevisaoOrdem da Backstage, incluindo a regra de que as portas
 *  abrem à hora da Contagem e não à do Pré-culto — é o que a Base
 *  Pessoal usa para saber quando abrir, e mudá-la aqui partia isso. */
export function horasDaOrdem(momentos) {
  const validos = momentos.filter((m) => HORA.test(m.hora) && Number(m.minutos) > 0);
  if (!validos.length) return { inicio: null, fim: null, portasAbertas: null };
  const ultimo = validos.at(-1);
  const fim = emHora(emMinutos(ultimo.hora) + Number(ultimo.minutos));
  const contagem = validos.find((m) => /contagem/i.test(m.momento));
  return { inicio: validos[0].hora, fim, portasAbertas: contagem?.hora ?? validos[0].hora };
}

/** Duração total prevista, em minutos — o número que o pastor olha
 *  antes de publicar ("isto dá duas horas e meia?"). */
export const duracaoTotal = (momentos) =>
  momentos.reduce((t, m) => t + (Number(m.minutos) || 0), 0);

/** Tira o `_k` e normaliza — o que vai mesmo para a Cloud Function.
 *  Campo de texto vazio vira `null`, nunca `""`: é o formato que
 *  `publicarOrdemCulto` já gravava, e o que as dez bases já sabem ler. */
export function limparMomentos(momentos) {
  return momentos
    .filter((m) => m.hora.trim() && m.momento.trim())
    .map((m) => ({
      hora: m.hora.trim(),
      momento: m.momento.trim(),
      minutos: Number(m.minutos) || 0,
      projecao: m.projecao?.trim() || null,
      responsavel: m.responsavel?.trim() || null,
      detalhe: m.detalhe?.trim() || null,
    }));
}

export function limparAvisos(avisos) {
  return avisos
    .filter((a) => a.nome.trim())
    .map((a) => ({
      nome: a.nome.trim(),
      data: a.data.trim(),
      info: a.info?.trim() || "",
      criarCulto: !!a.criarCulto,
    }));
}

/** O que já está publicado, de volta ao formulário — para editar uma
 *  ordem em vez de a reescrever. Serve tanto para uma ordem publicada
 *  aqui como para uma que veio do PDF da Backstage: o documento é o
 *  mesmo, e é por isso que os dois caminhos podem coexistir. */
export function ordemParaFormulario(ordem) {
  if (!ordem) return { momentos: [momentoVazio()], avisos: [] };
  return {
    momentos: (ordem.momentos?.length ? ordem.momentos : [momentoVazio()]).map((m) => ({
      _k: chave(), projecao: "", detalhe: "", responsavel: "", ...m, minutos: m.minutos ?? 5,
    })),
    avisos: (ordem.avisos ?? []).map((a) => ({ _k: chave(), criarCulto: false, ...a })),
  };
}

/* ── modelos: o domingo típico ─────────────────────────────────
 * Quase todos os domingos têm a mesma espinha (Pré-culto, Contagem,
 * Louvor, Avisos, Mensagem, Apelo…) — o que muda é a hora, o
 * responsável e o que vai na projeção. Sem isto, montar no painel era
 * mais trabalhoso do que mandar o PDF de sempre, e ninguém trocaria.
 *
 * Escrita direta no Firestore (ver a regra de `modelosOrdem`): é um
 * rascunho reutilizável do próprio pastor, sem autoria mista e sem
 * nada a validar no servidor. O que sai daqui para a igreja continua
 * a passar pela `publicarOrdemCulto`. */

export function ouvirModelos(cb) {
  return onSnapshot(cModelosOrdem(), (snap) => {
    cb(snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => m.ativo !== false)
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt")));
  });
}

/** Guarda a espinha, não o domingo: as horas ficam (são o esqueleto do
 *  dia), o responsável de cada momento não — quem prega muda de
 *  semana para semana, e um modelo que trouxesse o nome da semana
 *  passada faria publicar a ordem com o pregador errado. */
export function guardarModelo(id, nome, momentos) {
  const ref = id ? cModeloOrdem(id) : cModeloOrdem(`m${Date.now()}`);
  return setDoc(ref, {
    nome: nome.trim(),
    momentos: limparMomentos(momentos).map((m) => ({ ...m, responsavel: null })),
    ativo: true,
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
}

/** Aqui apaga-se a sério, e é a exceção consciente à regra 5 do
 *  CLAUDE.md raiz ("nada é apagado, é desativado"): um modelo não é
 *  histórico de nada — é um rascunho de trabalho do próprio pastor, e
 *  nenhuma ordem já publicada depende dele (a publicação copia os
 *  momentos para `eventos/{e}.ordem`, não aponta para o modelo). */
export const apagarModelo = (id) => deleteDoc(cModeloOrdem(id));

/** Modelo → formulário. Mesma transformação do `ordemParaFormulario`,
 *  e de propósito: o pastor não tem de saber se o que carregou veio
 *  de um modelo ou de uma ordem já publicada. */
export const modeloParaFormulario = (modelo) => ordemParaFormulario({ momentos: modelo.momentos });
