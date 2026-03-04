import React from "react";
import ReactDOM from "react-dom/client";
import { AccessibilityProvider } from "./contexts/AccessibilityContext";
import { AccessibilityPanel } from "./components/AccessibilityPanel";
import { TooltipProvider } from "./components/ui/tooltip";

// Este é o ponto de entrada para injetar o painel de acessibilidade no Django Admin.

const rootElement = document.getElementById("django-admin-accessibility-root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AccessibilityProvider>
        <TooltipProvider>
          <AccessibilityPanel />
        </TooltipProvider>
      </AccessibilityProvider>
    </React.StrictMode>
  );
}
