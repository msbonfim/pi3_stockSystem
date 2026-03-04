/* Move filters to toolbar - Junta filtros com a busca na mesma div */
(function() {
    'use strict';
    
    function moveFiltersToToolbar() {
        const contentRelated = document.getElementById('content-related');
        const changelistFilter = document.getElementById('changelist-filter');
        const toolbar = document.getElementById('toolbar');
        
        // Se não houver filtros ou toolbar, não fazer nada
        if (!toolbar) return;
        
        // Se já foi processado, não processar novamente
        if (document.getElementById('inline-filters-container')) return;
        
        // Se não há filtros, apenas ocultar sidebar
        if (!changelistFilter) {
            if (contentRelated) {
                contentRelated.style.display = 'none';
                contentRelated.style.visibility = 'hidden';
                contentRelated.style.width = '0';
                contentRelated.style.margin = '0';
                contentRelated.style.padding = '0';
            }
            return;
        }
        
        // Encontrar o formulário da toolbar
        const toolbarForm = toolbar.querySelector('form');
        if (!toolbarForm) {
            // Se não há form, inserir diretamente na toolbar
            insertFiltersDirectly(toolbar, changelistFilter, contentRelated);
            return;
        }
        
        // Encontrar onde está a busca
        const searchInput = toolbarForm.querySelector('input[name="q"]') || 
                           toolbarForm.querySelector('#searchbar') ||
                           toolbarForm.querySelector('input[type="text"]');
        
        if (!searchInput) {
            // Se não encontrou busca, inserir no final do form
            insertFiltersInForm(toolbarForm, changelistFilter, contentRelated);
            return;
        }
        
        // Encontrar o container da busca (pode ser um div ou td)
        let searchContainer = searchInput.parentElement;
        while (searchContainer && searchContainer !== toolbarForm) {
            if (searchContainer.tagName === 'DIV' || searchContainer.tagName === 'TD' || searchContainer.tagName === 'P') {
                break;
            }
            searchContainer = searchContainer.parentElement;
        }
        
        // Criar container para filtros inline
        const filtersContainer = document.createElement('div');
        filtersContainer.id = 'inline-filters-container';
        filtersContainer.className = 'inline-filters-container';
        
        // Clonar filtros
        const filterClone = changelistFilter.cloneNode(true);
        filterClone.classList.add('moved-to-toolbar');
        filterClone.id = 'changelist-filter-inline';
        
        // Remover o título h3 se existir
        const h3 = filterClone.querySelector('h3');
        if (h3) {
            h3.remove();
        }
        
        // Mover para o container
        filtersContainer.appendChild(filterClone);
        
        // Inserir os filtros na mesma linha ou logo após a busca
        if (searchContainer && searchContainer !== toolbarForm) {
            // Inserir na mesma linha, ao lado da busca
            searchContainer.style.display = 'flex';
            searchContainer.style.flexWrap = 'wrap';
            searchContainer.style.alignItems = 'center';
            searchContainer.style.gap = '0.75rem';
            
            // Criar uma nova linha abaixo da busca
            const filtersRow = document.createElement('div');
            filtersRow.className = 'filters-row';
            filtersRow.style.width = '100%';
            filtersRow.appendChild(filtersContainer);
            
            // Inserir após o container da busca
            if (searchContainer.nextSibling) {
                searchContainer.parentNode.insertBefore(filtersRow, searchContainer.nextSibling);
            } else {
                searchContainer.parentNode.appendChild(filtersRow);
            }
        } else {
            // Inserir diretamente no form
            toolbarForm.appendChild(filtersContainer);
        }
        
        // Ocultar sidebar de filtros COMPLETAMENTE
        hideSidebar(contentRelated, changelistFilter);
        
        // Restaurar funcionalidade dos filtros (preservar estado)
        const details = filterClone.querySelectorAll('details');
        details.forEach(function(detail) {
            const original = changelistFilter.querySelector('[data-filter-title="' + detail.dataset.filterTitle + '"]');
            if (original && original.hasAttribute('open')) {
                detail.setAttribute('open', '');
            }
        });
    }
    
    function insertFiltersInForm(form, changelistFilter, contentRelated) {
        const filtersContainer = document.createElement('div');
        filtersContainer.id = 'inline-filters-container';
        filtersContainer.className = 'inline-filters-container';
        
        const filterClone = changelistFilter.cloneNode(true);
        filterClone.classList.add('moved-to-toolbar');
        filterClone.id = 'changelist-filter-inline';
        
        const h3 = filterClone.querySelector('h3');
        if (h3) {
            h3.remove();
        }
        
        filtersContainer.appendChild(filterClone);
        form.appendChild(filtersContainer);
        
        hideSidebar(contentRelated, changelistFilter);
    }
    
    function insertFiltersDirectly(toolbar, changelistFilter, contentRelated) {
        const filtersContainer = document.createElement('div');
        filtersContainer.id = 'inline-filters-container';
        filtersContainer.className = 'inline-filters-container';
        
        const filterClone = changelistFilter.cloneNode(true);
        filterClone.classList.add('moved-to-toolbar');
        filterClone.id = 'changelist-filter-inline';
        
        const h3 = filterClone.querySelector('h3');
        if (h3) {
            h3.remove();
        }
        
        filtersContainer.appendChild(filterClone);
        toolbar.appendChild(filtersContainer);
        
        hideSidebar(contentRelated, changelistFilter);
    }
    
    function hideSidebar(contentRelated, changelistFilter) {
        // Ocultar sidebar de filtros COMPLETAMENTE
        if (contentRelated) {
            contentRelated.style.display = 'none';
            contentRelated.style.visibility = 'hidden';
            contentRelated.style.width = '0';
            contentRelated.style.margin = '0';
            contentRelated.style.padding = '0';
            contentRelated.style.position = 'absolute';
            contentRelated.style.left = '-9999px';
        }
        
        if (changelistFilter) {
            changelistFilter.style.display = 'none';
            changelistFilter.style.visibility = 'hidden';
        }
    }
    
    // Executar quando DOM estiver pronto
    function init() {
        function execute() {
            // Múltiplas tentativas para garantir execução
            moveFiltersToToolbar();
            setTimeout(moveFiltersToToolbar, 100);
            setTimeout(moveFiltersToToolbar, 300);
            setTimeout(moveFiltersToToolbar, 500);
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', execute);
        } else {
            execute();
        }
        
        // Re-executar se a página for carregada dinamicamente
        if (window.MutationObserver) {
            const observer = new MutationObserver(function(mutations) {
                const changelistFilter = document.getElementById('changelist-filter');
                const filtersContainer = document.getElementById('inline-filters-container');
                const contentRelated = document.getElementById('content-related');
                
                if (changelistFilter && !filtersContainer) {
                    setTimeout(moveFiltersToToolbar, 100);
                }
                
                // Garantir que sidebar está oculta
                if (contentRelated && contentRelated.style.display !== 'none') {
                    hideSidebar(contentRelated, changelistFilter);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
    }
    
    init();
})();
