import { useEffect, useState } from "react";
import { listarBasesParaLigar, listarPessoasDaBase } from "../lib/pessoasGlobais.js";
import { useTorrada } from "../lib/TorradaContext";
import Avatar from "./Avatar";

/**
 * Ligar uma pessoa que já é voluntária noutra base, em vez de criar
 * identidade duplicada. Dois passos: escolher a base, depois escolher
 * a pessoa dessa base. `onEscolhida({ pessoaExistenteId, nome, foto })`
 * devolve o suficiente para pré-preencher o formulário de "Novo
 * voluntário" — o resto (telefone, papel, ministérios) é sempre desta
 * base, preenchido de novo por quem está a ligar.
 */
export default function SheetLigarPessoa({ onFechar, onEscolhida }) {
  const torrada = useTorrada();
  const [bases, setBases] = useState(null);
  const [baseEscolhida, setBaseEscolhida] = useState(null);
  const [pessoas, setPessoas] = useState(null);
  const [aCarregar, setACarregar] = useState(false);

  useEffect(() => {
    listarBasesParaLigar()
      .then(setBases)
      .catch((e) => { torrada(e.message || "Não foi possível carregar as bases."); onFechar(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function escolherBase(base) {
    setBaseEscolhida(base);
    setACarregar(true);
    try {
      setPessoas(await listarPessoasDaBase(base.id));
    } catch (e) {
      torrada(e.message || "Não foi possível carregar as pessoas dessa base.");
      setBaseEscolhida(null);
    } finally {
      setACarregar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        {!baseEscolhida ? (
          <>
            <h2>Já tem perfil noutra base?</h2>
            <p className="sb2">Em qual base é que esta pessoa já é voluntária?</p>
            {bases === null && <p className="ds" style={{ marginTop: 14 }}>A carregar…</p>}
            {bases?.length === 0 && <p className="ds" style={{ marginTop: 14 }}>Não há mais nenhuma base ainda.</p>}
            {bases?.map((b) => (
              <div className="linha" style={{ cursor: "pointer" }} key={b.id} onClick={() => escolherBase(b)}>
                <div style={{ flex: 1 }}><p className="nmt">{b.nome}</p></div>
                <span className="seta">›</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <h2>{baseEscolhida.nome}</h2>
            <p className="sb2">Qual destas pessoas é?</p>
            {aCarregar && <p className="ds" style={{ marginTop: 14 }}>A carregar…</p>}
            {pessoas?.length === 0 && <p className="ds" style={{ marginTop: 14 }}>Não há voluntários ativos nessa base.</p>}
            {pessoas?.map((p) => (
              <div
                className="linha" style={{ cursor: "pointer" }} key={p.pessoaId}
                onClick={() => onEscolhida({ pessoaExistenteId: p.pessoaId, nome: p.nome, foto: p.foto, telefone: p.telefone })}
              >
                <Avatar pessoa={p} tamanho={38} />
                <div style={{ flex: 1 }}><p className="nmt">{p.nome}</p></div>
                <span className="seta">›</span>
              </div>
            ))}
            <button className="btn sec full" style={{ marginTop: 14 }} onClick={() => { setBaseEscolhida(null); setPessoas(null); }}>
              Voltar às bases
            </button>
          </>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
