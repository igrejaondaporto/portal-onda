import Avatar from "./Avatar";
import { linkWhatsApp } from "../lib/data";

/** Linha de pessoa que expande ao tocar — mostra as funções dela no
 *  culto e um botão de WhatsApp, se tiver telefone. Reaproveitado no
 *  "Servem contigo" do Início e na lista de escalados da Escala. */
export default function LinhaPessoaContacto({ pessoa, resumo, tagExtra, funcoesDaPessoa, aberta, onToggle }) {
  const link = linkWhatsApp(pessoa.telefone);
  return (
    <div className="linha" style={{ alignItems: "flex-start", cursor: "pointer" }} onClick={onToggle}>
      <Avatar pessoa={pessoa} />
      <div style={{ flex: 1 }}>
        <p className="nmt">{pessoa.nome}</p>
        <p className="ds">{resumo}</p>
        {aberta && (
          <div className="aberto" onClick={(e) => e.stopPropagation()}>
            <p>
              {funcoesDaPessoa?.length
                ? funcoesDaPessoa.map((f) => f.nome).join(", ")
                : "Sem funções atribuídas neste culto."}
            </p>
            {link ? (
              <a
                className="btn sec full" style={{ marginTop: 12 }}
                href={link} target="_blank" rel="noopener"
              >
                Falar no WhatsApp
              </a>
            ) : (
              <p className="ds" style={{ marginTop: 10 }}>Sem contacto no perfil.</p>
            )}
          </div>
        )}
      </div>
      {tagExtra}
      <span className="seta">{aberta ? "⌃" : "⌄"}</span>
    </div>
  );
}
