import { useEffect, useRef, useState } from "react";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";
import SeletorCategoria from "./SeletorCategoria";
import { nomeCategoria, varsCategoria } from "../lib/modelo";

// responsável/autorizado são só um array na família, sem doc próprio —
// o `id` é o que dá um caminho estável à foto de cada um; gerado aqui
// (nunca no servidor) para já existir mesmo antes da primeira gravação.
const novoId = () => crypto.randomUUID();
const comId = (p) => ({ ...p, id: p.id || novoId() });
const vazioResponsavel = () => ({ id: novoId(), nome: "", telefone: "", parentesco: "", foto: null });
const vazioCrianca = () => ({ nome: "", dataNascimento: "", alergias: "", restricoesAlimentares: "", necessidades: "", categoria: null, foto: null });
const digitos = (t) => String(t || "").replace(/\D/g, "");

/** Trata `foto` de um item antes de enviar: um `File` novo comprime e
 *  vai em base64 (fotoBase64) — é como isto chega ao servidor sem os
 *  pais terem sessão nenhuma para subir direto ao Storage; `null`
 *  explícito (removeu) manda `removerFoto`; sem tocar, não manda nada
 *  e o servidor mantém o que já lá estava. */
async function comFotoProcessada(item) {
  const { foto, ...resto } = item;
  if (foto instanceof File) {
    const comprimida = await comprimirImagem(foto, { maxDimensao: 480, qualidade: 0.82 });
    const fotoBase64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Não foi possível ler a foto."));
      r.readAsDataURL(comprimida);
    });
    return { ...resto, fotoBase64 };
  }
  if (foto === null) return { ...resto, removerFoto: true };
  return resto;
}

/** Foto redonda + botão de escolher/trocar, para a criança e para
 *  cada responsável/autorizado — reconhecer quem é quem à entrada e
 *  confirmar quem vem buscar à saída (pedido do líder, 2026-09). */
function FotoPessoa({ foto, onEscolher }) {
  const inputRef = useRef(null);
  const [urlObjeto, setUrlObjeto] = useState(null);

  useEffect(() => {
    if (!(foto instanceof File)) { setUrlObjeto(null); return; }
    const u = URL.createObjectURL(foto);
    setUrlObjeto(u);
    return () => URL.revokeObjectURL(u);
  }, [foto]);

  const src = urlObjeto || foto?.url || null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => onEscolher(e.target.files[0] ?? null)} />
      <button
        type="button" onClick={() => inputRef.current.click()} aria-label={src ? "Trocar foto" : "Adicionar foto"}
        style={{
          width: 52, height: 52, borderRadius: "50%", border: "1px solid var(--fio)", padding: 0,
          overflow: "hidden", flex: "none", background: "#f3f4fa", cursor: "pointer",
        }}
      >
        {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 10.5, color: "var(--cinza)" }}>Foto</span>}
      </button>
      <button type="button" className="btn sec" style={{ flex: 1, padding: "9px" }} onClick={() => inputRef.current.click()}>
        {src ? "Trocar foto" : "Adicionar foto"}
      </button>
      {foto && <button type="button" className="oc-icobt mag" aria-label="Remover foto" onClick={() => onEscolher(null)}>✕</button>}
    </div>
  );
}

/**
 * A ficha da família — a mesma nas quatro situações: os pais pelo QR
 * (/registo), o voluntário na receção, os pais a corrigir pelo link da
 * família, e o voluntário a corrigir. Só muda o que se mostra à volta:
 *   - `consentimento` → só no registo (texto + caixa a marcar);
 *   - `podeEscolherSala` → só voluntários (os pais nunca escolhem a
 *     sala; fica a sugerida pela idade — ver functions/kinder.js).
 *   - `salaFixa` → uma líder de sala restrita à sua: sem escolha
 *     nenhuma, todas as crianças registadas por ela ficam na sala
 *     dela, sem hipótese de a trocar (nunca é ela a decidir a idade
 *     de uma criança de outra sala).
 */
export default function FormFamilia({
  inicial, consentimento, podeEscolherSala = false, salaFixa = null, mostrarVisitante = false,
  aEnviar = false, textoBotao = "Guardar", onSubmeter, onCancelar, avisar,
}) {
  const [responsaveis, setResponsaveis] = useState(inicial?.responsaveis?.length ? inicial.responsaveis.map(comId) : [vazioResponsavel()]);
  const [autorizados, setAutorizados] = useState((inicial?.autorizados ?? []).map(comId));
  const [criancas, setCriancas] = useState(inicial?.criancas?.length ? inicial.criancas : [vazioCrianca()]);
  const [removidas, setRemovidas] = useState([]);
  const [fotoAutorizada, setFotoAutorizada] = useState(inicial?.fotoAutorizada ?? false);
  const [visitante, setVisitante] = useState(inicial?.visitante ?? false);
  const [membro, setMembro] = useState(inicial?.membro ?? false);
  const [aceite, setAceite] = useState(false);
  const [aProcessarFotos, setAProcessarFotos] = useState(false);

  const mudar = (lista, setLista, i, campo, valor) =>
    setLista(lista.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  function tirarCrianca(i) {
    const c = criancas[i];
    if (c.id) setRemovidas((r) => [...r, c.id]);
    setCriancas(criancas.filter((_, j) => j !== i));
  }

  async function submeter(e) {
    e.preventDefault();
    const resp = responsaveis.filter((r) => r.nome.trim() || r.telefone.trim());
    if (!resp.length || resp.some((r) => !r.nome.trim() || digitos(r.telefone).length < 9)) {
      return avisar?.("Cada responsável precisa de nome e de um telemóvel com pelo menos 9 dígitos.");
    }
    const cs = criancas.filter((c) => c.nome.trim() || c.dataNascimento);
    if (!cs.length) return avisar?.("Falta pelo menos uma criança.");
    const semData = cs.find((c) => !c.nome.trim() || !c.dataNascimento);
    if (semData) return avisar?.(`Falta o nome ou a data de nascimento${semData.nome ? ` de ${semData.nome}` : ""}.`);
    if (consentimento && !aceite) return avisar?.("Para registar, é preciso aceitar o consentimento.");
    setAProcessarFotos(true);
    try {
      const [respComFoto, autComFoto, csComFoto] = await Promise.all([
        Promise.all(resp.map(comFotoProcessada)),
        Promise.all(autorizados.filter((a) => a.nome.trim()).map(comFotoProcessada)),
        Promise.all((salaFixa ? cs.map((c) => ({ ...c, categoria: salaFixa })) : cs).map(comFotoProcessada)),
      ]);
      onSubmeter({
        responsaveis: respComFoto,
        autorizados: autComFoto,
        criancas: csComFoto,
        removidas,
        fotoAutorizada,
        visitante,
        membro,
        ...(consentimento ? { consentimento: { aceite: true, versao: consentimento.versao } } : {}),
      });
    } catch {
      avisar?.("Não foi possível preparar uma das fotos. Tenta outra imagem.");
    } finally {
      setAProcessarFotos(false);
    }
  }

  return (
    <form onSubmit={submeter}>
      <div className="sect">
        <div className="cabecalho"><h3>{criancas.length > 1 ? "As crianças" : "A criança"}</h3></div>
        {criancas.map((c, i) => (
          <div className="caixa" key={c.id ?? `n${i}`} style={{ marginTop: 10 }}>
            <FotoPessoa foto={c.foto} onEscolher={(f) => mudar(criancas, setCriancas, i, "foto", f)} />
            <label className="rot">Nome</label>
            <input className="campo" value={c.nome} onChange={(e) => mudar(criancas, setCriancas, i, "nome", e.target.value)} placeholder="Nome e apelido" autoComplete="off" />
            <label className="rot">Data de nascimento</label>
            <input className="campo" type="date" value={c.dataNascimento} onChange={(e) => mudar(criancas, setCriancas, i, "dataNascimento", e.target.value)} />
            {salaFixa ? (
              <>
                <label className="rot">Sala</label>
                <span className="kin-tagcat" style={varsCategoria(salaFixa)}>{nomeCategoria(salaFixa)}</span>
              </>
            ) : podeEscolherSala && (
              <>
                <label className="rot">Sala</label>
                <SeletorCategoria valor={c.categoria ?? null} comTodas={false} onMudar={(v) => mudar(criancas, setCriancas, i, "categoria", v)} />
                <p className="ds">Se não escolheres, fica a sala da idade.</p>
              </>
            )}
            <label className="rot">Alergias (opcional)</label>
            <input className="campo" value={c.alergias} onChange={(e) => mudar(criancas, setCriancas, i, "alergias", e.target.value)} placeholder="Ex.: amendoim, penicilina" />
            <label className="rot">Restrições alimentares (opcional)</label>
            <input className="campo" value={c.restricoesAlimentares} onChange={(e) => mudar(criancas, setCriancas, i, "restricoesAlimentares", e.target.value)} placeholder="Ex.: sem glúten, sem lactose" />
            <label className="rot">Cuidados ou necessidades (opcional)</label>
            <textarea className="campo" rows={2} value={c.necessidades} onChange={(e) => mudar(criancas, setCriancas, i, "necessidades", e.target.value)} placeholder="O que os voluntários devem saber" />
            {criancas.length > 1 && (
              <button type="button" className="btn sec full" style={{ marginTop: 10, color: "var(--magenta)" }} onClick={() => tirarCrianca(i)}>
                Tirar {c.nome || "esta criança"}
              </button>
            )}
          </div>
        ))}
        {criancas.length < 8 && (
          <button type="button" className="btn sec full" style={{ marginTop: 10 }} onClick={() => setCriancas([...criancas, vazioCrianca()])}>
            + Outra criança
          </button>
        )}
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Responsáveis</h3></div>
        <p className="ds">O contacto que o Kinder usa se precisar de chamar alguém durante o culto.</p>
        {responsaveis.map((r, i) => (
          <div className="caixa" key={r.id ?? i} style={{ marginTop: 10 }}>
            <FotoPessoa foto={r.foto} onEscolher={(f) => mudar(responsaveis, setResponsaveis, i, "foto", f)} />
            <label className="rot">Nome</label>
            <input className="campo" value={r.nome} onChange={(e) => mudar(responsaveis, setResponsaveis, i, "nome", e.target.value)} autoComplete="name" />
            <label className="rot">Telemóvel</label>
            <input className="campo" type="tel" inputMode="tel" value={r.telefone} onChange={(e) => mudar(responsaveis, setResponsaveis, i, "telefone", e.target.value)} placeholder="9xx xxx xxx" autoComplete="tel" />
            <label className="rot">Parentesco (opcional)</label>
            <input className="campo" value={r.parentesco} onChange={(e) => mudar(responsaveis, setResponsaveis, i, "parentesco", e.target.value)} placeholder="Mãe, pai, avó…" />
            {responsaveis.length > 1 && (
              <button type="button" className="btn sec full" style={{ marginTop: 10 }} onClick={() => setResponsaveis(responsaveis.filter((_, j) => j !== i))}>
                Tirar este responsável
              </button>
            )}
          </div>
        ))}
        {responsaveis.length < 4 && (
          <button type="button" className="btn sec full" style={{ marginTop: 10 }} onClick={() => setResponsaveis([...responsaveis, vazioResponsavel()])}>
            + Outro responsável
          </button>
        )}
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Quem mais pode ir buscar</h3></div>
        <p className="ds">Além dos responsáveis. À saída, o voluntário confirma quem veio.</p>
        {autorizados.map((a, i) => (
          <div className="caixa" key={a.id ?? i} style={{ marginTop: 10 }}>
            <FotoPessoa foto={a.foto} onEscolher={(f) => mudar(autorizados, setAutorizados, i, "foto", f)} />
            <label className="rot">Nome</label>
            <input className="campo" value={a.nome} onChange={(e) => mudar(autorizados, setAutorizados, i, "nome", e.target.value)} />
            <label className="rot">Parentesco (opcional)</label>
            <input className="campo" value={a.parentesco} onChange={(e) => mudar(autorizados, setAutorizados, i, "parentesco", e.target.value)} placeholder="Tia, padrinho…" />
            <button type="button" className="btn sec full" style={{ marginTop: 10 }} onClick={() => setAutorizados(autorizados.filter((_, j) => j !== i))}>
              Tirar
            </button>
          </div>
        ))}
        {autorizados.length < 6 && (
          <button type="button" className="btn sec full" style={{ marginTop: 10 }} onClick={() => setAutorizados([...autorizados, { id: novoId(), nome: "", parentesco: "", telefone: "", foto: null }])}>
            + Pessoa autorizada
          </button>
        )}
      </div>

      <div className="sect">
        <label className="linha" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={fotoAutorizada} onChange={(e) => setFotoAutorizada(e.target.checked)} style={{ width: 22, height: 22 }} />
          <div style={{ flex: 1 }}>
            <p className="nmt">Autorizo fotografias</p>
            <p className="ds">Das atividades do Kinder, para as redes da Onda.</p>
          </div>
        </label>
        {mostrarVisitante && (
          <>
            <label className="linha" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={visitante} onChange={(e) => setVisitante(e.target.checked)} style={{ width: 22, height: 22 }} />
              <div style={{ flex: 1 }}>
                <p className="nmt">É a primeira vez na Onda</p>
                <p className="ds">Para vos darmos as boas-vindas.</p>
              </div>
            </label>
            <label className="linha" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={membro} onChange={(e) => setMembro(e.target.checked)} style={{ width: 22, height: 22 }} />
              <div style={{ flex: 1 }}>
                <p className="nmt">Somos membros da Igreja Onda</p>
                <p className="ds">No fim, convidamos-vos para o grupo dos pais do Kinder.</p>
              </div>
            </label>
          </>
        )}
      </div>

      {consentimento && (
        <div className="sect">
          <div className="cabecalho"><h3>Consentimento</h3></div>
          <div className="caixa">
            <p style={{ fontSize: 13.5, lineHeight: 1.55 }}>{consentimento.texto}</p>
          </div>
          <label className="linha" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} style={{ width: 22, height: 22 }} />
            <p className="nmt" style={{ flex: 1 }}>Li e aceito</p>
          </label>
        </div>
      )}

      <button type="submit" className="btn full" style={{ marginTop: 18 }} disabled={aEnviar || aProcessarFotos}>
        {aProcessarFotos ? "A preparar fotos…" : aEnviar ? "A enviar…" : textoBotao}
      </button>
      {onCancelar && (
        <button type="button" className="btn sec full" style={{ marginTop: 9 }} onClick={onCancelar}>Cancelar</button>
      )}
    </form>
  );
}
