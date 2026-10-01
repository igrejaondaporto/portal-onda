import { useEffect, useMemo, useState } from "react";
import { chamar } from "@portal/shared/lib/firebase.js";
import { basesGuardadas, dadosEntradaBase, listarBasesMural, pessoasGuardadas } from "../lib/auth.js";
import { nomeBase } from "../lib/util.js";
import MiniAvatar from "./MiniAvatar.jsx";

export const MEMBROS = "__membros__";
export const SEM_REGISTO = "__sem_registo__";

/**
 * "Publicar em nome de outra pessoa" — escolher QUEM (2026-10, pedido:
 * "coloca a lista das bases e o nome dela para eu escolher, e o anúncio
 * já vai para o perfil dela"). Primeiro onde está a pessoa (uma base,
 * "Membros" = registados só no Mural, ou "Não está registada"), depois o
 * nome, com busca. Os voluntários vêm do mesmo `dadosEntrada` (e da mesma
 * cache) da Entrada; os membros de `listarMembrosMural`, só da moderação.
 *
 * Quem está registado: o anúncio nasce no perfil dela (functions/mural.js,
 * criarAnuncio com `pessoaId`). Quem não está: nome + telemóvel, e o
 * anúncio passa para o perfil dela quando se registar com esse número.
 */
export default function EscolherPessoaEmNome({ onde, setOnde, pessoa, setPessoa, nome, setNome, telefone, setTelefone }) {
  const [bases, setBases] = useState(() => basesGuardadas() || []);
  const [lista, setLista] = useState(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    listarBasesMural().then(setBases).catch(() => {});
  }, []);

  useEffect(() => {
    setBusca("");
    setErro("");
    if (!onde || onde === SEM_REGISTO) return setLista(null);
    let vivo = true;
    if (onde === MEMBROS) {
      setLista(null);
      chamar("listarMembrosMural")()
        .then(({ data }) => vivo && setLista(data.membros.map((m) => ({ ...m, sub: [m.local, m.fimTelefone && `…${m.fimTelefone}`].filter(Boolean).join(" · ") }))))
        .catch(() => vivo && (setLista([]), setErro("Não deu para carregar os membros.")));
    } else {
      const deBase = (ps) => (ps || []).map((p) => ({ id: p.id, nome: p.nome, foto: p.foto ?? null }));
      setLista(pessoasGuardadas(onde) ? deBase(pessoasGuardadas(onde)) : null);
      dadosEntradaBase(onde)
        .then((d) => vivo && setLista(deBase(d.pessoas)))
        .catch(() => vivo && setErro("Não deu para carregar as pessoas desta base."));
    }
    return () => { vivo = false; };
  }, [onde]);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt");
    return (lista || []).filter((p) => !q || p.nome.toLocaleLowerCase("pt").includes(q));
  }, [lista, busca]);

  function escolherOnde(id) {
    setOnde(id);
    setPessoa(null);
  }

  if (pessoa) {
    return (
      <div className="emNomeEscolhida">
        <MiniAvatar nome={pessoa.nome} foto={pessoa.foto} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>{pessoa.nome}</b>
          <small>{pessoa.ondeNome} — o anúncio fica no perfil dela, com o WhatsApp dela</small>
        </span>
        <button type="button" className="sair" onClick={() => setPessoa(null)}>Trocar</button>
      </div>
    );
  }

  return (
    <>
      <span className="rot">Onde está a pessoa?</span>
      <div className="menu quebra" style={{ padding: "6px 0 2px", position: "static" }}>
        {bases.map((b) => (
          <button key={b.id} type="button" data-on={onde === b.id ? 1 : 0} onClick={() => escolherOnde(b.id)}>{nomeBase(b.nome)}</button>
        ))}
        <button type="button" data-on={onde === MEMBROS ? 1 : 0} onClick={() => escolherOnde(MEMBROS)}>Membros</button>
        <button type="button" data-on={onde === SEM_REGISTO ? 1 : 0} onClick={() => escolherOnde(SEM_REGISTO)}>Não está registada</button>
      </div>

      {onde && onde !== SEM_REGISTO && (
        <>
          <input className="campo" style={{ marginTop: 8 }} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar o nome…" aria-label="Procurar o nome" />
          <div className="emNomeLista" role="list">
            {lista === null && !erro && <p className="ds">A carregar…</p>}
            {erro && <p className="aviso">{erro}</p>}
            {lista && filtrada.length === 0 && !erro && <p className="ds">Ninguém com esse nome aqui.</p>}
            {filtrada.map((p) => (
              <button
                key={p.id} type="button" role="listitem"
                onClick={() => setPessoa({ id: p.id, nome: p.nome, foto: p.foto ?? null, ondeNome: onde === MEMBROS ? (p.local || "Membro") : nomeBase(bases.find((b) => b.id === onde)?.nome || "") })}
              >
                <MiniAvatar nome={p.nome} foto={p.foto} />
                <span>{p.nome}{p.sub && <small> {p.sub}</small>}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {onde === SEM_REGISTO && (
        <>
          <p className="ds" style={{ marginTop: 6 }}>
            Sai com este nome e o WhatsApp dela. Fica nos teus "Os meus" até ela se registar no Mural com este
            número — aí passa sozinho para o perfil dela. Se o número já tiver conta, vai logo para lá.
          </p>
          <label className="rot" htmlFor="emNomeNome">Nome da pessoa</label>
          <input id="emNomeNome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder="Como aparece no anúncio" />
          <label className="rot" htmlFor="emNomeTelefone">Telemóvel dela</label>
          <input id="emNomeTelefone" className="campo" type="tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="912 345 678" />
        </>
      )}
    </>
  );
}
