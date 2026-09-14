import { useEffect, useRef, useState } from "react";
import { guardarPerfil, enviarFotoPerfil, removerFotoPerfil } from "@portal/shared/lib/perfil.js";
import { trocarPin, sair } from "@portal/shared/lib/auth.js";
import { nomeEvento } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import ImagemExpandida from "@portal/shared/components/ImagemExpandida.jsx";
import { obterMeusProximosDomingos } from "../lib/culto";
import { ouvirReembolsos } from "../lib/reembolsos";
import { ouvirCapacitacoes, ouvirCapacitacoesDe, estadoCapacitacao } from "../lib/kinder";
import { rotuloPapel, souLider, nomeCategoria } from "../lib/modelo";

const TAMANHO_MAX = 6 * 1024 * 1024;

export default function Perfil({ uid, papel, pessoa, definirCabecalho, onAtualizarPessoa, onIrReembolsos, onIrPainel, onIrCapacitacoes }) {
  const torrada = useTorrada();
  const lider = souLider(papel);
  const inputFotoRef = useRef(null);
  const [nome, setNome] = useState(pessoa?.nome ?? "");
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? "");
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const [aTrocarPin, setATrocarPin] = useState(false);
  const [domingos, setDomingos] = useState([]);
  const [meusPedidos, setMeusPedidos] = useState([]);
  const [caps, setCaps] = useState([]);
  const [minhasCaps, setMinhasCaps] = useState({});
  const [expandida, setExpandida] = useState(false);

  useEffect(() => { setNome(pessoa?.nome ?? ""); setTelefone(pessoa?.telefone ?? ""); }, [pessoa]);
  useEffect(() => { obterMeusProximosDomingos(uid).then(setDomingos); }, [uid]);
  useEffect(() => ouvirReembolsos(false, uid, setMeusPedidos), [uid]);
  useEffect(() => ouvirCapacitacoes(setCaps), []);
  useEffect(() => ouvirCapacitacoesDe(uid, setMinhasCaps), [uid]);

  useEffect(() => {
    definirCabecalho({
      titulo: <em>Perfil</em>,
      subtitulo: "As tuas informações",
      chips: [rotuloPapel(papel, pessoa?.categoria), `${domingos.length} domingo${domingos.length === 1 ? "" : "s"}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papel, pessoa?.categoria, domingos.length]);

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

  const digitos = lider ? 6 : 4;
  async function alterarCodigo() {
    if (c2.length !== digitos) return torrada(`O novo código tem de ter ${digitos} dígitos`);
    if (c2 !== c3) return torrada("Os códigos novos não coincidem");
    setATrocarPin(true);
    const r = await trocarPin(c1, c2);
    setATrocarPin(false);
    if (r.ok) { setC1(""); setC2(""); setC3(""); torrada("Código alterado"); }
    else torrada(r.mensagem);
  }

  const capsEmFalta = caps.filter((c) => c.obrigatoria && estadoCapacitacao(c, minhasCaps[c.id]) !== "ok");

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
          <p className="ds">{rotuloPapel(papel, pessoa?.categoria)} do Kinder</p>
          <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={escolherFoto} />
          <button className="btn sec" style={{ marginTop: 14 }} disabled={aEnviarFoto} onClick={() => inputFotoRef.current.click()}>
            {aEnviarFoto ? "A enviar…" : pessoa?.foto ? "Trocar foto" : "Juntar foto"}
          </button>
          {pessoa?.foto && <button className="btn sec" style={{ marginTop: 14, marginLeft: 8 }} onClick={removerFoto}>Remover</button>}
        </div>
        <div className="sect">
          <div className="cabecalho"><h3>Dados</h3></div>
          <div className="caixa">
            <label className="rot" style={{ marginTop: 0 }}>Nome</label>
            <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <label className="rot">Telemóvel</label>
            <input className="campo" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="9xx xxx xxx" />
            <p className="ds" style={{ marginTop: 8 }}>A tua sala ({pessoa?.categoria ? nomeCategoria(pessoa.categoria) : "nenhuma"}) muda-se no Painel das líderes.</p>
            <button className="btn full" style={{ marginTop: 16 }} disabled={aGuardar} onClick={guardar}>Guardar</button>
          </div>
        </div>
        <div className="sect">
          <div className="cabecalho"><h3>Código de acesso</h3></div>
          <div className="caixa">
            <label className="rot" style={{ marginTop: 0 }}>Código atual</label>
            <input className="campo" inputMode="numeric" value={c1} onChange={(e) => setC1(e.target.value)} placeholder={`${digitos} dígitos`} />
            <label className="rot">Novo código</label>
            <input className="campo" inputMode="numeric" value={c2} onChange={(e) => setC2(e.target.value)} placeholder={`${digitos} dígitos`} />
            <label className="rot">Repetir novo código</label>
            <input className="campo" inputMode="numeric" value={c3} onChange={(e) => setC3(e.target.value)} placeholder={`${digitos} dígitos`} />
            <button className="btn full" style={{ marginTop: 16 }} disabled={aTrocarPin} onClick={alterarCodigo}>Alterar código</button>
            <p className="ds" style={{ marginTop: 10 }}>Ninguém consegue ver o teu código, nem as líderes. Se o esqueceres, elas repõem um provisório.</p>
          </div>
        </div>
      </div>
      <div>
        <div className="sect">
          <div className="cabecalho"><h3>Os teus domingos</h3></div>
          {domingos.length ? domingos.map((ev) => (
            <div className="linha" key={ev.id}>
              <div style={{ flex: 1 }}>
                <p className="nmt">{nomeEvento(ev)}</p>
                <p className="ds">Chegada {ev.horaChegada || "08:30"}</p>
              </div>
              {pessoa?.categoria && ev.escala.mestras?.[pessoa.categoria] === uid && <span className="tag lim">Mestra</span>}
            </div>
          )) : <div className="vaz">Não estás escalado nos próximos tempos.</div>}
        </div>
        <div className="sect">
          <div className="cabecalho"><h3>Mais</h3></div>
          <div className="linha" style={{ cursor: "pointer" }} onClick={onIrCapacitacoes}>
            <div style={{ flex: 1 }}>
              <p className="nmt">Capacitações</p>
              <p className="ds">{capsEmFalta.length ? `${capsEmFalta.length} por fazer ou renovar` : "Tudo em dia"}</p>
            </div>
            <span className="seta">›</span>
          </div>
          <div className="linha" style={{ cursor: "pointer" }} onClick={onIrReembolsos}>
            <div style={{ flex: 1 }}>
              <p className="nmt">Reembolsos</p>
              <p className="ds">{meusPedidos.length} pedido{meusPedidos.length !== 1 ? "s" : ""} teu{meusPedidos.length !== 1 ? "s" : ""}</p>
            </div>
            <span className="seta">›</span>
          </div>
          {lider && (
            <div className="linha" style={{ cursor: "pointer" }} onClick={onIrPainel}>
              <div style={{ flex: 1 }}><p className="nmt">Painel do líder</p><p className="ds">Escalas, voluntários e definições</p></div>
              <span className="seta">›</span>
            </div>
          )}
        </div>
        <button className="sair" onClick={sair}>Terminar sessão</button>
      </div>
    </div>
  );
}
