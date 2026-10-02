import { useEffect, useState } from "react";
import {
  PAPEIS_QUE_RESPONDEM, decidirCandidatura, haQuantoTempo, ouvirPedidosDaBase, urlDaBase,
} from "../lib/candidaturas.js";
import { linkWhatsApp } from "../lib/data.js";
import { BASE_ID } from "../lib/firebase.js";
import { useTorrada } from "../lib/TorradaContext.jsx";
import Avatar from "./Avatar.jsx";

/**
 * "🙋 N pessoas querem servir na tua base" — no Início do líder.
 *
 * Sempre à vista enquanto houver um pedido por responder (pedido do dono
 * do produto: "a pendência fica sempre a aparecer para os líderes") —
 * não tem "dispensar", sai quando o líder responde. Mesmo cartão
 * `.destaque` do resto do Início ("isto precisa de ti"), a magenta como
 * as outras pendências, e sempre com texto: a cor nunca é a única pista.
 *
 * Duas linhas por app, como o `RecadoPastoral`: importar e pôr
 * `<PedidosParaServir papel={papel} />` no topo do Início. Voluntários
 * não veem nada (e as regras nem lhes deixam ler os pedidos).
 */
export default function PedidosParaServir({ papel }) {
  const [pedidos, setPedidos] = useState([]);
  const [aberto, setAberto] = useState(false);
  const responde = PAPEIS_QUE_RESPONDEM.has(papel);

  useEffect(() => (responde ? ouvirPedidosDaBase(setPedidos) : undefined), [responde]);

  if (!responde || (!pedidos.length && !aberto)) return null;
  const n = pedidos.length;
  const maisAntigo = pedidos[0];

  return (
    <>
      {n > 0 && (
        <div
          className="destaque sv-pendente" role="button" tabIndex={0}
          onClick={() => setAberto(true)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setAberto(true); }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Pendente · a precisar de ti</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em", lineHeight: 1.3 }}>
              {n === 1 ? `${maisAntigo.nome} quer servir na tua base` : `${n} pessoas querem servir na tua base`}
            </p>
            <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>
              {n === 1 ? `Pedido ${haQuantoTempo(maisAntigo.criadoEm)}` : `O mais antigo é de ${haQuantoTempo(maisAntigo.criadoEm)}`} · toca para responder
            </p>
          </div>
          <span style={{ fontSize: 26 }} aria-hidden>🙋</span>
        </div>
      )}
      {aberto && <SheetPedidosParaServir pedidos={pedidos} onFechar={() => setAberto(false)} />}
    </>
  );
}

/** A lista: cada pessoa com o WhatsApp bem à vista (pedido do dono do
 *  produto: "tem de ter claramente o botão do WhatsApp para poder
 *  chamar a pessoa, e aí sim, depois aprovar") e, por baixo, Aprovar /
 *  Agora não. */
function SheetPedidosParaServir({ pedidos, onFechar }) {
  // o que acabou de ser aprovado fica no ecrã (com o código e a
  // mensagem de boas-vindas) mesmo depois de sair da lista ao vivo
  const [feito, setFeito] = useState(null);
  const nomeBase = pedidos[0]?.baseNome ?? feito?.baseNome ?? "tua base";

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-labelledby="pedidos-servir-titulo">
        <div className="pux" />
        {feito ? (
          <Aprovado feito={feito} onVoltar={() => setFeito(null)} onFechar={onFechar} temMais={pedidos.length > 0} />
        ) : (
          <>
            <h2 id="pedidos-servir-titulo">Querem servir na {nomeBase.replace(/^Base (de |da |do )?/, "")}</h2>
            <p className="sb2">Fala primeiro com a pessoa, e depois responde aqui.</p>
            {pedidos.length === 0 && <div className="vaz" style={{ marginTop: 14 }}>Já respondeste a todos. 🙌</div>}
            {pedidos.map((p) => <Pedido key={p.id} pedido={p} onAprovado={setFeito} />)}
            <button className="btn sec full" style={{ marginTop: 16 }} onClick={onFechar}>Fechar</button>
          </>
        )}
      </div>
    </>
  );
}

function Pedido({ pedido: p, onAprovado }) {
  const torrada = useTorrada();
  const [aGuardar, setAGuardar] = useState(false);
  const [confirmarNao, setConfirmarNao] = useState(false);
  // alguém já tem este telemóvel — o líder diz se é a mesma pessoa
  const [candidatos, setCandidatos] = useState(null);
  const primeiroNome = String(p.nome || "").split(" ")[0] || "a pessoa";
  const baseCurta = p.baseNome?.replace(/^Base (de |da |do )?/, "") ?? "";
  const wa = linkWhatsApp(p.telefone, `Olá ${primeiroNome}! Aqui é da ${p.baseNome} da Igreja Onda 👋 Vi que queres servir connosco — podemos falar?`);

  async function aprovar(extra = {}) {
    setAGuardar(true);
    try {
      const r = await decidirCandidatura(p.id, "aprovar", extra);
      if (r.precisaEscolher) {
        setCandidatos(r.candidatos);
        setAGuardar(false);
        return;
      }
      onAprovado({ ...r, nome: p.nome, baseNome: p.baseNome, telefone: r.telefone || p.telefone });
    } catch (e) {
      torrada(e.message || "Não foi possível aprovar.");
      setAGuardar(false);
    }
  }

  async function recusar() {
    setAGuardar(true);
    try {
      await decidirCandidatura(p.id, "recusar");
      torrada(`Respondeste "agora não" a ${primeiroNome}`);
    } catch (e) {
      torrada(e.message || "Não foi possível responder.");
      setAGuardar(false);
    }
  }

  const outra = p.outrasOpcoes?.[0];

  return (
    <div className="sv-pedido">
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Avatar pessoa={{ nome: p.nome, foto: p.foto }} tamanho={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="nmt">{p.nome}</p>
          <p className="ds">{[p.telefone, p.localidade].filter(Boolean).join(" · ") || "sem telemóvel"}</p>
          {p.origem === "pastoral" ? (
            <>
              <span className="sv-origem">Veio do Painel Pastoral{p.opcao ? ` · ${p.opcao}.ª opção` : ""}</span>
              {outra && <p className="sv-info" style={{ marginTop: 4 }}>{outra.opcao}.ª opção: {outra.nome} — quem aprovar primeiro fica com a pessoa</p>}
              {p.gd && <p className="sv-info" style={{ marginTop: 2 }}>GD: {p.gd}</p>}
            </>
          ) : p.origem === "teste" ? (
            <>
              <span className="sv-origem sv-origem-teste">Veio do teste “Onde vais servir?”</span>
              <InfoCascata p={p} />
              {p.teste?.area && p.teste.areaDe === p.baseId && <p className="sv-info" style={{ marginTop: 2 }}>Área: {p.teste.area}</p>}
            </>
          ) : (
            <>
              <span className="sv-origem sv-origem-perfil">Pediu pelo perfil</span>
              {p.basesAtuais?.length > 0 && <p className="sv-info" style={{ marginTop: 4 }}>Já serve na {p.basesAtuais.join(" e na ")}</p>}
              <InfoCascata p={p} />
            </>
          )}
          {p.mensagem && <p className="ds" style={{ marginTop: 6, fontStyle: "italic" }}>“{p.mensagem}”</p>}
          <p className="sv-info" style={{ marginTop: 4 }}>Pedido {haQuantoTempo(p.criadoEm)}</p>
        </div>
      </div>

      {wa ? (
        <a className="btn full sv-whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
          <IconeWhatsApp /> Chamar {primeiroNome} no WhatsApp
        </a>
      ) : (
        <p className="ds" style={{ marginTop: 12 }}>Sem telemóvel no pedido — fala com quem o enviou.</p>
      )}

      {candidatos ? (
        <div className="sv-confirmar">
          <p className="nmt" style={{ fontSize: 14 }}>Já há alguém com este telemóvel</p>
          <p className="ds">É a mesma pessoa? Se for, fica com o perfil e o código que já tem.</p>
          {candidatos.map((c) => (
            <button key={c.pessoaId} className="btn sec full" style={{ marginTop: 8, textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}
              disabled={aGuardar} onClick={() => aprovar({ pessoaExistenteId: c.pessoaId })}
            >
              <Avatar pessoa={c} tamanho={30} />
              <span style={{ flex: 1, minWidth: 0 }}>
                Sim, é {c.nome}
                {c.bases?.length > 0 && <small style={{ display: "block", fontWeight: 500, color: "var(--cinza)" }}>{c.bases.join(", ")}</small>}
              </span>
            </button>
          ))}
          <button className="btn sec full" style={{ marginTop: 8 }} disabled={aGuardar} onClick={() => aprovar({ criarNova: true })}>
            Não, é outra pessoa — criar perfil novo
          </button>
          <button className="btn sec full" style={{ marginTop: 8, background: "none" }} onClick={() => setCandidatos(null)}>Voltar</button>
        </div>
      ) : confirmarNao ? (
        <div className="sv-confirmar">
          <p className="nmt" style={{ fontSize: 14 }}>Dizer “agora não” a {primeiroNome}?</p>
          <p className="ds">{p.passo ? depoisDoNao(p) : p.origem === "pastoral" ? "O pastor fica a saber." : `${primeiroNome} recebe um aviso.`}</p>
          <div className="sv-acoes">
            <button className="btn perigo" disabled={aGuardar} onClick={recusar}>Agora não</button>
            <button className="btn sec" onClick={() => setConfirmarNao(false)}>Voltar</button>
          </div>
        </div>
      ) : (
        <div className="sv-acoes">
          <button className="btn sv-aprovar" disabled={aGuardar} onClick={() => aprovar()}>
            {aGuardar ? "A aprovar…" : `Aprovar na ${baseCurta}`}
          </button>
          <button className="btn sec" disabled={aGuardar} onClick={() => setConfirmarNao(true)}>Agora não</button>
        </div>
      )}
    </div>
  );
}

/** Em que passo da cascata está o pedido (functions/candidaturas.js):
 *  1.ª escolha, 2.ª, ou "todas" — e para onde segue se for "agora não". */
function InfoCascata({ p }) {
  if (!p.passo) return null;
  const segunda = p.cascata?.[1]?.nome;
  const recusadas = p.recusadas?.length ? p.recusadas.join(" e a ") : null;
  let texto;
  if (p.passo === 1) texto = `1.ª escolha${segunda ? ` · a 2.ª é a ${segunda}` : ""}`;
  else if (p.passo === 2) texto = `2.ª escolha${recusadas ? ` · a ${recusadas} disse “agora não”` : ""}`;
  else texto = `Não escolheu a tua base: ${recusadas ? `a ${recusadas} disse${p.recusadas.length > 1 ? "ram" : ""} “agora não”, e ` : ""}o pedido foi a todas as bases. Quem aprovar primeiro fica com a pessoa.`;
  return <p className="sv-info" style={{ marginTop: 4 }}>{texto}</p>;
}

function depoisDoNao(p) {
  const segunda = p.cascata?.[1]?.nome;
  if (p.passo === 1 && segunda) return `O pedido segue para a ${segunda}, a 2.ª escolha.`;
  if (p.passo < 3) return "O pedido segue para as outras bases.";
  return "As outras bases continuam a poder responder.";
}

/** Depois de aprovar: quem entrou, o código (se for novo) e a mensagem
 *  de boas-vindas já escrita no WhatsApp, com o endereço da base. Os
 *  detalhes próprios da base (ministérios, instrumentos, sala) ajustam-
 *  se no Painel do líder, como para qualquer voluntário. */
function Aprovado({ feito, onVoltar, onFechar, temMais }) {
  const primeiroNome = String(feito.nome || "").split(" ")[0];
  const url = urlDaBase(BASE_ID);
  const texto = feito.pinProvisorio
    ? `Olá ${primeiroNome}! Já fazes parte da ${feito.baseNome} 🙌 Entra em ${url} , escolhe o teu nome e usa o código ${feito.pinProvisorio} — no primeiro acesso vais escolher um código teu.`
    : `Olá ${primeiroNome}! Já fazes parte da ${feito.baseNome} 🙌 Entra em ${url} com o teu código de sempre.`;
  const wa = linkWhatsApp(feito.telefone, texto);
  return (
    <>
      <p style={{ fontSize: 40, textAlign: "center", marginTop: 6 }} aria-hidden>🎉</p>
      <h2 style={{ textAlign: "center" }}>{feito.nome} está na equipa</h2>
      {feito.jaEstava ? (
        <p className="sb2" style={{ textAlign: "center" }}>Já estava na tua base — o pedido ficou respondido.</p>
      ) : feito.pinProvisorio ? (
        <>
          <p className="sb2" style={{ textAlign: "center" }}>Código de acesso provisório:</p>
          <p className="sv-pin">{feito.pinProvisorio}</p>
          <p className="ds" style={{ textAlign: "center" }}>Só aparece agora. No primeiro acesso, {primeiroNome} escolhe um código novo.</p>
        </>
      ) : (
        <p className="sb2" style={{ textAlign: "center" }}>Entra com o código que já usa noutra base.</p>
      )}
      {wa && !feito.jaEstava && (
        <a className="btn full sv-whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
          <IconeWhatsApp /> Mandar as boas-vindas no WhatsApp
        </a>
      )}
      <p className="ds" style={{ marginTop: 12, textAlign: "center" }}>
        Funções, ministérios e o resto ajustas no Painel do líder, como para qualquer voluntário.
      </p>
      {temMais && <button className="btn sec full" style={{ marginTop: 12 }} onClick={onVoltar}>Ver os outros pedidos</button>}
      <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
    </>
  );
}

function IconeWhatsApp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ verticalAlign: "-3px", marginRight: 6 }}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.93.95-3.48-.23-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.44-9.42 9.44zm8.03-17.47A11.3 11.3 0 0 0 12.04.7C5.8.7.72 5.78.72 12.02c0 2 .52 3.94 1.51 5.66L.62 23.5l5.95-1.56a11.3 11.3 0 0 0 5.47 1.4h.01c6.24 0 11.32-5.08 11.32-11.32 0-3.02-1.18-5.87-3.32-8z" />
    </svg>
  );
}
