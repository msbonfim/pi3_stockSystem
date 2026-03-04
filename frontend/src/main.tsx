import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App"; // Correção 1: Importação padrão
import { registerSW } from "virtual:pwa-register";
import "./index.css"; // Estilos globais do Tailwind

// Flag para garantir que registerSW só seja chamado uma vez
let swRegistered = false;

// Registra o Service Worker apenas em modo de produção.
if (import.meta.env.PROD && !swRegistered) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Não recarregar automaticamente - apenas notificar
      console.log('🔄 Nova versão disponível. Atualize a página quando quiser.');
    },
    onOfflineReady() {
      console.log('✅ App pronto para uso offline.');
    },
    onRegistered(registration) {
      console.log('✅ Service Worker registrado:', registration);
    },
    onRegisterError(error) {
      console.error('❌ Erro ao registrar Service Worker:', error);
    },
  });
  swRegistered = true;
  console.log("✅ Service Worker registrado (Modo de Produção).");
} else if (!import.meta.env.PROD) {
  console.warn("⚠️ Service Worker não registrado (Modo de Desenvolvimento).");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />
  // React.StrictMode desabilitado temporariamente para evitar dupla renderização
  // que pode causar múltiplas inicializações
);
