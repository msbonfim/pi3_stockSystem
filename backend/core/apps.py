from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
    verbose_name = _('Core')

    def ready(self):
        """
        Este método é executado quando o Django está pronto.
        Vamos forçar a tradução do nome do app 'django_q' aqui.
        Isso sobrescreve o nome na fonte, antes que o admin o leia.
        """
        try:
            from django.apps import apps
            apps.get_app_config('django_q').verbose_name = 'Tarefas em Fila (Django Q)'
        except Exception as e:
            pass
        
        # Injeta o script de modernização em todas as páginas do admin
        try:
            from django.template.loader import get_template
            from django.template import Context
            
            # Adiciona um script inline que será executado em todas as páginas
            # Isso funciona mesmo quando admin_interface sobrescreve templates
            pass  # Será feito via template tag ou middleware
        except Exception:
            pass