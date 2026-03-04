"""
Middleware para injetar recursos de modernização e acessibilidade no Django Admin
Funciona mesmo quando admin_interface sobrescreve templates
"""
from django.template.response import TemplateResponse
from django.utils.deprecation import MiddlewareMixin


class AdminModernizationMiddleware(MiddlewareMixin):
    """
    Injeta CSS e JavaScript customizados diretamente no HTML das respostas do admin
    """
    
    def process_response(self, request, response):
        """
        Injeta os recursos diretamente no HTML da resposta
        """
        # Verifica se é uma página do admin (sem admin_interface agora)
        if request.path.startswith('/admin') and hasattr(response, 'content'):
            try:
                content = response.content.decode('utf-8') if isinstance(response.content, bytes) else str(response.content)
            except:
                return response
            
            # CSS crítico inline MUITO mais completo (garante que sempre seja aplicado)
            # Com mais especificidade e !important para sobrescrever tudo
            critical_css = '''<style id="force-remove-margins-middleware">
            /* FORÇA REMOÇÃO DE MARGENS LATERAIS - PRIORIDADE MÁXIMA */
            html body .main, html body .main.shifted, html body div.main, html body div.main.shifted,
            body.admin .main, body.admin .main.shifted, body.admin div.main, body.admin div.main.shifted,
            #container .main, #container .main.shifted, body .main, body .main.shifted {
                margin-left: 0 !important;
                margin-right: 0 !important;
            }
            html body #header, html body header#header, body.admin #header, body.admin header#header, body #header,
            #header, header#header, div#header, body > header, html > body > header, #container #header, #container header#header {
                margin-left: 0 !important;
                margin-right: 0 !important;
                padding-left: 1.5rem !important;
                padding-right: 1.5rem !important;
                left: 0 !important;
                transform: translateX(0) !important;
            }
            </style>
            <style id="admin-modern-critical">
            /* Reset e base */
            * { box-sizing: border-box; }
            /* Header moderno */
            body.admin #header, #header {
                background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%) !important;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
                border-bottom: none !important;
                padding: 1rem 2rem !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                left: 0 !important;
                transform: translateX(0) !important;
                position: relative !important;
                z-index: 1000 !important;
            }
            body.admin #header #site-name a, #header #site-name a {
                color: #ffffff !important;
                font-weight: 600 !important;
                font-size: 1.25rem !important;
                text-decoration: none !important;
            }
            /* Módulos modernos */
            body.admin .module, .module {
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 8px !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
                margin-bottom: 1.5rem !important;
                transition: all 0.2s !important;
                overflow: hidden !important;
            }
            body.admin .module:hover, .module:hover {
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
                transform: translateY(-2px) !important;
            }
            body.admin .module h2, .module h2 {
                background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%) !important;
                padding: 1rem 1.5rem !important;
                margin: 0 !important;
                border-bottom: 1px solid #e2e8f0 !important;
                font-size: 1.1rem !important;
                font-weight: 600 !important;
                color: #1e293b !important;
            }
            /* Botões modernos */
            body.admin .button, body.admin input[type="submit"], body.admin .submit-row input,
            .button, input[type="submit"], .submit-row input {
                background: #2563eb !important;
                color: #ffffff !important;
                border-radius: 8px !important;
                padding: 0.75rem 1.5rem !important;
                border: none !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
                transition: all 0.2s !important;
                font-weight: 500 !important;
                cursor: pointer !important;
            }
            body.admin .button:hover, body.admin input[type="submit"]:hover, body.admin .submit-row input:hover,
            .button:hover, input[type="submit"]:hover, .submit-row input:hover {
                background: #1e40af !important;
                transform: translateY(-1px) !important;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
            }
            /* Content area */
            body.admin #content-main, #content-main {
                padding: 1.5rem !important;
                background: #f8fafc !important;
            }
            /* Tabelas */
            body.admin #result_list, #result_list {
                background: #ffffff !important;
                border-radius: 8px !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
            }
            /* Painel de acessibilidade - botão flutuante */
            #accessibility-toggle {
                position: fixed !important;
                bottom: 20px !important;
                right: 20px !important;
                width: 60px !important;
                height: 60px !important;
                background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%) !important;
                color: #ffffff !important;
                border: none !important;
                border-radius: 50% !important;
                font-size: 24px !important;
                cursor: pointer !important;
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4) !important;
                z-index: 9998 !important;
                transition: all 0.3s !important;
            }
            #accessibility-toggle:hover {
                transform: scale(1.1) !important;
                box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5) !important;
            }
            /* Painel de acessibilidade - só fecha se não estiver aberto */
            #accessibility-panel:not([aria-hidden="false"]):not([style*="display: flex"]):not([style*="display:flex"]) {
                position: fixed !important;
                bottom: 90px !important;
                right: 20px !important;
                z-index: 9999 !important;
                display: none !important;
                visibility: hidden !important;
            }
            /* Quando aberto - máxima especificidade */
            html body #accessibility-panel[aria-hidden="false"],
            html body #accessibility-panel[style*="display: flex"],
            html body #accessibility-panel[style*="display:flex"] {
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
            /* Base do painel - sempre aplicado */
            #accessibility-panel {
                position: fixed !important;
                bottom: 90px !important;
                right: 20px !important;
                z-index: 9999 !important;
                background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
                border: 2px solid #e2e8f0 !important;
                border-radius: 16px !important;
                padding: 20px !important;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15) !important;
                max-width: 380px !important;
                max-height: 85vh !important;
                overflow-y: auto !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                flex-direction: column !important;
            }
            #accessibility-panel .panel-header {
                font-size: 1.5rem !important;
                font-weight: 700 !important;
                color: #1e293b !important;
                margin-bottom: 20px !important;
                border-bottom: 2px solid #e2e8f0 !important;
                padding-bottom: 15px !important;
            }
            #accessibility-panel .font-size-buttons {
                display: flex !important;
                gap: 10px !important;
                margin-bottom: 20px !important;
            }
            #accessibility-panel .font-size-buttons button {
                flex: 1 !important;
                padding: 12px !important;
                background: #f1f5f9 !important;
                border: 2px solid #e2e8f0 !important;
                border-radius: 8px !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                transition: all 0.2s !important;
            }
            #accessibility-panel .font-size-buttons button.active {
                background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%) !important;
                color: #ffffff !important;
                border-color: #2563eb !important;
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3) !important;
            }
            </style>'''
            
            # Injeta CSS crítico no <head> se existir
            # Os arquivos CSS/JS já são carregados pelo template base_site.html
            # Não precisamos injetar scripts novamente aqui para evitar duplicação
            if '<head>' in content and '</head>' in content:
                # Remove CSS crítico antigo se existir
                import re
                content = re.sub(r'<style id="admin-modern-critical">.*?</style>', '', content, flags=re.DOTALL)
                # Injeta no início do head
                content = content.replace('<head>', '<head>' + critical_css, 1)
            
            try:
                response.content = content.encode('utf-8') if isinstance(response.content, bytes) else content
            except:
                pass
        
        return response
