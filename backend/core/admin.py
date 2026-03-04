# core/admin.py

from django.contrib import admin
from django.template.response import TemplateResponse
from django.urls import path
from .models import Product, Category, Brand, Notification, PushSubscription
from import_export import resources, fields, widgets
from import_export.admin import ImportExportModelAdmin
from import_export.widgets import ForeignKeyWidget
import datetime

# --- WIDGET DE DATA QUE FUNCIONA ---
class PermissiveDateWidget(widgets.DateWidget):
    def clean(self, value, row=None, *args, **kwargs):
        if not value: return None
        if isinstance(value, datetime.datetime): return value.date()
        if isinstance(value, datetime.date): return value
        if isinstance(value, str) and value.strip() in ('', '-'): return None
        return super().clean(value, row, *args, **kwargs)

# --- WIDGET DE CHAVE ESTRANGEIRA QUE FUNCIONA ---
class CreateOrGetForeignKeyWidget(ForeignKeyWidget):
    def clean(self, value, row=None, *args, **kwargs):
        if not value: return None
        try:
            return super().clean(value, row, *args, **kwargs)
        except self.model.DoesNotExist:
            return self.model.objects.create(**{self.field: value})

# --- VERSÃO ESTÁVEL DO ProductResource (SEM A FORMATAÇÃO DE EXPORTAÇÃO) ---
class ProductResource(resources.ModelResource):
    # Definimos apenas os campos que precisam de lógica especial (criar FK)
    category = fields.Field(
        column_name='Categoria',
        attribute='category',
        widget=CreateOrGetForeignKeyWidget(Category, 'name'))
    
    brand = fields.Field(
        column_name='Marca',
        attribute='brand',
        widget=CreateOrGetForeignKeyWidget(Brand, 'name'))

    class Meta:
        model = Product
        # Usamos esta lista para definir os campos e a ordem
        fields = ('id', 'name', 'category', 'brand', 'price', 'description', 'expiration_date', 'quantity', 'batch')
        export_order = fields
        import_id_fields = ('id',)
        skip_unchanged = True

        # Usamos o before_import para mapear as colunas da sua planilha
        def before_import(self, dataset, using_transactions, dry_run, **kwargs):
            header_map = {
                'Nome do Produto': 'name',
                'Preço de Venda (R$)': 'price',
                'Descrição': 'description',
                'Validade': 'expiration_date',
                'Quantidade em Estoque': 'quantity',
                'Lote': 'batch',
            }
            new_headers = []
            for header in dataset.headers:
                new_headers.append(header_map.get(header, header))
            dataset.headers = new_headers

# --- O RESTO DO ARQUIVO CONTINUA IGUAL ---
@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

@admin.register(Product)
class ProductAdmin(ImportExportModelAdmin, admin.ModelAdmin):
    resource_class = ProductResource
    list_display = ('id', 'name', 'category', 'brand', 'price', 'quantity', 'expiration_date')
    search_fields = ('name', 'description', 'brand__name')
    list_filter = ('category', 'brand', 'expiration_date')
    ordering = ('-id',)
    list_per_page = 20
    autocomplete_fields = ['category', 'brand']

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'notification_type', 'read', 'product', 'created_at')
    list_filter = ('notification_type', 'read', 'created_at')
    search_fields = ('title', 'message', 'product__name')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    list_per_page = 20


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('id', 'endpoint_short', 'active', 'created_at')
    list_filter = ('active', 'created_at')
    search_fields = ('endpoint',)
    readonly_fields = ('endpoint', 'p256dh', 'auth', 'created_at')
    ordering = ('-created_at',)
    list_per_page = 20
    
    def endpoint_short(self, obj):
        return obj.endpoint[:50] + '...' if len(obj.endpoint) > 50 else obj.endpoint
    endpoint_short.short_description = 'Endpoint'
    
    actions = ['test_push_notification', 'delete_all_subscriptions']
    
    def test_push_notification(self, request, queryset):
        """Testa envio de push notification"""
        from .push_utils import send_push_notification
        import sys
        
        total = queryset.count()
        active = queryset.filter(active=True).count()
        
        if active == 0:
            self.message_user(request, f"❌ Nenhuma subscription ativa selecionada. Total: {total}", level='ERROR')
            return
        
        # Força output para stdout/stderr aparecer nos logs
        print("\n" + "="*70, file=sys.stdout)
        print("🧪 TESTE DE PUSH NOTIFICATION DO DJANGO ADMIN", file=sys.stdout)
        print("="*70, file=sys.stdout, flush=True)
        
        result = send_push_notification(
            title="🧪 Teste de Notificação",
            message="Esta é uma notificação de teste do Django Admin!",
            data={"type": "test"}
        )
        
        sent = result.get('sent', 0)
        failed = result.get('failed', 0)
        error = result.get('error')
        
        print(f"RESULTADO: sent={sent}, failed={failed}, error={error}", file=sys.stdout, flush=True)
        print("="*70 + "\n", file=sys.stdout, flush=True)
        
        if sent > 0:
            msg = f"✅ {sent} notificação(s) enviada(s) com sucesso! {failed} falha(s)."
            self.message_user(request, msg, level='SUCCESS')
        else:
            error_msg = f"Erro: {error}" if error else "Sem erros reportados"
            msg = f"❌ Falha ao enviar. {failed} erro(s). {error_msg}. Verifique os logs do Render.com."
            self.message_user(request, msg, level='ERROR')
    
    test_push_notification.short_description = "🧪 Testar Push Notification"
    
    def delete_all_subscriptions(self, request, queryset):
        """Deleta todas as subscriptions selecionadas"""
        count = queryset.count()
        queryset.delete()
        self.message_user(request, f"✅ {count} subscription(s) deletada(s).", level='SUCCESS')
    
    delete_all_subscriptions.short_description = "🗑️ Deletar Subscriptions Selecionadas"


# Customização dos modelos do Django Q para tradução
try:
    from django_q.models import Schedule, Failure, OrmQ, Success
    from django.contrib import admin
    from django.utils import timezone
    from django.utils.html import format_html
    from django.utils.translation import gettext_lazy as _
    
    # Customização do Schedule
    if admin.site.is_registered(Schedule):
        admin.site.unregister(Schedule)
    
    @admin.register(Schedule)
    class ScheduleAdmin(admin.ModelAdmin):
        """Admin customizado para Schedules com interface melhorada"""
        list_display = ('name', 'func_display', 'schedule_type_display', 'next_run_display', 'repeats_display', 'is_active_display')
        list_filter = ('schedule_type', 'repeats')
        search_fields = ('name', 'func')
        fieldsets = (
            ('Informações Básicas', {
                'fields': ('name', 'func')
            }),
            ('Agendamento', {
                'fields': ('schedule_type', 'next_run', 'minutes', 'repeats'),
                'description': 'Configure quando e com que frequência a tarefa será executada.'
            }),
            ('Parâmetros da Função', {
                'fields': ('args', 'kwargs'),
                'description': 'Argumentos e parâmetros que serão passados para a função. Use formato JSON para kwargs (ex: {"min_quantity": 2}).',
                'classes': ('collapse',)
            }),
            ('Hook (Opcional)', {
                'fields': ('hook',),
                'classes': ('collapse',)
            }),
        )
        readonly_fields = ()
        
        def func_display(self, obj):
            """Mostra a função de forma limpa"""
            func = obj.func or ''
            # Remove markdown se existir
            import re
            match = re.search(r'`([^`]+)`', func)
            if match:
                func = match.group(1)
            return format_html('<code>{}</code>', func)
        func_display.short_description = 'Função'
        
        def schedule_type_display(self, obj):
            """Mostra o tipo de agendamento com ícone"""
            type_map = {
                'I': '⏱️ Imediato',
                'O': '🔁 Uma vez',
                'H': '⏰ Por hora',
                'D': '📅 Diário',
                'W': '📆 Semanal',
                'M': '📅 Mensal',
                'Q': '📅 Trimestral',
                'Y': '📅 Anual',
            }
            return type_map.get(obj.schedule_type, obj.get_schedule_type_display())
        schedule_type_display.short_description = 'Tipo'
        
        def next_run_display(self, obj):
            """Mostra a próxima execução formatada no timezone local"""
            if not obj.next_run:
                return format_html('<span style="color: gray;">Não agendado</span>')
            
            try:
                from django.utils import timezone
                from django.conf import settings
                from datetime import datetime
                
                dt = obj.next_run
                
                # Se USE_TZ está desabilitado, usa datetime diretamente sem conversão
                if not getattr(settings, 'USE_TZ', False):
                    local_time = dt
                    now = datetime.now()
                else:
                    # Se USE_TZ está habilitado, precisa converter
                    if not timezone.is_aware(dt):
                        # Se for naive, converte para aware primeiro
                        try:
                            dt = timezone.make_aware(dt)
                        except Exception:
                            # Se make_aware falhar, tenta com UTC explicitamente
                            try:
                                import pytz
                                dt = pytz.UTC.localize(dt)
                            except (ImportError, Exception):
                                # Se tudo falhar, usa diretamente
                                local_time = dt
                                now = datetime.now()
                                return dt.strftime('%d/%m/%Y %H:%M')
                    
                    # Só chama localtime se for aware
                    if timezone.is_aware(dt):
                        local_time = timezone.localtime(dt)
                        now = timezone.localtime(timezone.now())
                    else:
                        local_time = dt
                        now = datetime.now()
                
                if local_time <= now:
                    return format_html(
                        '<span style="color: orange;">⚠️ {}</span>',
                        local_time.strftime('%d/%m/%Y %H:%M')
                    )
                return local_time.strftime('%d/%m/%Y %H:%M')
            except Exception:
                # Em caso de erro, mostra o valor original formatado de forma simples
                try:
                    return obj.next_run.strftime('%d/%m/%Y %H:%M') if obj.next_run else 'N/A'
                except:
                    return str(obj.next_run)
        next_run_display.short_description = 'Próxima Execução'
        
        def repeats_display(self, obj):
            """Mostra quantas vezes vai repetir"""
            if obj.repeats == -1:
                return format_html('<span style="color: green;">♾️ Infinito</span>')
            elif obj.repeats == 0:
                return format_html('<span style="color: gray;">Não repete</span>')
            else:
                return f'🔄 {obj.repeats} vez(es)'
        repeats_display.short_description = 'Repetições'
        
        def is_active_display(self, obj):
            """Indica se está ativo"""
            if not obj.next_run:
                return format_html('<span style="color: red;">❌ Inativo</span>')
            
            try:
                from django.utils import timezone
                from django.conf import settings
                from datetime import datetime
                
                dt = obj.next_run
                
                # Se USE_TZ está desabilitado, usa datetime diretamente sem conversão
                if not getattr(settings, 'USE_TZ', False):
                    local_time = dt
                    now = datetime.now()
                else:
                    # Se USE_TZ está habilitado, precisa converter
                    if not timezone.is_aware(dt):
                        # Se for naive, converte para aware primeiro
                        try:
                            dt = timezone.make_aware(dt)
                        except Exception:
                            # Se make_aware falhar, tenta com UTC explicitamente
                            try:
                                import pytz
                                dt = pytz.UTC.localize(dt)
                            except (ImportError, Exception):
                                # Se tudo falhar, usa diretamente
                                local_time = dt
                                now = datetime.now()
                                return format_html('<span style="color: green;">✅ Ativo</span>') if dt > now else format_html('<span style="color: orange;">⚠️ Próxima execução no passado</span>')
                    
                    # Só chama localtime se for aware
                    if timezone.is_aware(dt):
                        local_time = timezone.localtime(dt)
                        now = timezone.localtime(timezone.now())
                    else:
                        local_time = dt
                        now = datetime.now()
                
                if local_time > now:
                    return format_html('<span style="color: green;">✅ Ativo</span>')
                else:
                    return format_html('<span style="color: orange;">⚠️ Próxima execução no passado</span>')
            except Exception:
                # Em caso de erro, mostra como inativo
                return format_html('<span style="color: red;">❌ Erro ao verificar</span>')
        is_active_display.short_description = 'Status'
        
        def save_model(self, request, obj, form, change):
            """Valida e limpa a função antes de salvar"""
            # Limpa markdown da função se existir
            if obj.func:
                import re
                match = re.search(r'`([^`]+)`', obj.func)
                if match:
                    obj.func = match.group(1)
                else:
                    obj.func = obj.func.strip()
            
            super().save_model(request, obj, form, change)
        
        class Media:
            css = {
                'all': ('admin/css/schedule_admin.css',)
            }
    
    # Definir verbose_name traduzido diretamente no modelo
    Schedule._meta.verbose_name = 'Agendamento'
    Schedule._meta.verbose_name_plural = 'Agendamentos'
    
    # Customização do Failure
    if admin.site.is_registered(Failure):
        admin.site.unregister(Failure)
    
    @admin.register(Failure)
    class FailureAdmin(admin.ModelAdmin):
        """Admin para tarefas que falharam"""
        list_display = ('name', 'func', 'started', 'stopped')
        list_filter = ('started',)
        search_fields = ('name', 'func', 'id')
        readonly_fields = ('id', 'name', 'func', 'args', 'kwargs', 'started', 'stopped', 'result')
    
    Failure._meta.verbose_name = 'Tarefa com Falha'
    Failure._meta.verbose_name_plural = 'Tarefas com Falhas'
    
    # Customização do OrmQ
    if admin.site.is_registered(OrmQ):
        admin.site.unregister(OrmQ)
    
    @admin.register(OrmQ)
    class OrmQAdmin(admin.ModelAdmin):
        """Admin para tarefas na fila"""
        list_display = ('id', 'key', 'lock')
        list_filter = ('lock',)
        search_fields = ('key', 'id')
        readonly_fields = ('id', 'key', 'payload', 'lock')
    
    OrmQ._meta.verbose_name = 'Tarefa em Fila'
    OrmQ._meta.verbose_name_plural = 'Tarefas em Fila'
    
    # Customização do Success
    if admin.site.is_registered(Success):
        admin.site.unregister(Success)
    
    @admin.register(Success)
    class SuccessAdmin(admin.ModelAdmin):
        """Admin para tarefas executadas com sucesso"""
        list_display = ('name', 'func', 'started', 'stopped')
        list_filter = ('started', 'stopped')
        search_fields = ('name', 'func', 'id')
        readonly_fields = ('id', 'name', 'func', 'args', 'kwargs', 'started', 'stopped', 'result')
    
    Success._meta.verbose_name = 'Tarefa Executada com Sucesso'
    Success._meta.verbose_name_plural = 'Tarefas Executadas com Sucesso'

except ImportError:
    # Se django_q não estiver disponível, ignora
    pass


# Adiciona painel de acessibilidade ao admin
class CustomAdminSite(admin.AdminSite):
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('accessibility/', self.admin_view(self.accessibility_view), name='accessibility'),
        ]
        return custom_urls + urls
    
    def accessibility_view(self, request):
        from django.shortcuts import render
        return render(request, 'admin/accessibility_panel.html')

# Ativa o CustomAdminSite para usar as funcionalidades de acessibilidade
# Comentado por enquanto - descomente se quiser usar URLs customizadas
# admin.site = CustomAdminSite(name='admin')