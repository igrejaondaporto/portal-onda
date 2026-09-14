import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";
import { CATEGORIAS, capacidadesPorSala, cEscala, minhaSalaRestrita, nomeCategoria, souLider, souMestra, varsCategoria } from "../lib/modelo";
import { ouvirVoluntarios } from "../lib/painel";
import {
  hojeLocal, hora, ouvirFamilias, ouvirCriancas, ouvirCheckins, ouvirCodigos, lerConteudoQR,
  ouvirContagem, corrigirContagem, obterFamiliaDoServidor, anularCheckin,
} from "../lib/kinder";
import SeletorCategoria from "../components/SeletorCategoria";
import LeitorQR from "../components/LeitorQR";
import SheetFamilia from "../components/checkin/SheetFamilia";
import SheetSaida from "../components/checkin/SheetSaida";
import SheetNovaFamilia from "../components/checkin/SheetNovaFamilia";
import Relatorios from "../components/checkin/Relatorios";

const normalizar = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function Cuidados({ crianca }) {
  if (!crianca) return null;
  return (
    <>
      {crianca.alergias && <span className="kin-alerta">Alergias: {crianca.alergias}</span>}
      {crianca.restricoesAlimentares && <span className="kin-alerta info">{crianca.restricoesAlimentares}</span>}
      {crianca.necessidades && <span className="kin-alerta info">{crianca.necessidades}</span>}
    </>
  );
}

/**
 * Check-in e saída — o que o My Kids fazia. Entrada: ler o QR do link
 * da família (ou procurar pelo nome) → marcar as crianças → sai um
 * código de levantamento, um por família. Saída: o código tem de
 * bater certo (ou uma líder força, com motivo). Tudo por Cloud
 * Function (functions/kinder.js); aqui só se lê.
 */
export default function Checkin({ uid, papel, pessoa, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const lider = souLider(papel);
  // presa à sua sala em tudo aqui — nunca vê criança, família nem
  // ocorrência de outra (a única excepção do Portal é a Escala).
  const restrita = minhaSalaRestrita(papel, pessoa);
  const hoje = hojeLocal();
  const [familias, setFamilias] = useState([]);
  const [criancas, setCriancas] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [codigos, setCodigos] = useState({});
  const [sala, setSala] = useState(restrita);
  const [procura, setProcura] = useState("");
  const [verSaidos, setVerSaidos] = useState(false);
  const [verTodas, setVerTodas] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [escalaHoje, setEscalaHoje] = useState(null);
  const [correcoes, setCorrecoes] = useState({});
  const [aCorrigir, setACorrigir] = useState(null); // { sala, valor }

  useEffect(() => ouvirFamilias(setFamilias), []);
  useEffect(() => ouvirCriancas(setCriancas), []);
  useEffect(() => ouvirCheckins(hoje, setCheckins), [hoje]);
  useEffect(() => ouvirCodigos(hoje, setCodigos), [hoje]);
  useEffect(() => ouvirContagem(hoje, setCorrecoes), [hoje]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => onSnapshot(cEscala(hoje), (s) => setEscalaHoje(s.exists() ? s.data() : null)), [hoje]);
  // presa à sua sala — mesmo que `pessoa` só carregue depois do
  // primeiro render, a sala fica sempre trancada quando restrita.
  useEffect(() => { if (restrita) setSala(restrita); }, [restrita]);
  // Mestra da própria sala hoje ganha a mesma permissão da líder para
  // forçar saída sem código — só na sua sala (souMestra já confirma
  // isso); o servidor (checkoutKinder) confirma tudo de novo.
  const podeForcarSaida = lider || souMestra(escalaHoje, restrita, uid);

  const criancaPorId = useMemo(() => Object.fromEntries(criancas.map((c) => [c.id, c])), [criancas]);
  const familiaPorId = useMemo(() => Object.fromEntries(familias.map((f) => [f.id, f])), [familias]);
  const checkinPorCrianca = useMemo(() => Object.fromEntries(checkins.filter((c) => !c.anulado).map((c) => [c.criancaId, c])), [checkins]);
  // nunca as crianças de outra sala — mesmo dentro da mesma família
  // (irmãos em salas diferentes): a líder de uma sala só vê e só
  // regista entrada/saída de quem é da sua.
  const criancasDaFamilia = (familiaId) => criancas.filter((c) => c.familiaId === familiaId && (!restrita || c.categoria === restrita));

  const validos = checkins.filter((c) => !c.anulado && (!restrita || c.categoria === restrita));
  const naSala = validos.filter((c) => !c.saidaEm);
  const saidos = validos.filter((c) => c.saidaEm);
  const naSalaFiltrados = naSala.filter((c) => !sala || c.categoria === sala);
  const contagens = Object.fromEntries(CATEGORIAS.map((c) => [c.id, checkins.filter((k) => !k.anulado && !k.saidaEm && k.categoria === c.id).length]));
  const capacidades = useMemo(
    () => capacidadesPorSala(escalaHoje?.pessoas ?? [], voluntarios),
    [escalaHoje, voluntarios],
  );
  const salaNoLimite = sala && capacidades[sala] > 0 && contagens[sala] >= capacidades[sala];
  // todas as famílias registadas (não só quem já entrou hoje) — uma
  // sala restrita só vê quem tem criança na própria sala, mesmo
  // filtro do resto do ecrã.
  const todasAsFamilias = familias
    .filter((f) => criancasDaFamilia(f.id).length > 0)
    .sort((a, b) => (criancasDaFamilia(a.id)[0]?.nome ?? "").localeCompare(criancasDaFamilia(b.id)[0]?.nome ?? "", "pt"));

  // visão geral da contagem, sempre à vista aqui (a Contagem deixou
  // de ter aba própria — as ocorrências saíram, o telão de Chamadas
  // já cobre "chamar os pais"). Conta sozinha pelos check-ins;
  // corrigível à mão, tal como era na aba antiga.
  const categoriasVisiveis = restrita ? CATEGORIAS.filter((c) => c.id === restrita) : CATEGORIAS;
  const valorContagem = (id) => correcoes[id]?.valor ?? contagens[id];

  async function guardarCorrecaoContagem() {
    const n = aCorrigir.valor === "" ? null : Number(aCorrigir.valor);
    if (n != null && (!Number.isInteger(n) || n < 0)) return torrada("Tem de ser um número.", true);
    // sem await: fica na cache local e sincroniza quando houver rede
    corrigirContagem(hoje, aCorrigir.sala, n, uid).catch((e) => torrada(e.message, true));
    setACorrigir(null);
  }

  const resultados = useMemo(() => {
    const q = normalizar(procura.trim());
    if (q.length < 2) return [];
    const qDigitos = procura.replace(/\D/g, "");
    return familias.filter((f) => {
      const filhosVisiveis = criancasDaFamilia(f.id);
      if (!filhosVisiveis.length) return false; // sem filho na tua sala — não é para ti
      const nomes = [...(f.responsaveis || []).map((r) => r.nome), ...filhosVisiveis.map((c) => c.nome)];
      return nomes.some((n) => normalizar(n).includes(q)) || (qDigitos.length >= 3 && (f.telefones || []).some((t) => t.includes(qDigitos)));
    }).slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procura, familias, criancas, restrita]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Check-in</em>,
      subtitulo: "Entrada e saída das crianças",
      chips: [`${naSala.length} na sala`, `${saidos.length} já saíram`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, naSala.length, saidos.length]);

  async function aoLerQR(texto) {
    const lido = lerConteudoQR(texto);
    if (!lido) { setSheet(null); torrada("Este QR não é de uma família do Kinder.", true); return; }
    // a família pode ter acabado de se registar — a escuta local
    // (ouvirFamilias) só vê o que já sincronizou; antes de dizer "não
    // encontrada", confirma a sério no servidor (visto ao vivo: uma
    // família registada agora mesmo podia demorar a aparecer aqui).
    if (!familiaPorId[lido.familiaId]) {
      const confirmada = await obterFamiliaDoServidor(lido.familiaId);
      if (!confirmada) { setSheet(null); torrada("Família não encontrada — pode ter sido removida.", true); return; }
      // a escuta ao vivo ainda não chegou a esta — entra já, sem
      // esperar pela próxima sincronização.
      setFamilias((fs) => (fs.some((f) => f.id === confirmada.id) ? fs : [...fs, confirmada]));
    }
    const naSalaDaFamilia = naSala.filter((c) => c.familiaId === lido.familiaId);
    // com código e crianças na sala → é a saída; senão → é a entrada
    if (naSalaDaFamilia.length && lido.codigo) {
      setSheet({ tipo: "saida", familiaId: lido.familiaId, codigo: lido.codigo });
    } else {
      setSheet({ tipo: "familia", familiaId: lido.familiaId });
    }
  }

  function linhaFamilia(f) {
    const cs = criancasDaFamilia(f.id);
    return (
      <div className="linha" key={f.id} style={{ cursor: "pointer" }} onClick={() => setSheet({ tipo: "familia", familiaId: f.id })}>
        <div style={{ flex: 1 }}>
          <p className="nmt">{cs.map((c) => c.nome).join(", ") || "Sem crianças"}</p>
          <p className="ds">{(f.responsaveis || []).map((r) => r.nome).join(" · ")}</p>
          <div>{cs.map((c) => <Cuidados key={c.id} crianca={c} />)}</div>
        </div>
        {cs.some((c) => checkinPorCrianca[c.id] && !checkinPorCrianca[c.id].saidaEm)
          ? <span className="tag lim">na sala</span> : <span className="seta">›</span>}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button className="btn" style={{ flex: 1 }} onClick={() => setSheet({ tipo: "leitor" })} data-tour="checkin-qr">Ler QR</button>
        <button className="btn sec" style={{ flex: 1 }} onClick={() => setSheet({ tipo: "nova" })}>Nova família</button>
      </div>
      <div className="kin-procura">
        <input
          className="campo" value={procura} onChange={(e) => setProcura(e.target.value)}
          placeholder="Procurar criança, pai/mãe ou telemóvel" type="search"
        />
      </div>

      <div className="sect kin-atencao" style={{ marginTop: 12 }}>
        <div className="cabecalho"><h3>Visão geral</h3><span className="cap">{categoriasVisiveis.reduce((a, c) => a + valorContagem(c.id), 0)} crianças</span></div>
        <div className="kin-grelha" style={{ gridTemplateColumns: `repeat(${categoriasVisiveis.length}, 1fr)` }}>
          {categoriasVisiveis.map((c) => (
            <button
              key={c.id} type="button" className="kin-num" style={{ ...varsCategoria(c.id), border: 0, cursor: "pointer" }}
              onClick={() => setACorrigir({ sala: c.id, valor: String(valorContagem(c.id)) })}
            >
              <b>{valorContagem(c.id)}</b>
              <span>{c.nome}{correcoes[c.id] ? " · corrigido" : ""}</span>
            </button>
          ))}
        </div>
        <p className="ds" style={{ marginTop: 8 }}>Conta sozinha pelos check-ins. Toca num número para corrigir.</p>
        {aCorrigir && (
          <div className="caixa" style={{ marginTop: 10 }}>
            <p className="nmt" style={{ fontSize: 14 }}>Sala {nomeCategoria(aCorrigir.sala)} · check-ins: {contagens[aCorrigir.sala]}</p>
            <input
              className="campo" type="number" min="0" inputMode="numeric" value={aCorrigir.valor} autoFocus
              onChange={(e) => setACorrigir((a) => ({ ...a, valor: e.target.value }))}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={guardarCorrecaoContagem}>Guardar</button>
              {correcoes[aCorrigir.sala] && (
                <button className="btn sec" style={{ flex: 1 }} onClick={() => { corrigirContagem(hoje, aCorrigir.sala, null, uid); setACorrigir(null); }}>Voltar ao automático</button>
              )}
              <button className="btn sec" style={{ flex: 1 }} onClick={() => setACorrigir(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {procura.trim().length >= 2 ? (
        <div className="sect">
          <div className="cabecalho"><h3>Resultados</h3><span className="cap">{resultados.length}</span></div>
          {resultados.length ? resultados.map(linhaFamilia) : (
            <div className="vaz">
              Ninguém com esse nome.
              <br />
              <button className="btn sec" style={{ marginTop: 12 }} onClick={() => setSheet({ tipo: "nova" })}>Registar família nova</button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="sect kin-atencao">
            <div className="cabecalho"><h3>Na sala agora</h3></div>
            {restrita ? (
              <p className="kin-tagcat" style={varsCategoria(restrita)}>{nomeCategoria(restrita)}</p>
            ) : (
              <SeletorCategoria valor={sala} onMudar={setSala} contagens={contagens} capacidades={capacidades} />
            )}
            {salaNoLimite && (
              <p className="ds" style={{ marginTop: 4 }}>
                <span className="kin-alerta">
                  {nomeCategoria(sala)} no limite ({contagens[sala]}/{capacidades[sala]}) — precisa de mais um voluntário na sala para receber mais crianças.
                </span>
              </p>
            )}
            {naSalaFiltrados.length === 0 ? (
              <div className="vaz" style={{ marginTop: 10 }}>{sala ? `Ninguém na sala ${nomeCategoria(sala)}.` : "Ninguém na sala ainda."}</div>
            ) : naSalaFiltrados
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
              .map((c) => (
                <div className="linha" key={c.criancaId} style={{ cursor: "pointer" }} onClick={() => setSheet({ tipo: "saida", familiaId: c.familiaId, criancaId: c.criancaId })}>
                  <FotoRedonda src={criancaPorId[c.criancaId]?.foto?.url} alt={c.nome} />
                  <div style={{ flex: 1 }}>
                    <p className="nmt">{c.nome}</p>
                    <p className="ds">Entrou às {hora(c.entradaEm)} · código {c.codigo}</p>
                    <Cuidados crianca={criancaPorId[c.criancaId]} />
                  </div>
                  {c.categoria && <span className="kin-tagcat" style={varsCategoria(c.categoria)}>{nomeCategoria(c.categoria)}</span>}
                </div>
              ))}
          </div>

          {saidos.length > 0 && (
            <div className="sect">
              <div className="cabecalho" style={{ cursor: "pointer" }} onClick={() => setVerSaidos((v) => !v)}>
                <h3>Já saíram</h3><span className="cap">{saidos.length} {verSaidos ? "▾" : "▸"}</span>
              </div>
              {verSaidos && saidos.map((c) => (
                <div className="linha" key={c.criancaId}>
                  <FotoRedonda src={criancaPorId[c.criancaId]?.foto?.url} alt={c.nome} />
                  <div style={{ flex: 1 }}>
                    <p className="nmt">{c.nome}</p>
                    <p className="ds">
                      {hora(c.entradaEm)}–{hora(c.saidaEm)} · {c.levantadoPor}
                      {c.saidaForcada ? ` · sem código: ${c.saidaForcada.motivo}` : ""}
                    </p>
                  </div>
                  {c.categoria && <span className="kin-tagcat" style={varsCategoria(c.categoria)}>{nomeCategoria(c.categoria)}</span>}
                  {(lider || c.entradaPor === uid) && (
                    <button
                      type="button" className="oc-icobt mag" aria-label={`Anular check-in de ${c.nome}`}
                      onClick={() => anularCheckin(c.criancaId).then(() => torrada(`Check-in de ${c.nome.split(" ")[0]} anulado`)).catch((e) => torrada(e.message || "Não foi possível anular.", true))}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="sect">
            <div className="cabecalho" style={{ cursor: "pointer" }} onClick={() => setVerTodas((v) => !v)}>
              <h3>Todas as famílias</h3><span className="cap">{todasAsFamilias.length} {verTodas ? "▾" : "▸"}</span>
            </div>
            {verTodas && (todasAsFamilias.length ? todasAsFamilias.map(linhaFamilia) : <div className="vaz">Ainda nenhuma família registada.</div>)}
          </div>

          {lider && (
            <button className="btn sec full" style={{ marginTop: 18 }} onClick={() => setSheet({ tipo: "relatorios" })}>Relatórios</button>
          )}
        </>
      )}
      <p className="nota">Os dados das crianças só são vistos pelos voluntários do Kinder.</p>

      {sheet?.tipo === "leitor" && <LeitorQR titulo="Ler QR da família" onLido={aoLerQR} onFechar={() => setSheet(null)} />}
      {sheet?.tipo === "familia" && familiaPorId[sheet.familiaId] && (
        <SheetFamilia
          familia={familiaPorId[sheet.familiaId]} criancas={criancasDaFamilia(sheet.familiaId)}
          checkinPorCrianca={checkinPorCrianca} codigo={codigos[sheet.familiaId]}
          lider={lider} restrita={restrita} tokenAcabado={sheet.token}
          onFechar={() => setSheet(null)}
          onSaida={() => setSheet({ tipo: "saida", familiaId: sheet.familiaId })}
        />
      )}
      {sheet?.tipo === "saida" && familiaPorId[sheet.familiaId] && (
        <SheetSaida
          familia={familiaPorId[sheet.familiaId]} criancas={criancasDaFamilia(sheet.familiaId)}
          checkinPorCrianca={checkinPorCrianca} criancaInicial={sheet.criancaId} codigoInicial={sheet.codigo}
          uid={uid} lider={lider} podeForcarSaida={podeForcarSaida}
          onFechar={() => setSheet(null)}
        />
      )}
      {sheet?.tipo === "nova" && (
        <SheetNovaFamilia
          restrita={restrita}
          onFechar={() => setSheet(null)}
          onRegistada={({ familiaId, token }) => { setProcura(""); setSheet({ tipo: "familia", familiaId, token }); }}
        />
      )}
      {sheet?.tipo === "relatorios" && <Relatorios criancas={criancas} familias={familias} restrita={restrita} onFechar={() => setSheet(null)} />}
    </>
  );
}
