import { useEffect, useRef, useState } from "react";
import { guardarPerfil, enviarFotoPerfil, removerFotoPerfil } from "@portal/shared/lib/perfil.js";
import { trocarPin } from "@portal/shared/lib/auth.js";
import { guardarAniversario } from "../lib/perfil";
import { obterMeusProximosDomingos } from "../lib/culto";
import { ouvirReembolsos } from "../lib/reembolsos";
import { meusPapeisNoCulto, nomePapel, emojiPapel, souLiderOuAuxiliar, nomePapelBase } from "../lib/modelo";
import { usePapeisEscala } from "../lib/PapeisEscalaContext.jsx";
import { nomeEvento } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { sair } from "@portal/shared/lib/auth.js";
import ImagemExpandida from "@portal/shared/components/ImagemExpandida.jsx";

const TAMANHO_MAX = 6 * 1024 * 1024;

export default function Perfil({ uid, papel, pessoa, definirCabecalho, onAtualizarPessoa, onIrReembolsos, onIrPainel }) {
  const torrada = useTorrada();
  const papeis = usePapeisEscala();
  const souLiderBase = souLiderOuAuxiliar(papel);
  const inputFotoRef = useRef(null);
  const [nome, setNome] = useState(pessoa?.nome ?? "");
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? "");
  const [aniversario, setAniversario] = useState(pessoa?.aniversario ?? "");
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const [aTrocarPin, setATrocarPin] = useState(false);
  const [domingos, setDomingos] = useState([]);
  const [meusPedidos, setMeusPedidos] = useState([]);
  const [expandida, setExpandida] = useState(false);

  useEffect(() => {
    setNome(pessoa?.nome ?? "");
    setTelefone(pessoa?.telefone ?? "");
    setAniversario(pessoa?.aniversario ?? "");
  }, [pessoa]);
  useEffect(() => { obterMeusProximosDomingos(uid).then(setDomingos); }, [uid]);
  useEffect(() => ouvirReembolsos(false, uid, setMeusPedidos), [uid]);

  useEffect(() => {
    definirCabecalho({
      titulo: <em>Perfil</em>,
      subtitulo: "As tuas informações",
      chips: [nomePapelBase(papel), `${domingos.length} domingo${domingos.length === 1 ? "" : "s"}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [souLiderBase, domingos.length]);

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
      await Promise.all([
        guardarPerfil(uid, { nome: n, telefone: telefone.trim() }),
        guardarAniversario(uid, aniversario || null),
      ]);
      onAtualizarPessoa({ ...pessoa, nome: n, telefone: telefone.trim(), aniversario: aniversario || null });
      torrada("Dados guardados");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  // <input type="date"> não tem noção de "só mês e dia" — usa-se um
  // ano fixo bissexto (cobre 29/fev) só como andaime da UI; o que se
  // grava é sempre "MM-DD", nunca o ano.
  const ANO_ANDAIME = "2000";
  const valorDataAniversario = aniversario ? `${ANO_ANDAIME}-${aniversario}` : "";

  const digitos = souLiderBase ? 6 : 4; // "auxiliar" já entra em souLiderBase acima
  async function alterarCodigo() {
    if (c2.length !== digitos) return torrada(`O novo código tem de ter ${digitos} dígitos`);
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
          <p className="ds">{nomePapelBase(papel)} da base de Louvor</p>
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
            <label className="rot">Aniversário</label>
            <input
              className="campo" type="date" value={valorDataAniversario}
              onChange={(e) => setAniversario(e.target.value ? e.target.value.slice(5) : "")}
            />
            <p className="ds" style={{ marginTop: 4 }}>Só o dia e o mês contam — sem ano.</p>
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
            <p className="ds" style={{ marginTop: 10 }}>Ninguém consegue ver o teu código, nem o líder da base. Se o esqueceres, ele repõe um provisório.</p>
          </div>
        </div>
      </div>
      <div>
        <div className="sect">
          <div className="cabecalho"><h3>Os teus domingos</h3></div>
          {domingos.length ? (
            domingos.map((ev) => {
              const meusPapeis = meusPapeisNoCulto(ev.escala, uid).map((id) => `${emojiPapel(papeis, id)} ${nomePapel(papeis, id)}`);
              return (
                <div className="linha" key={ev.id}>
                  <div style={{ flex: 1 }}>
                    <p className="nmt">{nomeEvento(ev)}</p>
                    <p className="ds">{meusPapeis.length ? meusPapeis.join(" · ") : "papel por definir"} · chegada {ev.horaChegada || "07:00"}</p>
                  </div>
                  {ev.escala.liderEscala === uid && <span className="tag lim">Líder de escala</span>}
                </div>
              );
            })
          ) : (
            <div className="vaz">Não estás escalado nos próximos tempos.</div>
          )}
        </div>
        <div className="sect">
          <div className="cabecalho"><h3>Mais</h3></div>
          <div className="linha" style={{ cursor: "pointer" }} onClick={onIrReembolsos}>
            <div style={{ flex: 1 }}>
              <p className="nmt">Reembolsos</p>
              <p className="ds">{meusPedidos.length} pedido{meusPedidos.length !== 1 ? "s" : ""} teu{meusPedidos.length !== 1 ? "s" : ""}</p>
            </div>
            <span className="seta">›</span>
          </div>
          {souLiderBase && (
            <div className="linha" style={{ cursor: "pointer" }} onClick={onIrPainel}>
              <div style={{ flex: 1 }}><p className="nmt">Painel do líder</p><p className="ds">Escalas, voluntários e definições</p></div>
              <span className="seta">›</span>
            </div>
          )}
          <div className="linha">
            <div style={{ flex: 1 }}>
              <p className="nmt">Notificações no telemóvel</p>
              <p className="ds">Quando houver novidades</p>
            </div>
            <button className="btn sec" style={{ padding: "9px 16px", fontSize: 13 }} onClick={() => torrada("Pediria autorização ao telemóvel")}>
              Ativar
            </button>
          </div>
        </div>
        <button className="sair" onClick={sair}>Terminar sessão</button>
      </div>
    </div>
  );
}
