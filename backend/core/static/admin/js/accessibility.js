/**
 * Django Admin Accessibility Enhancement
 * Provides comprehensive accessibility features
 */

(function() {
  'use strict';

  // State management
  const AccessibilityState = {
    fontSize: localStorage.getItem('admin-font-size') || 'normal',
    highContrast: localStorage.getItem('admin-high-contrast') === 'true',
    largeButtons: localStorage.getItem('admin-large-buttons') === 'true',
    simplifiedView: localStorage.getItem('admin-simplified-view') === 'true',
    darkTheme: localStorage.getItem('admin-dark-theme') === 'true',
    panelVisible: false
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    createAccessibilityPanel();
    createToggleButton();
    applySettings();
    setupKeyboardShortcuts();
    // Skip link removido conforme solicitado
  }

  function createAccessibilityPanel() {
    if (document.getElementById('accessibility-panel')) {
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'accessibility-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'accessibility-panel-title');
    panel.setAttribute('aria-hidden', 'true');
      panel.innerHTML = `
      <div class="panel-header-wrapper">
        <h3 id="accessibility-panel-title">
          <span class="panel-icon">♿</span>
          Configurações de Acessibilidade
        </h3>
        <button type="button" class="panel-close-btn" onclick="Accessibility.togglePanel()" aria-label="Fechar painel">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <p class="panel-description">
        Personalize a interface para melhorar sua experiência. As configurações são salvas automaticamente.
      </p>
      <div class="panel-content">
        <!-- Seção Tamanho da Fonte -->
        <div class="accessibility-section">
          <div class="section-icon">T<span class="icon-small">T</span></div>
          <div class="section-content">
            <h4 class="section-title">Tamanho da Fonte</h4>
            <p class="section-description">Aumente o tamanho do texto para facilitar a leitura</p>
            <div class="font-size-buttons">
              <button type="button" id="font-normal" onclick="Accessibility.setFontSize('normal')" aria-pressed="${AccessibilityState.fontSize === 'normal'}" ${AccessibilityState.fontSize === 'normal' ? 'class="active"' : ''}>
                Normal
              </button>
              <button type="button" id="font-large" onclick="Accessibility.setFontSize('large')" aria-pressed="${AccessibilityState.fontSize === 'large'}" ${AccessibilityState.fontSize === 'large' ? 'class="active"' : ''}>
                Grande
              </button>
              <button type="button" id="font-xlarge" onclick="Accessibility.setFontSize('xlarge')" aria-pressed="${AccessibilityState.fontSize === 'xlarge'}" ${AccessibilityState.fontSize === 'xlarge' ? 'class="active"' : ''}>
                Extra Grande
              </button>
              <button type="button" id="font-xxlarge" onclick="Accessibility.setFontSize('xxlarge')" aria-pressed="${AccessibilityState.fontSize === 'xxlarge'}" ${AccessibilityState.fontSize === 'xxlarge' ? 'class="active"' : ''}>
                Muito Grande
              </button>
            </div>
          </div>
        </div>
        
        <!-- Seção Alto Contraste -->
        <div class="accessibility-section">
          <div class="section-icon">○</div>
          <div class="section-content">
            <h4 class="section-title">Alto Contraste</h4>
            <p class="section-description">Aumenta o contraste entre texto e fundo para melhor visibilidade</p>
            <label class="toggle-switch">
              <input type="checkbox" id="high-contrast" onchange="Accessibility.toggleHighContrast(this.checked)" ${AccessibilityState.highContrast ? 'checked' : ''}>
              <span class="toggle-slider"></span>
              <span class="toggle-label">Ativar modo de alto contraste</span>
            </label>
          </div>
        </div>
        
        <!-- Seção Botões Grandes -->
        <div class="accessibility-section">
          <div class="section-icon">★</div>
          <div class="section-content">
            <h4 class="section-title">Botões Grandes</h4>
            <p class="section-description">Aumenta o tamanho dos botões para facilitar o clique</p>
            <label class="toggle-switch">
              <input type="checkbox" id="large-buttons" onchange="Accessibility.toggleLargeButtons(this.checked)" ${AccessibilityState.largeButtons ? 'checked' : ''}>
              <span class="toggle-slider"></span>
              <span class="toggle-label">Usar botões maiores</span>
            </label>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
  }

  function createToggleButton() {
    if (document.getElementById('accessibility-toggle')) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'accessibility-toggle';
    button.setAttribute('aria-label', 'Abrir configurações de acessibilidade');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('title', 'Acessibilidade (Alt+A)');
    button.innerHTML = '♿';
    button.style.cssText = 'position:fixed!important;bottom:20px!important;right:20px!important;width:60px!important;height:60px!important;background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%)!important;color:#ffffff!important;border:none!important;border-radius:50%!important;font-size:24px!important;cursor:pointer!important;box-shadow:0 4px 12px rgba(37,99,235,0.4)!important;z-index:9998!important;transition:all 0.3s!important;display:flex!important;align-items:center!important;justify-content:center!important;';
    button.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      // Aguarda um momento para garantir que Accessibility está disponível
      setTimeout(function() {
        if (typeof window.Accessibility !== 'undefined' && window.Accessibility.togglePanel) {
          window.Accessibility.togglePanel();
        } else if (typeof Accessibility !== 'undefined' && Accessibility.togglePanel) {
          Accessibility.togglePanel();
        } else {
          console.error('Accessibility.togglePanel não está disponível');
          // Tenta criar o painel diretamente se necessário
          const panel = document.getElementById('accessibility-panel');
          if (panel) {
            const isVisible = panel.style.display !== 'none' && panel.style.display !== '';
            panel.style.display = isVisible ? 'none' : 'flex';
            panel.setAttribute('aria-hidden', isVisible ? 'true' : 'false');
          }
        }
      }, 10);
    };

    document.body.appendChild(button);
    console.log('✓ Botão de acessibilidade criado');
  }

  function addSkipLink() {
    if (document.getElementById('skip-link')) {
      return;
    }

    const skipLink = document.createElement('a');
    skipLink.id = 'skip-link';
    skipLink.href = '#content';
    skipLink.className = 'skip-link';
    skipLink.textContent = 'Pular para o conteúdo principal';
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  function applySettings() {
    const body = document.body;
    console.log('⚙️ applySettings chamado. fontSize:', AccessibilityState.fontSize);
    
    // Remove all accessibility classes
    body.classList.remove(
      'admin-accessibility-large',
      'admin-accessibility-xlarge',
      'admin-accessibility-xxlarge',
      'admin-accessibility-high-contrast',
      'admin-accessibility-large-buttons',
      'admin-accessibility-simplified',
      'admin-accessibility-dark-theme',
      'admin-accessibility-enabled'
    );

    // Apply font size
    if (AccessibilityState.fontSize !== 'normal') {
      const fontSizeClass = `admin-accessibility-${AccessibilityState.fontSize}`;
      console.log('➕ Adicionando classe de fonte:', fontSizeClass);
      body.classList.add(fontSizeClass);
      
      // Mapeia tamanhos para valores em rem
      const fontSizeMap = {
        'large': '1.125rem',
        'xlarge': '1.25rem',
        'xxlarge': '1.5rem'
      };
      
      const fontSize = fontSizeMap[AccessibilityState.fontSize];
      if (fontSize) {
        // Injeta estilo inline diretamente no body para garantir
        body.style.setProperty('font-size', fontSize, 'important');
        
        // Aplica em todos os elementos filhos via CSS inline injetado
        let styleElement = document.getElementById('accessibility-font-size-style');
        if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = 'accessibility-font-size-style';
          document.head.appendChild(styleElement);
        }
        
        styleElement.textContent = `
          body.admin-accessibility-${AccessibilityState.fontSize} *,
          body.admin-accessibility-${AccessibilityState.fontSize} *::before,
          body.admin-accessibility-${AccessibilityState.fontSize} *::after,
          body.admin-accessibility-${AccessibilityState.fontSize} p,
          body.admin-accessibility-${AccessibilityState.fontSize} span,
          body.admin-accessibility-${AccessibilityState.fontSize} a,
          body.admin-accessibility-${AccessibilityState.fontSize} li,
          body.admin-accessibility-${AccessibilityState.fontSize} td,
          body.admin-accessibility-${AccessibilityState.fontSize} th,
          body.admin-accessibility-${AccessibilityState.fontSize} label,
          body.admin-accessibility-${AccessibilityState.fontSize} div,
          body.admin-accessibility-${AccessibilityState.fontSize} h1,
          body.admin-accessibility-${AccessibilityState.fontSize} h2,
          body.admin-accessibility-${AccessibilityState.fontSize} h3,
          body.admin-accessibility-${AccessibilityState.fontSize} h4,
          body.admin-accessibility-${AccessibilityState.fontSize} h5,
          body.admin-accessibility-${AccessibilityState.fontSize} h6,
          body.admin-accessibility-${AccessibilityState.fontSize} button,
          body.admin-accessibility-${AccessibilityState.fontSize} input,
          body.admin-accessibility-${AccessibilityState.fontSize} select,
          body.admin-accessibility-${AccessibilityState.fontSize} textarea,
          body.admin-accessibility-${AccessibilityState.fontSize} #header,
          body.admin-accessibility-${AccessibilityState.fontSize} #header *,
          body.admin-accessibility-${AccessibilityState.fontSize} .module,
          body.admin-accessibility-${AccessibilityState.fontSize} .module *,
          body.admin-accessibility-${AccessibilityState.fontSize} #content,
          body.admin-accessibility-${AccessibilityState.fontSize} #content *,
          body.admin-accessibility-${AccessibilityState.fontSize} #content-main,
          body.admin-accessibility-${AccessibilityState.fontSize} #content-main *,
          body.admin-accessibility-${AccessibilityState.fontSize} #result_list,
          body.admin-accessibility-${AccessibilityState.fontSize} #result_list *,
          body.admin-accessibility-${AccessibilityState.fontSize} #user-tools,
          body.admin-accessibility-${AccessibilityState.fontSize} #user-tools * {
            font-size: ${fontSize} !important;
          }
        `;
        console.log('✅ Estilo inline injetado com font-size:', fontSize);
        
        // Aplica diretamente nos elementos para garantir
        setTimeout(function() {
          const allElements = document.querySelectorAll('body *');
          let appliedCount = 0;
          allElements.forEach(function(el) {
            // Ignora o próprio painel de acessibilidade
            if (el.id === 'accessibility-panel' || el.id === 'accessibility-toggle' || el.closest('#accessibility-panel')) {
              return;
            }
            const currentSize = window.getComputedStyle(el).fontSize;
            if (el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.tagName !== 'NOSCRIPT') {
              el.style.setProperty('font-size', fontSize, 'important');
              appliedCount++;
            }
          });
          console.log('✅ Font-size aplicado diretamente em', appliedCount, 'elementos');
        }, 50);
      }
    } else {
      console.log('➖ Removendo classes de fonte (normal)');
      body.style.removeProperty('font-size');
      const styleElement = document.getElementById('accessibility-font-size-style');
      if (styleElement) {
        styleElement.remove();
      }
      // Remove font-size inline de todos os elementos
      setTimeout(function() {
        const allElements = document.querySelectorAll('body *');
        let removedCount = 0;
        allElements.forEach(function(el) {
          // Ignora o próprio painel de acessibilidade
          if (el.id === 'accessibility-panel' || el.id === 'accessibility-toggle' || el.closest('#accessibility-panel')) {
            return;
          }
          if (el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.tagName !== 'NOSCRIPT') {
            if (el.style.fontSize) {
              el.style.removeProperty('font-size');
              removedCount++;
            }
          }
        });
        console.log('✅ Font-size removido de', removedCount, 'elementos');
      }, 50);
    }

    // Apply other settings
    if (AccessibilityState.highContrast) {
      body.classList.add('admin-accessibility-high-contrast');
    }

    if (AccessibilityState.largeButtons) {
      body.classList.add('admin-accessibility-large-buttons');
    }

    if (AccessibilityState.simplifiedView) {
      body.classList.add('admin-accessibility-simplified');
    }

    if (AccessibilityState.darkTheme) {
      body.classList.add('admin-accessibility-dark-theme');
    }

    // Always add enabled class
    body.classList.add('admin-accessibility-enabled');

    // Update UI elements
    updateFontSizeButtons();
    updateCheckboxes();
    
    // Log final
    console.log('✅ Classes aplicadas:', body.className);
  }

  function updateFontSizeButtons() {
    ['normal', 'large', 'xlarge', 'xxlarge'].forEach(size => {
      const btn = document.getElementById(`font-${size}`);
      if (btn) {
        const isActive = AccessibilityState.fontSize === size;
        if (isActive) {
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      }
    });
  }

  function updateCheckboxes() {
    const checkboxes = {
      'high-contrast': AccessibilityState.highContrast,
      'large-buttons': AccessibilityState.largeButtons,
      'simplified-view': AccessibilityState.simplifiedView,
      'dark-theme': AccessibilityState.darkTheme
    };

    Object.entries(checkboxes).forEach(([id, checked]) => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.checked = checked;
      }
    });
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      // Alt+A to toggle accessibility panel
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        Accessibility.togglePanel();
      }
      
      // Escape to close panel
      if (e.key === 'Escape' && AccessibilityState.panelVisible) {
        Accessibility.togglePanel();
      }
    });
  }

  // Public API
  window.Accessibility = {
    // Método de inicialização pública
    init: function() {
      console.log('Inicializando Accessibility...');
      createAccessibilityPanel();
      createToggleButton();
      applySettings();
      setupKeyboardShortcuts();
      // Skip link removido
    },
    
    setFontSize: function(size) {
      console.log('📝 setFontSize chamado com:', size);
      AccessibilityState.fontSize = size;
      localStorage.setItem('admin-font-size', size);
      console.log('💾 Estado atualizado:', AccessibilityState.fontSize);
      applySettings();
      // Atualiza visual dos botões imediatamente
      updateFontSizeButtons();
      // Força verificação após aplicar
      setTimeout(function() {
        console.log('🔍 Classes no body após aplicar:', document.body.className);
        console.log('🔍 Estado:', AccessibilityState.fontSize);
      }, 100);
    },

    toggleHighContrast: function(enabled) {
      AccessibilityState.highContrast = enabled;
      localStorage.setItem('admin-high-contrast', enabled);
      applySettings();
      // Feedback visual
      const checkbox = document.getElementById('high-contrast');
      if (checkbox) {
        checkbox.checked = enabled;
      }
    },

    toggleLargeButtons: function(enabled) {
      AccessibilityState.largeButtons = enabled;
      localStorage.setItem('admin-large-buttons', enabled);
      applySettings();
      // Feedback visual
      const checkbox = document.getElementById('large-buttons');
      if (checkbox) {
        checkbox.checked = enabled;
      }
    },

    toggleSimplifiedView: function(enabled) {
      AccessibilityState.simplifiedView = enabled;
      localStorage.setItem('admin-simplified-view', enabled);
      applySettings();
      // Feedback visual
      const checkbox = document.getElementById('simplified-view');
      if (checkbox) {
        checkbox.checked = enabled;
      }
    },

    toggleDarkTheme: function(enabled) {
      AccessibilityState.darkTheme = enabled;
      localStorage.setItem('admin-dark-theme', enabled);
      applySettings();
      // Feedback visual
      const checkbox = document.getElementById('dark-theme');
      if (checkbox) {
        checkbox.checked = enabled;
      }
    },

    reset: function() {
      AccessibilityState.fontSize = 'normal';
      AccessibilityState.highContrast = false;
      AccessibilityState.largeButtons = false;
      AccessibilityState.simplifiedView = false;
      AccessibilityState.darkTheme = false;

      localStorage.removeItem('admin-font-size');
      localStorage.removeItem('admin-high-contrast');
      localStorage.removeItem('admin-large-buttons');
      localStorage.removeItem('admin-simplified-view');
      localStorage.removeItem('admin-dark-theme');

      applySettings();
      updateCheckboxes();
      updateFontSizeButtons();
      
      // Feedback visual
      const panel = document.getElementById('accessibility-panel');
      if (panel) {
        panel.style.transform = 'scale(0.98)';
        setTimeout(function() {
          panel.style.transform = 'scale(1)';
        }, 200);
      }
    },

    togglePanel: function() {
      console.log('🔘 togglePanel chamado');
      const panel = document.getElementById('accessibility-panel');
      const button = document.getElementById('accessibility-toggle');
      
      if (!panel) {
        console.error('❌ Painel não encontrado!');
        return;
      }
      if (!button) {
        console.error('❌ Botão não encontrado!');
        return;
      }

      AccessibilityState.panelVisible = !AccessibilityState.panelVisible;
      console.log('📊 Panel visible:', AccessibilityState.panelVisible);
      
      if (AccessibilityState.panelVisible) {
        console.log('👉 Abrindo painel...');
        panel.setAttribute('aria-hidden', 'false');
        button.setAttribute('aria-expanded', 'true');
        panel.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        panel.style.display = 'flex';
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(10px) scale(0.95)';
        // Força repaint
        panel.offsetHeight;
        setTimeout(function() {
          panel.style.opacity = '1';
          panel.style.transform = 'translateY(0) scale(1)';
          console.log('✅ Painel aberto');
        }, 10);
        // Focus first element for keyboard navigation
        setTimeout(function() {
          const firstButton = panel.querySelector('button');
          if (firstButton) {
            firstButton.focus();
          }
        }, 100);
      } else {
        console.log('👈 Fechando painel...');
        panel.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(function() {
          panel.style.display = 'none';
          panel.setAttribute('aria-hidden', 'true');
          button.setAttribute('aria-expanded', 'false');
          button.focus();
          console.log('✅ Painel fechado');
        }, 300);
      }
    }
  };

})();

