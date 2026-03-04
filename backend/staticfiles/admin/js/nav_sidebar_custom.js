/* Django Admin Sidebar - Menu Simple Links with Icons */

(function() {
    'use strict';
    
    // Função para adicionar ícones aos links do menu
    function addIconsToMenu() {
        const sidebar = document.getElementById('nav-sidebar');
        if (!sidebar) return;
        
        // Ícones por aplicação e modelo
        const iconMap = {
            'auth': {
                'user': '👤',
                'group': '👥'
            },
            'core': {
                'product': '📦',
                'category': '🏷️',
                'brand': '🏭',
                'notification': '🔔',
                'pushsubscription': '📱'
            },
            'django_q': {
                'schedule': '📅',
                'success': '✅',
                'failure': '❌',
                'ormq': '⚙️'
            }
        };
        
        // Para cada módulo no sidebar
        const modules = sidebar.querySelectorAll('.module');
        modules.forEach(function(module) {
            const table = module.querySelector('table');
            if (!table) return;
            
            // Para cada linha da tabela (tr dentro de tbody)
            const rows = table.querySelectorAll('tbody tr');
            
            rows.forEach(function(row) {
                // Verificar se já foi processado
                if (row.classList.contains('icon-processed')) return;
                
                const th = row.querySelector('th');
                if (!th) return;
                
                const mainLink = th.querySelector('a');
                if (!mainLink) return;
                
                // Marcar como processado
                row.classList.add('icon-processed');
                
                // Determinar ícone Font Awesome baseado na URL
                const href = mainLink.href.toLowerCase();
                let iconClass = 'fa-list'; // padrão - Font Awesome icon
                
                // Verificar por aplicação e mapear para ícones Font Awesome
                if (href.includes('/auth/')) {
                    if (href.includes('user')) iconClass = 'fa-user';
                    else if (href.includes('group')) iconClass = 'fa-users';
                } else if (href.includes('/core/')) {
                    if (href.includes('product')) iconClass = 'fa-box';
                    else if (href.includes('category')) iconClass = 'fa-tags';
                    else if (href.includes('brand')) iconClass = 'fa-industry';
                    else if (href.includes('notification')) iconClass = 'fa-bell';
                    else if (href.includes('push')) iconClass = 'fa-mobile-alt';
                } else if (href.includes('/django_q/')) {
                    if (href.includes('schedule')) iconClass = 'fa-calendar';
                    else if (href.includes('success')) iconClass = 'fa-check-circle';
                    else if (href.includes('failure')) iconClass = 'fa-times-circle';
                    else if (href.includes('ormq')) iconClass = 'fa-cog';
                }
                
                // Adicionar ou atualizar ícone Font Awesome antes do texto do link
                let iconSpan = mainLink.querySelector('.menu-icon');
                if (!iconSpan) {
                    iconSpan = document.createElement('span');
                    iconSpan.className = 'menu-icon';
                    iconSpan.style.marginRight = '0.75rem';
                    iconSpan.style.display = 'inline-flex';
                    iconSpan.style.alignItems = 'center';
                    iconSpan.style.justifyContent = 'center';
                    iconSpan.style.width = '1.125rem';
                    iconSpan.style.textAlign = 'center';
                    
                    // Inserir ícone no início do link
                    mainLink.insertBefore(iconSpan, mainLink.firstChild);
                }
                
                // Criar ou atualizar elemento <i> para Font Awesome
                let iconElement = iconSpan.querySelector('i');
                if (!iconElement) {
                    iconElement = document.createElement('i');
                    iconSpan.appendChild(iconElement);
                }
                iconElement.className = 'fas ' + iconClass;
            });
        });
    }
    
    // Remover botões "Adicionar" do sidebar
    function removeAddButtons() {
        const sidebar = document.getElementById('nav-sidebar');
        if (!sidebar) return;
        
        // Remover todas as células td que contêm links de adicionar
        const addLinks = sidebar.querySelectorAll('td a.addlink');
        addLinks.forEach(function(addLink) {
            const td = addLink.closest('td');
            if (td) {
                td.remove();
            }
        });
    }
    
    // Inicializar
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                removeAddButtons();
                addIconsToMenu();
            });
        } else {
            removeAddButtons();
            addIconsToMenu();
        }
    }
    
    init();
    
    // Reinicializar quando sidebar abrir/fechar
    const toggleButton = document.getElementById('toggle-nav-sidebar');
    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            setTimeout(function() {
                removeAddButtons();
                addIconsToMenu();
            }, 350);
        });
    }
})();
