import React, { useState } from "react";
import { Accessibility } from "lucide-react";
import { useAccessibility } from "@/contexts/AccessibilityContext";

export const AccessibilityMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    settings, // O estado atual das configurações
    setFontSize, // Função para mudar o tamanho da fonte
    setHighContrast, // Função para ativar/desativar alto contraste
    setHighlightLinks, // Função para destacar links
  } = useAccessibility();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Botão flutuante */}
      <button
        className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        aria-label="Abrir menu de acessibilidade"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Accessibility className="h-6 w-6" />
      </button>

      {/* Painel do Menu */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-100">
            Acessibilidade
          </h3>

          <div className="space-y-3">
            {/* Tamanho da Fonte */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tamanho da Fonte
              </label>
              <select
                value={settings.fontSize}
                onChange={(e) =>
                  setFontSize(e.target.value as "normal" | "large" | "xlarge")
                }
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="normal">Normal</option>
                <option value="large">Grande</option>
                <option value="xlarge">Extra Grande</option>
              </select>
            </div>

            {/* Opções de Toggle */}
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.highContrast} // Usa o estado do contexto
                  onChange={(e) => setHighContrast(e.target.checked)} // Passa o novo valor booleano
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Alto Contraste
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.highlightLinks} // Usa o estado do contexto
                  onChange={(e) => setHighlightLinks(e.target.checked)} // Passa o novo valor booleano
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Destacar Links
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
