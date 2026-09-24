import { useMemo, useRef, useState } from "react";
import { useTorrada } from "../lib/TorradaContext.jsx";
import {
  MARCAS, LIMITE, marcasDesconhecidas, paraGuardar,
  textoEnquete, textoLembrete,
} from "../lib/mensagensEnquete.js";

const TEXTOS = {
  enquete: {
    titulo: "Texto da enquete",
    descricao: "O que mandas ao grupo quando a enquete abre.",
  },
  lembrete: {
    titulo: "Texto do lembrete",
    descricao: "O que cada pessoa recebe quando tocas em \"Lembrar\".",
  },
};

/**
 * Editor de um dos textos de WhatsApp da enquete. Pedido do líder: cada
 * um deve poder escrever "da maneira que quer".
 *
 * A caixa mostra o MODELO, com as marcas `{meses}`, `{prazos}`, `{nome}`
 * à vista, e por baixo o resultado já preenchido com o que está aberto
 * agora — é a única forma de o líder ver que `{prazos}` dá "até 28 de
 * setembro" sem ter de adivinhar. As marcas entram por botões: escrever
 * chavetas num telemóvel é penoso, e uma letra trocada manda "{mes}" à
 * letra para o grupo inteiro (por isso também se bloqueia ao guardar).
 *
 * @param tipo       "enquete" | "lembrete"
 * @param modelo     o que está em vigor (o do líder ou o de fábrica)
 * @param padrao     o de fábrica — para "Voltar ao texto original"
 * @param enquetes   [{mes, prazo}] abertas agora — só serve à pré-visualização
 * @param dominio    o endereço do portal — idem
 * @param nomeExemplo primeiro nome para a pré-visualização do lembrete
 * @param onGuardar  (texto|null) => Promise
 */
export default function SheetEditarMensagem({ tipo, modelo, padrao, enquetes, dominio, nomeExemplo, onGuardar, onFechar }) {
  const torrada = useTorrada();
  const [texto, setTexto] = useState(modelo);
  const [aGuardar, setAGuardar] = useState(false);
  const caixaRef = useRef(null);
  const marcas = MARCAS[tipo];

  const desconhecidas = useMemo(() => marcasDesconhecidas(texto, tipo), [texto, tipo]);
  const previa = useMemo(() => {
    const t = texto.trim() ? texto : padrao;
    return tipo === "enquete"
      ? textoEnquete(t, enquetes, dominio)
      : textoLembrete(t, { nome: nomeExemplo || "Ana" });
  }, [texto, padrao, tipo, enquetes, dominio, nomeExemplo]);

  const gravado = paraGuardar(texto, padrao);
  const igualAoDeFabrica = gravado === null;
  const emVigorEDeFabrica = paraGuardar(modelo, padrao) === null;
  const semMudancas = paraGuardar(texto, padrao) === paraGuardar(modelo, padrao);

  function inserir(chave) {
    const el = caixaRef.current;
    const marca = `{${chave}}`;
    const ini = el?.selectionStart ?? texto.length;
    const fim = el?.selectionEnd ?? ini;
    setTexto(texto.slice(0, ini) + marca + texto.slice(fim));
    // devolve o cursor para depois da marca, com o teclado ainda aberto
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  }

  async function guardar(valor) {
    setAGuardar(true);
    try {
      await onGuardar(valor);
      torrada(valor === null ? "Voltou ao texto original" : "Texto guardado");
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAGuardar(false);
    }
  }

  function tentarGuardar() {
    if (desconhecidas.length) return; // o aviso já está à vista
    if (texto.length > LIMITE) return torrada(`O texto tem de ter menos de ${LIMITE} letras.`);
    guardar(gravado);
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{TEXTOS[tipo].titulo}</h2>
        <p className="sb2">{TEXTOS[tipo].descricao}</p>

        <textarea
          ref={caixaRef} className="campo" rows={tipo === "enquete" ? 7 : 4}
          style={{ marginTop: 14, lineHeight: 1.5 }}
          value={texto} maxLength={LIMITE + 200}
          onChange={(e) => setTexto(e.target.value)}
        />

        <label className="rot">Inserir no texto</label>
        <div className="subtabs" style={{ marginTop: 6 }}>
          {marcas.map((m) => (
            <button key={m.chave} onClick={() => inserir(m.chave)} title={m.ajuda}>+ {m.rotulo}</button>
          ))}
        </div>
        <p className="ds" style={{ marginTop: 8 }}>
          {marcas.map((m, i) => (
            <span key={m.chave}>{i ? " · " : ""}<b>{`{${m.chave}}`}</b> = {m.ajuda}</span>
          ))}
        </p>

        {desconhecidas.length > 0 && (
          <p className="aviso" style={{ minHeight: 0, textAlign: "left", paddingTop: 10 }}>
            Não conheço {desconhecidas.map((c) => `{${c}}`).join(", ")}. Usa os botões acima, ou apaga as chavetas.
          </p>
        )}

        <label className="rot">Como vai ficar</label>
        <div className="caixa" style={{ background: "var(--agua)", border: 0, marginTop: 6 }}>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{previa}</p>
        </div>
        {tipo === "enquete" && (
          <p className="ds" style={{ marginTop: 6 }}>Com as enquetes que tens abertas agora.</p>
        )}

        <button
          className="btn full" style={{ marginTop: 16 }}
          disabled={aGuardar || semMudancas || desconhecidas.length > 0}
          onClick={tentarGuardar}
        >
          {aGuardar ? "A guardar…" : igualAoDeFabrica && !emVigorEDeFabrica ? "Guardar (volta ao original)" : "Guardar"}
        </button>
        {/* Só repõe a caixa — não grava. Apagar de vez o texto que o líder
          * escreveu com um toque, sem confirmação, seria perder-lhe o
          * trabalho; assim vê o original, e só fica se carregar em Guardar. */}
        {!igualAoDeFabrica && (
          <button className="btn sec full" style={{ marginTop: 9 }} disabled={aGuardar} onClick={() => setTexto(padrao)}>
            Voltar ao texto original
          </button>
        )}
        <button
          className="btn sec full"
          style={{ marginTop: 9, background: "none", color: "var(--cinza)" }}
          onClick={onFechar}
        >
          Cancelar
        </button>
      </div>
    </>
  );
}
