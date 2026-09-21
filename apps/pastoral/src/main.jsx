import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { registarAtualizacaoAutomatica } from "@portal/shared/lib/pwa.js";
import "@portal/shared/styles/global.css";
// Depois do global, sempre: é esta ordem que deixa o Painel Pastoral
// ajustar o visual sem tocar no partilhado — e, por viver dentro desta
// app, nada daqui entra no bundle de outra base. Ver o cabeçalho de
// pastoral.css.
import "./styles/pastoral.css";

registarAtualizacaoAutomatica();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
