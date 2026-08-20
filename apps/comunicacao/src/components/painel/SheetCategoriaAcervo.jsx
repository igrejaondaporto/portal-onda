import { useRef, useState } from "react";
import {
  criarCategoriaAcervo, guardarCategoriaAcervo, desativarCategoriaAcervo,
  novaCategoriaAcervoId, enviarFotoCategoriaAcervo,
} from "../../lib/acervo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const TAMANHO_MAX_FOTO = 6 * 1024 * 1024;

/** Categorias só dividem a lista do Acervo — sem mais nenhum efeito
 *  no sistema. Desativar não apaga os itens já nela: eles caem em
 *  "Sem categoria" (ver Brand.jsx), nunca desaparecem.
 *
 *  Foto de fundo é só um teste visual (pedido do líder, ver
 *  CLAUDE.md) — aparece na barra da categoria, nunca atrás dos
 *  itens. `idRef` gerado já na abertura (mesmo padrão de SheetMarca)
 *  para o upload ter um caminho antes de a categoria existir, quando
 *  é nova. */
export default function SheetCategoriaAcervo({ categoria, onFechar, onGuardado, onDesativada }) {
  const torrada = useTorrada();
  const idRef = useRef(categoria?.id ?? novaCategoriaAcervoId());
  const inputFotoRef = useRef(null);
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [fotoUrl, setFotoUrl] = useState(categoria?.fotoUrl ?? null);
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  async function escolherFoto(e) {
    const ficheiro = e.target.files[0];
    e.target.value = "";
    if (!ficheiro) return;
    if (!ficheiro.type.startsWith("image/")) return torrada("Tem de ser uma imagem.");
    if (ficheiro.size >= TAMANHO_MAX_FOTO) return torrada("A imagem tem de ter menos de 6 MB.");
    setAEnviarFoto(true);
    try {
      const url = await enviarFotoCategoriaAcervo(idRef.current, ficheiro);
      setFotoUrl(url);
    } catch (e2) {
      torrada(e2.message || "Não foi possível enviar a foto.");
    } finally {
      setAEnviarFoto(false);
    }
  }

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("Falta o nome da categoria.");
    setAEnviar(true);
    try {
      const dados = { nome: n, fotoUrl: fotoUrl || null };
      if (categoria) {
        await guardarCategoriaAcervo(categoria.id, dados);
        onGuardado("Categoria atualizada");
      } else {
        await criarCategoriaAcervo(idRef.current, dados);
        onGuardado("Categoria criada");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function desativar() {
    try {
      await desativarCategoriaAcervo(categoria.id);
      onDesativada?.("Categoria removida");
    } catch (e) {
      torrada(e.message || "Não foi possível remover.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{categoria ? "Editar categoria" : "Nova categoria"}</h2>

        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Fotos de culto" />

        <label className="rot">Foto de fundo (opcional, para testar)</label>
        {fotoUrl && (
          <div
            style={{ width: "100%", height: 70, borderRadius: 12, marginTop: 8, backgroundImage: `url(${fotoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
          />
        )}
        <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={escolherFoto} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn sec full" disabled={aEnviarFoto} onClick={() => inputFotoRef.current.click()}>
            {aEnviarFoto ? "A enviar…" : fotoUrl ? "Trocar foto" : "Escolher foto"}
          </button>
          {fotoUrl && (
            <button className="btn sec" style={{ padding: "10px 14px" }} disabled={aEnviarFoto} onClick={() => setFotoUrl(null)}>
              Remover
            </button>
          )}
        </div>
        <p className="ds" style={{ marginTop: 6 }}>
          Aparece só na barra do nome, com uma transparência por cima — os itens da categoria continuam numa lista normal por baixo.
        </p>

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar || aEnviarFoto} onClick={guardar}>Guardar</button>
        {categoria && (
          <>
            <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={desativar}>
              Remover categoria
            </button>
            <p className="ds" style={{ marginTop: 6, textAlign: "center" }}>
              Os itens já nela ficam em "Sem categoria" — nada se apaga.
            </p>
          </>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
