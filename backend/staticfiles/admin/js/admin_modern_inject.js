/**
 * Script de injeção direta para modernizar o Django Admin
 * Funciona mesmo quando o admin_interface sobrescreve templates
 */

(function() {
    'use strict';
    
    // Aguarda o DOM estar pronto
    function waitForDOM(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }
    
    waitForDOM(function() {
        console.log('🎨 Injetando recursos modernos no Django Admin...');
        
        // Função para carregar CSS
        function injectCSS(href) {
            // Verifica se já existe
            var existing = document.querySelector('link[href*="' + href.split('/').pop() + '"]');
            if (existing) {
                console.log('CSS já existe:', href);
                return;
            }
            
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = href;
            link.media = 'all';
            document.head.appendChild(link);
            console.log('✓ CSS injetado:', href);
        }
        
        // Função para carregar JavaScript
        function injectJS(src, callback) {
            // Verifica se já existe
            var existing = document.querySelector('script[src*="' + src.split('/').pop() + '"]');
            if (existing) {
                console.log('JS já existe:', src);
                if (callback && typeof window.Accessibility !== 'undefined') {
                    callback();
                }
                return;
            }
            
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = src;
            if (callback) {
                script.onload = callback;
            }
            document.body.appendChild(script);
            console.log('✓ JS injetado:', src);
        }
        
        // Determina o caminho base dos arquivos estáticos
        var staticBase = '/static/admin/';
        
        // Tenta encontrar o caminho correto
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].src && scripts[i].src.includes('/static/admin/')) {
                staticBase = scripts[i].src.substring(0, scripts[i].src.indexOf('/static/admin/') + '/static/admin/'.length);
                break;
            }
        }
        
        // Injetar CSS
        injectCSS(staticBase + 'css/admin_modern.css?v=' + Date.now());
        injectCSS(staticBase + 'css/accessibility.css?v=' + Date.now());
        
        // Aguardar um pouco antes de injetar o JS para garantir que o DOM está totalmente pronto
        setTimeout(function() {
            injectJS(staticBase + 'js/accessibility.js?v=' + Date.now(), function() {
                console.log('✅ Todos os recursos modernos foram carregados!');
                console.log('Procure pelo botão ♿ no canto inferior direito.');
            });
        }, 500);
    });
})();

