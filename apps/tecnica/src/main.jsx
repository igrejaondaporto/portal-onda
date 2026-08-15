import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "@portal/shared/styles/global.css";
// Depois do global, sempre: é esta ordem que deixa a Técnica ajustar
// o visual sem tocar no partilhado. Ver o cabeçalho de tecnica.css.
import "./styles/tecnica.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
