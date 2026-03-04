/// <reference types="vite-plugin-pwa/client" />

import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { pushNotificationService } from "./services/pushNotifications";
import { AccessibilityProvider } from "./contexts/AccessibilityContext";
import { AccessibilityPanel } from "./components/AccessibilityPanel";

const queryClient = new QueryClient();

const App = () => {
  // Inicializa push notifications quando o app carrega
  useEffect(() => {
    // Aguarda um pouco para garantir que o DOM está pronto
    const timer = setTimeout(() => {
      pushNotificationService
        .initialize()
        .then((success) => {
          if (success) {
            console.log("✅ Push notifications inicializadas com sucesso!");
          } else {
            // Não mostrar warning se foi apenas porque a chave VAPID não está configurada
            // Isso é normal em desenvolvimento ou quando push notifications não são necessárias
            const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            if (!vapidKey || vapidKey.trim() === '') {
              console.log("ℹ️ Push notifications desabilitadas (chave VAPID não configurada)");
            } else {
              console.warn(
                "⚠️ Push notifications não foram inicializadas (navegador não suporta ou permissão negada)"
              );
            }
          }
        })
        .catch((error) => {
          console.error("❌ Erro ao inicializar push notifications:", error);
          // Não re-throw para evitar quebrar o app
        });
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Tecla de atalho para acessibilidade (Alt+A)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        // O panel se abre automaticamente quando clicado no botão
        const button = document.querySelector(
          '[aria-label="Abrir configurações de acessibilidade"]'
        ) as HTMLElement;
        if (button) {
          button.click();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  return (
    <AccessibilityProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          <AccessibilityPanel />
        </TooltipProvider>
      </QueryClientProvider>
    </AccessibilityProvider>
  );
};

export default App;
