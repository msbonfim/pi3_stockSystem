/**
 * Injeta o painel de acessibilidade do React (servido pelo Vite) no Django Admin.
 * Este script é para o ambiente de DESENVOLVIMENTO.
 */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    // URL do servidor de desenvolvimento do Vite.
    // O padrão é 5173. Se o seu for diferente (ex: 3000), ajuste aqui.
    const VITE_DEV_SERVER = "http://localhost:5173";

    // 1. Cria o elemento root onde o React será montado.
    if (!document.getElementById("django-admin-accessibility-root")) {
      const rootDiv = document.createElement("div");
      rootDiv.id = "django-admin-accessibility-root";
      document.body.appendChild(rootDiv);
    }

    // Função para carregar um arquivo CSS
    function loadCSS(href) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
      return link;
    }

    // Função para carregar um script como módulo
    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.type = "module";
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    async function injectVite() {
      try {
        // 1. Carrega o CSS principal do nosso aplicativo React.
        loadCSS(`${VITE_DEV_SERVER}/src/index.css`);

        // 2. Injeta o CÓDIGO do preamble do React Fast Refresh.
        // Este é o passo crucial que estava faltando. Ele cria o window.$RefreshReg$.
        const preambleScript = document.createElement("script");
        preambleScript.type = "module";
        preambleScript.innerHTML = `
          import { injectIntoGlobalHook } from "${VITE_DEV_SERVER}/@react-refresh";
          injectIntoGlobalHook(window);
          window.$RefreshReg$ = () => {};
          window.$RefreshSig$ = () => (type) => type;
        `;
        document.head.appendChild(preambleScript);

        // Aguarda um ciclo para garantir que o preamble foi processado.
        await new Promise((resolve) => setTimeout(resolve, 0));

        // 3. Carrega o cliente do Vite para habilitar o Hot Module Replacement (HMR).
        await loadScript(`${VITE_DEV_SERVER}/@vite/client`);

        // 4. Finalmente, carrega o nosso código da aplicação.
        await loadScript(`${VITE_DEV_SERVER}/src/admin-injector.tsx`);

        console.log("✅ Painel de Acessibilidade injetado com sucesso!");
      } catch (error) {
        console.error("❌ Falha ao injetar scripts do Vite:", error);
      }
    }

    injectVite();
  });
})();
