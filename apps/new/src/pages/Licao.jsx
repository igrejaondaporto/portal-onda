import { useEffect, useRef, useState } from "react";
import { ouvirLicoes, enviarLicao, excluirLicao } from "../lib/licoes";
import { haAtras } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";
import { ouvirVoluntarios } from "../lib/painel";

const ACEITA_DOCX = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function IconeDocx() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

/** Lição — o líder sobe um .docx, fica visível para toda a base numa
 *  lista simples (mais recente primeiro). Sem pré-visualização do
 *  conteúdo (é um .docx, não um PDF) — tocar abre/descarrega o
 *  ficheiro pelo link do Storage, como qualquer anexo do telemóvel. */
export default function Licao({ uid, papel, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const inputRef = useRef(null);
  const [licoes, setLicoes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [titulo, setTitulo] = useState("");
  const [ficheiro, setFicheiro] = useState(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [aMostrarEnvio, setAMostrarEnvio] = useState(false);

  useEffect(() => ouvirLicoes(setLicoes), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Lição</em>,
      subtitulo: "O documento da semana, para toda a base",
      chips: [`${licoes.length} enviada${licoes.length !== 1 ? "s" : ""}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, licoes.length]);

  function pessoaPorId(id) {
    return voluntarios.find((p) => p.id === id);
  }

  function escolherFicheiro(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".docx")) {
      torrada("Só ficheiros .docx", true);
      return;
    }
    setFicheiro(f);
    setTitulo(f.name.replace(/\.docx$/i, ""));
    setAMostrarEnvio(true);
  }

  async function enviar() {
    if (!ficheiro) return;
    setAEnviar(true);
    try {
      await enviarLicao(uid, { titulo, ficheiro });
      torrada("Lição enviada");
      setAMostrarEnvio(false);
      setFicheiro(null);
      setTitulo("");
    } catch {
      torrada("Não foi possível enviar. Tenta outra vez.", true);
    } finally {
      setAEnviar(false);
    }
  }

  async function excluir(licaoId) {
    try {
      await excluirLicao(licaoId);
      torrada("Lição excluída");
    } catch {
      torrada("Não foi possível excluir.", true);
    }
  }

  return (
    <div className="sect" style={{ marginTop: 12 }}>
      {souLiderBase && (
        <>
          <input
            ref={inputRef} type="file" accept={ACEITA_DOCX} style={{ display: "none" }}
            onChange={escolherFicheiro}
          />
          <button className="btn full" onClick={() => inputRef.current.click()}>
            + Enviar lição (.docx)
          </button>
        </>
      )}

      {aMostrarEnvio && (
        <div className="caixa" style={{ marginTop: 14 }}>
          <label className="rot">Título</label>
          <input
            className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Lição de 7 de setembro"
          />
          <p className="ds" style={{ marginTop: 8 }}>Ficheiro: {ficheiro?.name}</p>
          <button className="btn full" style={{ marginTop: 14 }} disabled={aEnviar} onClick={enviar}>
            {aEnviar ? "A enviar…" : "Publicar para a base"}
          </button>
          <button
            className="btn sec full" style={{ marginTop: 9 }}
            onClick={() => { setAMostrarEnvio(false); setFicheiro(null); setTitulo(""); }}
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="cabecalho" style={{ marginTop: 18 }}>
        <h3>Lições enviadas</h3>
      </div>
      {licoes.length === 0 && <div className="vaz">Ainda não há nenhuma lição enviada.</div>}
      {licoes.map((l) => {
        const pessoa = pessoaPorId(l.enviadoPor);
        return (
          <a
            key={l.id} className="linha" href={l.arquivoUrl} target="_blank" rel="noreferrer"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <span style={{ color: "var(--azul)" }}><IconeDocx /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="nmt">{l.titulo}</p>
              <p className="ds">
                {pessoa ? `${pessoa.nome} · ` : ""}
                {l.criadoEm ? haAtras(l.criadoEm) : "agora"}
              </p>
            </div>
            {pessoa && <Avatar pessoa={pessoa} tamanho={30} fonte={12} />}
            {souLiderBase && (
              <button
                className="btn sec" style={{ marginLeft: 8 }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); excluir(l.id); }}
              >
                Excluir
              </button>
            )}
          </a>
        );
      })}
    </div>
  );
}
