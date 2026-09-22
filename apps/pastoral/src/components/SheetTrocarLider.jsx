import { useEffect, useState } from "react";
import { definirLiderBase, pessoasPastoral } from "../lib/pastoral";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";

/**
 * Trocar o líder de uma base — pedido 2026-09 ("um menu onde o pastor
 * possa alterar os líderes de cada base"). Decisão nova do dono do
 * produto: até aqui só o próprio líder trocava (dentro da própria app
 * dele); esta é a primeira escrita do painel numa base que não é a
 * própria (ver `definirLiderBase`, functions/pastoral.js).
 *
 * A lista de pessoas vem de `pessoasPastoral()`, a mesma chamada que
 * a aba Pessoas já usa — pedida aqui só quando este sheet abre (não
 * na Bases inteira), para não pagar a leitura de ~150 pessoas em
 * quem só veio ver pendências.
 */
export default function SheetTrocarLider({ base, onFechar, onTrocado }) {
  const torrada = useTorrada();
  const [pessoas, setPessoas] = useState(null);
  const [erro, setErro] = useState(null);
  const [aTrocar, setATrocar] = useState(null); // id da pessoa a caminho de virar líder

  useEffect(() => {
    let vivo = true;
    pessoasPastoral()
      .then((d) => { if (vivo) setPessoas(d.pessoas); })
      .catch((e) => { if (vivo) setErro(e.message || "Não foi possível carregar a equipa."); });
    return () => { vivo = false; };
  }, []);

  const equipa = (pessoas ?? [])
    .filter((p) => p.bases.some((b) => b.baseId === base.baseId && b.ativo))
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt"));

  async function trocar(pessoaId, nome) {
    setATrocar(pessoaId);
    try {
      await definirLiderBase(base.baseId, pessoaId);
      torrada(`${nome} é agora líder da ${base.nome}`);
      onTrocado?.();
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível trocar.");
      setATrocar(null);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Líder da {base.nome}</h2>
        <p className="ds" style={{ marginTop: 6 }}>
          Toca em quem deve passar a ser o líder — quem já é fica demovido a voluntário automaticamente.
        </p>

        {erro && <p className="ds" style={{ marginTop: 14, color: "var(--magenta)" }}>{erro}</p>}
        {!pessoas && !erro && <div className="vaz" style={{ marginTop: 14 }}>A carregar a equipa…</div>}

        {pessoas && (
          equipa.length ? equipa.map((p) => {
            const jaELider = p.bases.some((b) => b.baseId === base.baseId && b.papel === "lider_base");
            return (
              <button
                key={p.id}
                className="linha"
                style={{ width: "100%", textAlign: "left", background: "none", border: 0, padding: "12px 0", cursor: jaELider ? "default" : "pointer" }}
                disabled={jaELider || aTrocar === p.id}
                onClick={() => trocar(p.id, p.nome)}
              >
                <Avatar pessoa={p} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="nmt">{p.nome}</p>
                  {jaELider && <p className="ds">Já é o líder</p>}
                </div>
                {aTrocar === p.id && <span className="ds">A trocar…</span>}
              </button>
            );
          }) : <div className="vaz">Ninguém ativo nesta base.</div>
        )}

        <button className="btn sec full" style={{ marginTop: 18 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
