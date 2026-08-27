/**
 * Leitura do registo ao vivo da ordem do culto — igual em qualquer
 * base, todas só leem. Iniciar/descartar/editar/correspondência são
 * exclusivos da Base Técnica e ficam em
 * apps/tecnica/src/lib/cultoAoVivo.js, não aqui. sondarFreeshowAgora é
 * a exceção: não é "escrita" no sentido de decidir nada, é só pedir
 * à sonda para correr mais cedo — qualquer base pode pedir isso.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { db, chamar } from "./firebase.js";

export function ouvirCultoAoVivo(eventoId, cb) {
  return onSnapshot(doc(db, `eventos/${eventoId}/cultoAoVivo/registo`), (snap) => {
    cb(snap.exists() ? snap.data() : null);
  });
}

/** Para o ponto rosa do menu/separador: qual culto está mesmo a
 *  gravar agora, seja qual for a data — "Começou o culto" não olha
 *  para o dia (ver functions/index.js, config/cultoAoVivo). Ouve o
 *  ponteiro e, quando ele aponta para um evento, troca para ouvir o
 *  registo desse evento; `cb` recebe só o booleano "está a gravar". */
export function ouvirCultoAoVivoAtivo(cb) {
  let pararRegisto = null;
  const pararPonteiro = onSnapshot(doc(db, "config/cultoAoVivo"), (snap) => {
    const eventoId = snap.exists() ? snap.data().eventoIdAtivo : null;
    if (pararRegisto) { pararRegisto(); pararRegisto = null; }
    if (!eventoId) { cb(false); return; }
    pararRegisto = onSnapshot(doc(db, `eventos/${eventoId}/cultoAoVivo/registo`), (regSnap) => {
      cb(regSnap.exists() && regSnap.data().estado === "gravando");
    });
  });
  return () => { pararPonteiro(); if (pararRegisto) pararRegisto(); };
}

/** Pede à sonda para correr agora, em vez de esperar pelo próximo
 *  minuto do agendador — usar só enquanto a Ordem do culto estiver
 *  aberta no ecrã e o culto estiver mesmo "gravando" (sem gravação a
 *  decorrer, chamar isto não tem efeito nenhum, mas também não faz
 *  mal nenhum: é a mesma sonda que já corre sozinha). */
export const sondarFreeshowAgora = () =>
  chamar("sondarFreeshowAgora")({}).then((r) => r.data);
