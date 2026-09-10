import { useState } from "react";
import SeletorCategoria from "./SeletorCategoria";

const vazioResponsavel = () => ({ nome: "", telefone: "", parentesco: "" });
const vazioCrianca = () => ({ nome: "", dataNascimento: "", alergias: "", restricoesAlimentares: "", necessidades: "", categoria: null });
const digitos = (t) => String(t || "").replace(/\D/g, "");

/**
 * A ficha da família — a mesma nas quatro situações: os pais pelo QR
 * (/registo), o voluntário na receção, os pais a corrigir pelo link da
 * família, e o voluntário a corrigir. Só muda o que se mostra à volta:
 *   - `consentimento` → só no registo (texto + caixa a marcar);
 *   - `podeEscolherSala` → só voluntários (os pais nunca escolhem a
 *     sala; fica a sugerida pela idade — ver functions/kinder.js).
 */
export default function FormFamilia({
  inicial, consentimento, podeEscolherSala = false, mostrarVisitante = false,
  aEnviar = false, textoBotao = "Guardar", onSubmeter, onCancelar, avisar,
}) {
  const [responsaveis, setResponsaveis] = useState(inicial?.responsaveis?.length ? inicial.responsaveis : [vazioResponsavel()]);
  const [autorizados, setAutorizados] = useState(inicial?.autorizados ?? []);
  const [criancas, setCriancas] = useState(inicial?.criancas?.length ? inicial.criancas : [vazioCrianca()]);
  const [removidas, setRemovidas] = useState([]);
  const [fotoAutorizada, setFotoAutorizada] = useState(inicial?.fotoAutorizada ?? false);
  const [visitante, setVisitante] = useState(inicial?.visitante ?? false);
  const [aceite, setAceite] = useState(false);

  const mudar = (lista, setLista, i, campo, valor) =>
    setLista(lista.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  function tirarCrianca(i) {
    const c = criancas[i];
    if (c.id) setRemovidas((r) => [...r, c.id]);
    setCriancas(criancas.filter((_, j) => j !== i));
  }

  function submeter(e) {
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
    onSubmeter({
      responsaveis: resp,
      autorizados: autorizados.filter((a) => a.nome.trim()),
      criancas: cs,
      removidas,
      fotoAutorizada,
      visitante,
      ...(consentimento ? { consentimento: { aceite: true, versao: consentimento.versao } } : {}),
    });
  }

  return (
    <form onSubmit={submeter}>
      <div className="sect">
        <div className="cabecalho"><h3>{criancas.length > 1 ? "As crianças" : "A criança"}</h3></div>
        {criancas.map((c, i) => (
          <div className="caixa" key={c.id ?? `n${i}`} style={{ marginTop: 10 }}>
            <label className="rot" style={{ marginTop: 0 }}>Nome</label>
            <input className="campo" value={c.nome} onChange={(e) => mudar(criancas, setCriancas, i, "nome", e.target.value)} placeholder="Nome e apelido" autoComplete="off" />
            <label className="rot">Data de nascimento</label>
            <input className="campo" type="date" value={c.dataNascimento} onChange={(e) => mudar(criancas, setCriancas, i, "dataNascimento", e.target.value)} />
            {podeEscolherSala && (
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
          <div className="caixa" key={i} style={{ marginTop: 10 }}>
            <label className="rot" style={{ marginTop: 0 }}>Nome</label>
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
          <div className="caixa" key={i} style={{ marginTop: 10 }}>
            <label className="rot" style={{ marginTop: 0 }}>Nome</label>
            <input className="campo" value={a.nome} onChange={(e) => mudar(autorizados, setAutorizados, i, "nome", e.target.value)} />
            <label className="rot">Parentesco (opcional)</label>
            <input className="campo" value={a.parentesco} onChange={(e) => mudar(autorizados, setAutorizados, i, "parentesco", e.target.value)} placeholder="Tia, padrinho…" />
            <button type="button" className="btn sec full" style={{ marginTop: 10 }} onClick={() => setAutorizados(autorizados.filter((_, j) => j !== i))}>
              Tirar
            </button>
          </div>
        ))}
        {autorizados.length < 6 && (
          <button type="button" className="btn sec full" style={{ marginTop: 10 }} onClick={() => setAutorizados([...autorizados, { nome: "", parentesco: "", telefone: "" }])}>
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
          <label className="linha" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={visitante} onChange={(e) => setVisitante(e.target.checked)} style={{ width: 22, height: 22 }} />
            <div style={{ flex: 1 }}>
              <p className="nmt">É a primeira vez na Onda</p>
              <p className="ds">Para vos darmos as boas-vindas.</p>
            </div>
          </label>
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

      <button type="submit" className="btn full" style={{ marginTop: 18 }} disabled={aEnviar}>
        {aEnviar ? "A enviar…" : textoBotao}
      </button>
      {onCancelar && (
        <button type="button" className="btn sec full" style={{ marginTop: 9 }} onClick={onCancelar}>Cancelar</button>
      )}
    </form>
  );
}
