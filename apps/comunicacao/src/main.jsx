import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "@portal/shared/styles/global.css";
// a camada visual só da Comunicação — ver o cabeçalho de comunicacao.css
import "./styles/comunicacao.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
