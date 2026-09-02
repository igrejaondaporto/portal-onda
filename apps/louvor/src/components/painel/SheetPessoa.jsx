import { useRef, useState } from "react";
import { criarVoluntario, editarVoluntario, enviarFotoVoluntario, reporPin } from "../../lib/painel";
import { PAPEIS } from "../../lib/modelo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";

const TAMANHO_MAX_FOTO = 6 * 1024 * 1024;

export default function SheetPessoa({
  pessoa, onFechar, onGuardado, onRemover,
  pessoaExistente, onDesligarPessoa,
}) {
  const torrada = useTorrada();
  const inputFotoRef = useRef(null);
  const [nome, setNome] = useState(pessoa?.nome ?? pessoaExistente?.nome ?? "");
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? pessoaExistente?.telefone ?? "");
  const [papel, setPapel] = useState(pessoa?.papel ?? "voluntario");
  // instrumentos é só desta base (não vem de pessoaExistente — quem já
  // é voluntário noutra base ainda não tem isto definido para a Louvor).
  const [instrumentos, setInstrumentos] = useState(pessoa?.instrumentos ?? []);
  const [foto, setFoto] = useState(pessoa?.foto ?? null);
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  async function escolherFoto(e) {
    const ficheiro = e.target.files[0];
    e.target.value = "";
    if (!ficheiro || !pessoa) return;
    if (!ficheiro.type.startsWith("image/")) return torrada("Tem de ser uma imagem.");
    if (ficheiro.size >= TAMANHO_MAX_FOTO) return torrada("A imagem tem de ter menos de 6 MB.");
    setAEnviarFoto(true);
    try {
      const url = await enviarFotoVoluntario(pessoa.id, ficheiro);
      setFoto(url);
    } catch (e2) {
      torrada(e2.message || "Não foi possível enviar a foto.");
    } finally {
      setAEnviarFoto(false);
    }
  }

  function alternarInstrumento(id) {
    setInstrumentos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("O voluntário precisa de um nome");
    setAEnviar(true);
    try {
      if (pessoa) {
        await editarVoluntario({ pessoaId: pessoa.id, nome: n, telefone: telefone.trim(), papel, foto, instrumentos });
        onGuardado("Voluntário atualizado");
      } else {
        const dados = { nome: n, telefone: telefone.trim(), papel, instrumentos };
        if (pessoaExistente) dados.pessoaExistenteId = pessoaExistente.pessoaExistenteId;
        await criarVoluntario(dados);
        onGuardado(pessoaExistente ? `${n} ligado — já é multi-base` : "Voluntário adicionado");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function repor() {
    try {
      const r = await reporPin(pessoa.id);
      torrada(`Código reposto para ${r.pinProvisorio} — troca no próximo acesso`);
    } catch (e) {
      torrada(e.message || "Não foi possível repor o código.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{pessoa ? "Editar voluntário" : "Novo voluntário"}</h2>

        {pessoa && (
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <div
              className="perfilav"
              style={foto ? { backgroundImage: `url(${foto})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: pessoa.cor || "#0019BE" }}
            >
              {foto ? "" : pessoa.nome?.[0]}
            </div>
            <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={escolherFoto} />
            <div style={{ marginTop: 10 }}>
              <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} disabled={aEnviarFoto} onClick={() => inputFotoRef.current.click()}>
                {aEnviarFoto ? "A enviar…" : foto ? "Trocar foto" : "Juntar foto"}
              </button>
              {foto && (
                <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5, marginLeft: 8 }} onClick={() => setFoto(null)}>
                  Remover
                </button>
              )}
            </div>
          </div>
        )}

        {!pessoa && pessoaExistente && (
          <div className="caixa" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar pessoa={pessoaExistente} tamanho={36} />
            <div style={{ flex: 1 }}>
              <p className="nmt" style={{ fontSize: 14 }}>Ligado ao perfil de {pessoaExistente.nome}</p>
              <p className="ds">Ao guardar, o perfil passa a multi-base.</p>
            </div>
            <button className="btn sec" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={onDesligarPessoa}>
              Trocar
            </button>
          </div>
        )}
        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome como aparece na escala" />
        <label className="rot">Telemóvel</label>
        <input className="campo" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="9xx xxx xxx" />
        <label className="rot">Papel na base</label>
        <div className="subtabs">
          <button data-on={papel === "voluntario" ? 1 : 0} onClick={() => setPapel("voluntario")}>Voluntário</button>
          <button data-on={papel === "lider_base" ? 1 : 0} onClick={() => setPapel("lider_base")}>Líder da base</button>
        </div>
        <p className="ds" style={{ marginTop: 8 }}>O líder da base tem código de 6 dígitos e acesso a tudo.</p>
        <label className="rot" style={{ marginTop: 14 }}>Instrumentos</label>
        <div className="subtabs">
          {PAPEIS.map((p) => (
            <button key={p.id} data-on={instrumentos.includes(p.id) ? 1 : 0} onClick={() => alternarInstrumento(p.id)}>
              {p.nome}
            </button>
          ))}
        </div>
        <p className="ds" style={{ marginTop: 8 }}>Pode escolher mais do que um. Usado para agrupar a escala por instrumento.</p>
        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        {pessoa && (
          <>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={repor}>Repor código</button>
            <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={() => onRemover(pessoa.id)}>
              Remover da base
            </button>
          </>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
