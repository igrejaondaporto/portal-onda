import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { registarAtualizacaoAutomatica } from "@portal/shared/lib/pwa.js";
import "@portal/shared/styles/global.css";
import "./styles/louvorkinder.css";

registarAtualizacaoAutomatica();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
