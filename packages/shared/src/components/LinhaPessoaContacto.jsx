import Avatar from "./Avatar";
import { linkWhatsApp } from "../lib/data";

/** Linha de pessoa que expande ao tocar — mostra as funções dela no
 *  culto e um botão de WhatsApp, se tiver telefone. Reaproveitado no
 *  "Servem contigo" do Início e na lista de escalados da Escala. */
export default function LinhaPessoaContacto({ pessoa, resumo, corMinisterio, tagExtra, funcoesDaPessoa, aberta, onToggle }) {
  const link = linkWhatsApp(pessoa.telefone);
  return (
    <div className="linha" style={{ alignItems: "flex-start", cursor: "pointer" }} onClick={onToggle}>
      <Avatar pessoa={pessoa} />
      <div style={{ flex: 1 }}>
        <p className="nmt">{pessoa.nome}</p>
        <p className="ds">
          {corMinisterio && <span className="quadmin" style={{ background: corMinisterio }} />}
          {resumo}
        </p>
        {aberta && (
          <div className="aberto" onClick={(e) => e.stopPropagation()} style={{ paddingTop: 12 }}>
            {link ? (
              <a className="btn sec full" href={link} target="_blank" rel="noopener">
                Chamar no WhatsApp
              </a>
            ) : (
              <p className="ds">Sem contacto no perfil.</p>
            )}
            {funcoesDaPessoa?.length > 0 && (
              <p style={{ marginTop: 10 }}>{funcoesDaPessoa.map((f) => f.nome).join(", ")}</p>
            )}
          </div>
        )}
      </div>
      {tagExtra}
      <span className="seta">{aberta ? "⌃" : "⌄"}</span>
    </div>
  );
}
