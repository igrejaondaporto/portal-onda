import { useEffect, useState } from "react";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import AvisoInstalarPWA from "@portal/shared/components/AvisoInstalarPWA.jsx";
import SheetPinBase from "../components/adaptados/SheetPinBase.jsx";
import TecladoNumerico from "@portal/shared/components/TecladoNumerico.jsx";
import { listarBasesMural, dadosEntradaBase, definirBaseEmCurso, pedirEntradaMural, entrarComPinMural, registarMural } from "../lib/auth.js";
import { listarGDs } from "../lib/gds.js";
import { corPara, inicial, nomeBase } from "../lib/util.js";

/**
 * Entrada do Mural — dois caminhos (ver CLAUDE.md desta app):
 *   "Sim, sirvo numa base" → mesmas Cloud Functions de sempre
 *     (dadosEntrada/entrar), só com um passo a mais (escolher a
 *     base). Usa `SheetPinBase` (components/adaptados/), uma cópia
 *     do SheetPin partilhado — nunca o original: ver o LEIA-ME dessa
 *     pasta para o porquê (import relativo que quebrava a base
 *     escolhida).
 *   "Não, sou da igreja" → telemóvel + PIN, próprio deste app
 *     (functions/mural.js) — GD é opcional, "ainda não estou nem sei"
 *     nunca bloqueia ninguém.
 * Sem GatilhoDev aqui: o acesso de dev é por base (CLAUDE.md raiz,
 * "Ao criar uma base nova", item 3) e o Mural não é uma — fica de
 * fora de propósito, não por esquecimento.
 */
export default function Entrada() {
  const [passo, setPasso] = useState("escolha");
  const [bases, setBases] = useState(null);
  const [baseEscolhida, setBaseEscolhida] = useState(null);
  const [pessoas, setPessoas] = useState([]);
  const [alvo, setAlvo] = useState(null);
  const [erro, setErro] = useState("");

  const [telefone, setTelefone] = useState("");
  const [gds, setGds] = useState([]);
  const [gdEscolhido, setGdEscolhido] = useState(undefined); // undefined = ainda não perguntou
  const [nome, setNome] = useState("");
  const [digitosExistente, setDigitosExistente] = useState(4);

  // Pede as bases e os GDs já ao abrir a Entrada, não só ao chegar a
  // cada passo — as duas funções são públicas (sem sessão) e o pedido
  // pode ir andando em fundo enquanto a pessoa ainda decide "sim/não
  // sirvo numa base"; sem isto, era o próprio passo que disparava o
  // pedido, e via-se a lista vazia/a carregar até a resposta chegar
  // (2026-09, reportado como "demora a carregar").
  useEffect(() => {
    listarBasesMural().then(setBases).catch(() => setErro("Não foi possível carregar as bases."));
    listarGDs().then(setGds).catch(() => setGds([]));
  }, []);

  function escolherBase(b) {
    setBaseEscolhida(b);
    setErro("");
    definirBaseEmCurso(b.id);
    dadosEntradaBase(b.id)
      .then((d) => setPessoas(d.pessoas))
      .catch(() => setErro("Não foi possível carregar essa base."));
    setPasso("rostos");
  }

  async function continuarTelemovel() {
    const limpo = telefone.replace(/\D/g, "");
    if (limpo.length < 9) return setErro("Introduz um telemóvel válido.");
    setErro("");
    const r = await pedirEntradaMural(limpo).catch(() => null);
    if (!r) return setErro("Não foi possível verificar o telemóvel. Tenta outra vez.");
    if (r.existe) {
      setDigitosExistente(r.digitos);
      setPasso("pinExistente");
    } else {
      setPasso("gd");
    }
  }

  return (
    <div className="login">
      <AvisoOffline />
      <AvisoInstalarPWA />

      {passo === "escolha" && (
        <>
          <div className="crista entrada">
            <div>
              <div className="lin">
                <span className="logo">
                  <i>mural</i>
                  <b>onda</b>
                </span>
              </div>
              <h1>
                Mural <em>Onda</em>
              </h1>
              <p className="sob">O que a igreja oferece e o que a igreja procura, num sítio só.</p>
              <div className="chips">
                <span className="chip">Vendas</span>
                <span className="chip">Doações</span>
                <span className="chip">Arrendamento</span>
                <span className="chip">Pedidos</span>
              </div>
            </div>
            <svg className="curva" viewBox="0 0 400 46" preserveAspectRatio="none">
              <path d="M0,46 C110,4 290,4 400,46 L400,46 L0,46 Z" fill="#fff" />
            </svg>
          </div>
          <div className="folha">
            <span className="cap">Entrar</span>
            <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.03em", margin: "10px 0 4px" }}>
              Já serves numa base?
            </h2>
            <p className="ds" style={{ marginBottom: 8 }}>
              Se serves na Apoio, Técnica, Louvor ou noutra, entras com o PIN que já usas no portal.
            </p>
            <button className="opcao" onClick={() => setPasso("bases")}>
              <span className="bola" style={{ background: "var(--azul)" }}>S</span>
              <span>
                <span className="nmt" style={{ display: "block" }}>Sim, sirvo numa base</span>
                <span className="ds" style={{ display: "block" }}>Escolhe a tua base e o teu nome</span>
              </span>
              <span className="seta">›</span>
            </button>
            <button className="opcao" onClick={() => setPasso("telemovel")}>
              <span className="bola" style={{ background: "var(--violeta)" }}>N</span>
              <span>
                <span className="nmt" style={{ display: "block" }}>Não, sou da igreja</span>
                <span className="ds" style={{ display: "block" }}>Entra pelo teu telemóvel</span>
              </span>
              <span className="seta">›</span>
            </button>
          </div>
        </>
      )}

      {passo === "bases" && (
        <div className="folha" style={{ paddingTop: 34 }}>
          <div className="tit">
            <h2>Em que base serves?</h2>
          </div>
          {erro && <p className="aviso" style={{ textAlign: "left", paddingTop: 0 }}>{erro}</p>}
          {(bases ?? []).map((b) => (
            <button key={b.id} className="opcao" onClick={() => escolherBase(b)}>
              <span className="bola" style={{ background: corPara(b.nome) }}>{inicial(b.nome)}</span>
              <span>
                <span className="nmt">{nomeBase(b.nome)}</span>
              </span>
              <span className="seta">›</span>
            </button>
          ))}
          <button className="sair" onClick={() => setPasso("escolha")}>‹ Voltar</button>
        </div>
      )}

      {passo === "rostos" && (
        <div className="folha" style={{ paddingTop: 34 }}>
          <div className="tit">
            <h2>Toca no teu nome</h2>
            <span className="cap">{baseEscolhida ? nomeBase(baseEscolhida.nome) : ""}</span>
          </div>
          {erro && <p className="aviso" style={{ textAlign: "left", paddingTop: 0 }}>{erro}</p>}
          <div className="g">
            {pessoas.map((p, i) => (
              <button key={p.id} className="p" style={{ animationDelay: `${i * 20}ms` }} onClick={() => setAlvo(p)}>
                <span className="av" style={p.foto ? { backgroundImage: `url(${p.foto})` } : { background: corPara(p.nome) }}>
                  {p.foto ? "" : p.nome[0]}
                </span>
                <b>{p.nome}</b>
              </button>
            ))}
          </div>
          <button className="sair" onClick={() => setPasso("bases")}>‹ Outra base</button>
          {alvo && <SheetPinBase pessoa={alvo} nomeLider="líder da tua base" onFechar={() => setAlvo(null)} onDeveTrocarPin={() => {}} />}
        </div>
      )}

      {passo === "telemovel" && (
        <div className="folha" style={{ paddingTop: 34 }}>
          <span className="cap">Passo 1 de 3</span>
          <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.03em", margin: "10px 0 4px" }}>O teu telemóvel</h2>
          {erro && <p className="aviso" style={{ textAlign: "left", paddingTop: 0 }}>{erro}</p>}
          <label className="rot" htmlFor="tel">Número de telemóvel</label>
          <input
            id="tel" className="campo" type="tel" inputMode="numeric" autoComplete="tel"
            placeholder="912 345 678" value={telefone} onChange={(e) => setTelefone(e.target.value)}
          />
          <p className="ds" style={{ marginTop: 14 }}>
            Não mostramos listas de pessoas nesta entrada — quem não serve numa base identifica-se pelo
            número, e mais ninguém vê nomes nem fotos sem entrar.
          </p>
          <button className="btn full" onClick={continuarTelemovel}>Continuar</button>
          <button className="sair" onClick={() => setPasso("escolha")}>‹ Voltar</button>
        </div>
      )}

      {passo === "gd" && (
        <div className="folha" style={{ paddingTop: 34 }}>
          <span className="cap">Passo 2 de 3</span>
          <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.03em", margin: "10px 0 4px" }}>Em que GD estás?</h2>
          <p className="ds" style={{ marginBottom: 8 }}>
            Aparece por baixo do teu nome nos anúncios — é assim que as pessoas sabem quem tu és.
          </p>
          {gds.map((g) => (
            <button
              key={g.id} className="opcao"
              onClick={() => { setGdEscolhido(g.id); setPasso("nome"); }}
            >
              <span className="bola" style={{ background: corPara(g.nome) }}>{inicial(g.nome)}</span>
              <span>
                <span className="nmt" style={{ display: "block" }}>GD {g.nome}</span>
                <span className="ds" style={{ display: "block" }}>— {g.regiao}</span>
              </span>
              <span className="seta">›</span>
            </button>
          ))}
          <button className="opcao" onClick={() => { setGdEscolhido(null); setPasso("nome"); }}>
            <span className="bola" style={{ background: "var(--cinza)" }}>?</span>
            <span>
              <span className="nmt" style={{ display: "block" }}>Ainda não estou num GD</span>
              <span className="ds" style={{ display: "block" }}>Podes dizer mais tarde</span>
            </span>
            <span className="seta">›</span>
          </button>
          <button className="sair" onClick={() => setPasso("telemovel")}>‹ Voltar</button>
        </div>
      )}

      {passo === "nome" && (
        <div className="folha" style={{ paddingTop: 34 }}>
          <span className="cap">Passo 3 de 3</span>
          <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.03em", margin: "10px 0 4px" }}>Como te chamas?</h2>
          {erro && <p className="aviso" style={{ textAlign: "left", paddingTop: 0 }}>{erro}</p>}
          <label className="rot" htmlFor="nome">O teu nome</label>
          <input id="nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como apareces nos anúncios" />
          <button
            className="btn full"
            onClick={() => (nome.trim() ? (setErro(""), setPasso("pinNovo")) : setErro("Escreve o teu nome."))}
          >
            Continuar
          </button>
          <button className="sair" onClick={() => setPasso("gd")}>‹ Voltar</button>
        </div>
      )}

      {passo === "pinNovo" && (
        <PinNovo
          erro={erro}
          onCriar={async (pin) => {
            const r = await registarMural({ telefone: telefone.replace(/\D/g, ""), pin, nome: nome.trim(), gdId: gdEscolhido ?? null });
            if (!r.ok) setErro(r.mensagem || "Não foi possível criar a conta.");
            return r.ok;
          }}
          onVoltar={() => setPasso("nome")}
        />
      )}

      {passo === "pinExistente" && (
        <PinExistente
          digitos={digitosExistente}
          onEntrar={(pin) => entrarComPinMural(telefone.replace(/\D/g, ""), pin)}
          onVoltar={() => setPasso("telemovel")}
        />
      )}
    </div>
  );
}

function PinNovo({ onCriar, onVoltar, erro: erroExterno }) {
  const [cod, setCod] = useState("");
  const [erro, setErro] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  async function completar(codigo) {
    setAEnviar(true);
    const ok = await onCriar(codigo);
    if (!ok) {
      setCod("");
      setErro("Não foi possível criar a conta. Tenta outra vez.");
    }
    setAEnviar(false);
  }
  function tecla(n) {
    if (aEnviar) return;
    setErro("");
    const novo = cod + n;
    setCod(novo);
    if (novo.length === 4) setTimeout(() => completar(novo), 150);
  }

  return (
    <div className="folha" style={{ paddingTop: 34 }}>
      <span className="cap">Criar PIN</span>
      <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.03em", margin: "10px 0 4px" }}>Escolhe um PIN de 4 dígitos</h2>
      <p className="ds">É com ele que voltas a entrar. Fica só contigo.</p>
      <div className="pts">
        {Array.from({ length: 4 }).map((_, i) => <i key={i} className={i < cod.length ? "on" : ""} />)}
      </div>
      <p className="aviso">{erroExterno || erro || (aEnviar ? "A criar…" : "")}</p>
      <TecladoNumerico desativado={aEnviar} podeApagar={!!cod.length} onTecla={tecla} onApagar={() => setCod((c) => c.slice(0, -1))} />
      <button className="sair" onClick={onVoltar}>‹ Voltar</button>
    </div>
  );
}

function PinExistente({ digitos, onEntrar, onVoltar }) {
  const [cod, setCod] = useState("");
  const [erro, setErro] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [bloqueadoAte, setBloqueadoAte] = useState(null);

  async function completar(codigo) {
    setAEnviar(true);
    const r = await onEntrar(codigo);
    if (!r.ok) {
      setCod("");
      if (r.bloqueado) setBloqueadoAte(Date.now() + (r.faltamSegundos ?? 900) * 1000);
      else setErro(r.restam != null ? `Código errado. Restam ${r.restam} tentativa${r.restam === 1 ? "" : "s"}.` : "Código errado.");
    }
    setAEnviar(false);
  }
  function tecla(n) {
    if (aEnviar || bloqueadoAte) return;
    setErro("");
    const novo = cod + n;
    setCod(novo);
    if (novo.length === digitos) setTimeout(() => completar(novo), 150);
  }

  return (
    <div className="folha" style={{ paddingTop: 34 }}>
      <span className="cap">Entrar</span>
      <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.03em", margin: "10px 0 4px" }}>O teu PIN</h2>
      <div className="pts">
        {Array.from({ length: digitos }).map((_, i) => <i key={i} className={i < cod.length ? "on" : ""} />)}
      </div>
      <p className="aviso">{bloqueadoAte ? "Conta bloqueada por umas tentativas a mais. Tenta outra vez daqui a pouco." : erro || (aEnviar ? "A verificar…" : "")}</p>
      <TecladoNumerico desativado={aEnviar || !!bloqueadoAte} podeApagar={!!cod.length} onTecla={tecla} onApagar={() => setCod((c) => c.slice(0, -1))} />
      <button className="sair" onClick={onVoltar}>‹ Voltar</button>
    </div>
  );
}
