// src/hooks/usePWAInstall.ts

import { useState, useEffect } from 'react';

// Interface para o evento de instalação
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePWAInstall = () => {
  // Estado para guardar o "convite" de instalação do navegador
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      // Previne que o navegador mostre o pop-up padrão
      event.preventDefault();
      // Guarda o evento para usarmos com nosso próprio botão
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Limpa o listener quando o componente é desmontado
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      return;
    }

    // Mostra a caixa de diálogo de instalação nativa
    await installPrompt.prompt();

    // Aguarda a escolha do usuário (aceitou ou dispensou)
    await installPrompt.userChoice;

    // Limpa o convite, pois ele só pode ser usado uma vez
    setInstallPrompt(null);
  };

  return {
    // Um booleano que nos diz se podemos ou não mostrar o botão de instalação
    canInstall: !!installPrompt,
    // A função que será chamada pelo clique do nosso botão
    handleInstallClick,
  };
};