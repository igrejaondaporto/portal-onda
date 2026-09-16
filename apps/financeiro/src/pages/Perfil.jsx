import { useEffect, useRef, useState } from "react";
import { guardarPerfil, enviarFotoPerfil, removerFotoPerfil } from "@portal/shared/lib/perfil.js";
import { trocarPin } from "@portal/shared/lib/auth.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { sair } from "@portal/shared/lib/auth.js";
import ImagemExpandida from "@portal/shared/components/ImagemExpandida.jsx";

const TAMANHO_MAX = 6 * 1024 * 1024;

export default function Perfil({ uid, pessoa, definirCabecalho, onAtualizarPessoa }) {
  const torrada = useTorrada();
  const inputFotoRef = useRef(null);
  const [nome, setNome] = useState(pessoa?.nome ?? "");
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? "");
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const [aTrocarPin, setATrocarPin] = useState(false);
  const [expandida, setExpandida] = useState(false);

  useEffect(() => { setNome(pessoa?.nome ?? ""); setTelefone(pessoa?.telefone ?? ""); }, [pessoa]);

  useEffect(() => {
    definirCabecalho({ titulo: <em>Perfil</em>, subtitulo: "As tuas informações", chips: ["Financeiro"] });
  }, [definirCabecalho]);

  async function escolherFoto(e) {
    const ficheiro = e.target.files[0];
    e.target.value = "";
    if (!ficheiro) return;
    if (!ficheiro.type.startsWith("image/")) return torrada("Tem de ser uma imagem.");
    if (ficheiro.size >= TAMANHO_MAX) return torrada("A imagem tem de ter menos de 6 MB.");
    setAEnviarFoto(true);
    try {
      const url = await enviarFotoPerfil(uid, ficheiro);
      onAtualizarPessoa({ ...pessoa, foto: url });
      torrada("Foto atualizada");
    } catch (e2) {
      torrada(e2.message || "Não foi possível enviar a foto.");
    } finally {
      setAEnviarFoto(false);
    }
  }

  async function removerFoto() {
    try {
      await removerFotoPerfil(uid);
      onAtualizarPessoa({ ...pessoa, foto: null });
    } catch (e) {
      torrada(e.message || "Não foi possível remover a foto.");
    }
  }

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("O nome não pode ficar vazio");
    setAGuardar(true);
    try {
      await guardarPerfil(uid, { nome: n, telefone: telefone.trim() });
      onAtualizarPessoa({ ...pessoa, nome: n, telefone: telefone.trim() });
      torrada("Dados guardados");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  async function alterarCodigo() {
    if (c2.length !== 6) return torrada("O novo código tem de ter 6 dígitos");
    if (c2 !== c3) return torrada("Os códigos novos não coincidem");
    setATrocarPin(true);
    const r = await trocarPin(c1, c2);
    setATrocarPin(false);
    if (r.ok) {
      setC1(""); setC2(""); setC3("");
      torrada("Código alterado");
    } else {
      torrada(r.mensagem);
    }
  }

  return (
    <div className="duas">
      <div>
        <div className="sect" style={{ textAlign: "center" }}>
          <div
            className="perfilav"
            style={pessoa?.foto ? { backgroundImage: `url(${pessoa.foto})`, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer" } : { background: pessoa?.cor || "#0019BE" }}
            onClick={pessoa?.foto ? () => setExpandida(true) : undefined}
          >
            {pessoa?.foto ? "" : pessoa?.nome?.[0]}
          </div>
          {expandida && <ImagemExpandida src={pessoa.foto} alt={pessoa.nome} onFechar={() => setExpandida(false)} />}
          <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.03em", marginTop: 14 }}>{pessoa?.nome ?? "…"}</p>
          <p className="ds">Financeiro</p>
          <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={escolherFoto} />
          <button className="btn sec" style={{ marginTop: 14 }} disabled={aEnviarFoto} onClick={() => inputFotoRef.current.click()}>
            {aEnviarFoto ? "A enviar…" : pessoa?.foto ? "Trocar foto" : "Juntar foto"}
          </button>
          {pessoa?.foto && (
            <button className="btn sec" style={{ marginTop: 14, marginLeft: 8 }} onClick={removerFoto}>Remover</button>
          )}
        </div>
        <div className="sect">
          <div className="cabecalho"><h3>Dados</h3></div>
          <div className="caixa">
            <label className="rot" style={{ marginTop: 0 }}>Nome</label>
            <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <label className="rot">Telemóvel</label>
            <input className="campo" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="9xx xxx xxx" />
            <button className="btn full" style={{ marginTop: 16 }} disabled={aGuardar} onClick={guardar}>Guardar</button>
          </div>
        </div>
        <div className="sect">
          <div className="cabecalho"><h3>Código de acesso</h3></div>
          <div className="caixa">
            <label className="rot" style={{ marginTop: 0 }}>Código atual</label>
            <input className="campo" inputMode="numeric" value={c1} onChange={(e) => setC1(e.target.value)} placeholder="6 dígitos" />
            <label className="rot">Novo código</label>
            <input className="campo" inputMode="numeric" value={c2} onChange={(e) => setC2(e.target.value)} placeholder="6 dígitos" />
            <label className="rot">Repetir novo código</label>
            <input className="campo" inputMode="numeric" value={c3} onChange={(e) => setC3(e.target.value)} placeholder="6 dígitos" />
            <button className="btn full" style={{ marginTop: 16 }} disabled={aTrocarPin} onClick={alterarCodigo}>Alterar código</button>
            <p className="ds" style={{ marginTop: 10 }}>Ninguém consegue ver o teu código.</p>
          </div>
        </div>
      </div>
      <div>
        <button className="sair" onClick={sair}>Terminar sessão</button>
      </div>
    </div>
  );
}
