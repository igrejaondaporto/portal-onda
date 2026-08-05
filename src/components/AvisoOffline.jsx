import { useEffect, useState } from "react";

/** Aviso discreto no topo quando não há rede — as escritas no Firestore
 *  (checklist, etc.) continuam a resolver localmente e sincronizam
 *  sozinhas ao voltar; as Cloud Functions é que precisam mesmo de rede. */
export default function AvisoOffline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const ligar = () => setOnline(true);
    const desligar = () => setOnline(false);
    window.addEventListener("online", ligar);
    window.addEventListener("offline", desligar);
    return () => {
      window.removeEventListener("online", ligar);
      window.removeEventListener("offline", desligar);
    };
  }, []);

  if (online) return null;
  return (
    <div className="offline-aviso">Sem rede — as tuas marcações ficam guardadas e sincronizam sozinhas.</div>
  );
}
