# core/management/commands/check_notifications.py

from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from core.models import PushSubscription

try:
    from django_q.models import Schedule, Success, Failure
    from core.tasks import check_expiring_products_and_notify, check_low_stock_and_notify
    DJANGO_Q_AVAILABLE = True
except ImportError:
    DJANGO_Q_AVAILABLE = False

try:
    from py_vapid import Vapid
    VAPID_AVAILABLE = True
except ImportError:
    VAPID_AVAILABLE = False


class Command(BaseCommand):
    help = 'Verifica a configuração de notificações push e agendamentos'

    def handle(self, *args, **options):
        self.stdout.write("=" * 60)
        self.stdout.write(self.style.SUCCESS("🔍 Diagnóstico de Notificações Push"))
        self.stdout.write("=" * 60)
        self.stdout.write()

        # 1. Verificar QCluster
        self.stdout.write("1️⃣ Verificando QCluster...")
        if not DJANGO_Q_AVAILABLE:
            self.stdout.write(self.style.ERROR("   ❌ django_q não está instalado!"))
            self.stdout.write(self.style.WARNING("   Execute: pip install django-q2"))
        else:
            self.stdout.write(self.style.SUCCESS("   ✅ django_q está instalado"))
        self.stdout.write()

        # 2. Verificar Schedules
        self.stdout.write("2️⃣ Verificando Schedules...")
        if DJANGO_Q_AVAILABLE:
            schedules = Schedule.objects.all()
            expiring_schedule = schedules.filter(func='core.tasks.check_expiring_products_and_notify').first()
            low_stock_schedule = schedules.filter(func='core.tasks.check_low_stock_and_notify').first()

            if expiring_schedule:
                is_active = expiring_schedule.next_run and expiring_schedule.next_run > timezone.now()
                status = "✅" if is_active else "❌"
                self.stdout.write(f"   {status} Schedule de validade: {expiring_schedule.name}")
                self.stdout.write(f"      Next Run: {expiring_schedule.next_run}")
                self.stdout.write(f"      Repeats: {expiring_schedule.repeats}")
                self.stdout.write(f"      Ativo: {is_active}")
            else:
                self.stdout.write(self.style.WARNING("   ⚠️ Schedule de validade não encontrado"))
                self.stdout.write(self.style.WARNING("      Execute: python manage.py create_schedules"))

            if low_stock_schedule:
                is_active = low_stock_schedule.next_run and low_stock_schedule.next_run > timezone.now()
                status = "✅" if is_active else "❌"
                self.stdout.write(f"   {status} Schedule de estoque baixo: {low_stock_schedule.name}")
                self.stdout.write(f"      Next Run: {low_stock_schedule.next_run}")
                self.stdout.write(f"      Repeats: {low_stock_schedule.repeats}")
                self.stdout.write(f"      Ativo: {is_active}")
            else:
                self.stdout.write(self.style.WARNING("   ⚠️ Schedule de estoque baixo não encontrado"))
                self.stdout.write(self.style.WARNING("      Execute: python manage.py create_schedules"))

            # Últimas execuções
            if DJANGO_Q_AVAILABLE:
                recent_successes = Success.objects.all().order_by('-started')[:5]
                if recent_successes.exists():
                    self.stdout.write()
                    self.stdout.write("   📊 Últimas execuções bem-sucedidas:")
                    for success in recent_successes:
                        self.stdout.write(f"      - {success.func} em {success.started}")
                else:
                    self.stdout.write(self.style.WARNING("   ⚠️ Nenhuma execução bem-sucedida encontrada"))

                recent_failures = Failure.objects.all().order_by('-started')[:5]
                if recent_failures.exists():
                    self.stdout.write()
                    self.stdout.write(self.style.ERROR("   ❌ Últimas falhas:"))
                    for failure in recent_failures:
                        self.stdout.write(self.style.ERROR(f"      - {failure.func} em {failure.started}"))
                        self.stdout.write(self.style.ERROR(f"        Erro: {failure.exc_info[:100]}"))
        self.stdout.write()

        # 3. Verificar Push Subscriptions
        self.stdout.write("3️⃣ Verificando Push Subscriptions...")
        active_subscriptions = PushSubscription.objects.filter(active=True)
        total_subscriptions = PushSubscription.objects.count()

        if active_subscriptions.exists():
            self.stdout.write(self.style.SUCCESS(f"   ✅ {active_subscriptions.count()} subscription(s) ativa(s)"))
            self.stdout.write(f"      Total de subscriptions: {total_subscriptions}")
        else:
            self.stdout.write(self.style.ERROR("   ❌ Nenhuma subscription ativa encontrada!"))
            self.stdout.write(self.style.WARNING("      O frontend precisa registrar uma subscription primeiro"))
            self.stdout.write(self.style.WARNING("      Acesse o site e permita notificações no navegador"))
        self.stdout.write()

        # 4. Verificar VAPID
        self.stdout.write("4️⃣ Verificando Chaves VAPID...")
        vapid_private_key = getattr(settings, 'VAPID_PRIVATE_KEY', None)
        vapid_email = getattr(settings, 'VAPID_CLAIMS', {}).get('sub', None)

        if not VAPID_AVAILABLE:
            self.stdout.write(self.style.ERROR("   ❌ py-vapid não está instalado!"))
            self.stdout.write(self.style.WARNING("      Execute: pip install py-vapid"))
        else:
            self.stdout.write(self.style.SUCCESS("   ✅ py-vapid está instalado"))

        if not vapid_private_key:
            self.stdout.write(self.style.ERROR("   ❌ VAPID_PRIVATE_KEY não está configurada!"))
            self.stdout.write(self.style.WARNING("      Execute: python gerar_chaves_vapid.py"))
        elif 'placeholder' in vapid_private_key or not vapid_private_key.strip().startswith('-----BEGIN'):
            self.stdout.write(self.style.ERROR("   ❌ VAPID_PRIVATE_KEY está em formato incorreto!"))
            self.stdout.write(self.style.WARNING("      Deve ser uma chave PEM válida"))
        else:
            try:
                from py_vapid import Vapid
                vapid = Vapid.from_pem(vapid_private_key.encode('utf-8'))
                self.stdout.write(self.style.SUCCESS("   ✅ VAPID_PRIVATE_KEY está configurada e válida"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"   ❌ VAPID_PRIVATE_KEY é inválida: {e}"))

        if not vapid_email:
            self.stdout.write(self.style.WARNING("   ⚠️ VAPID_EMAIL não está configurada"))
        else:
            self.stdout.write(self.style.SUCCESS(f"   ✅ VAPID_EMAIL: {vapid_email}"))
        self.stdout.write()

        # 5. Verificar Email
        self.stdout.write("5️⃣ Verificando Configuração de Email...")
        email_host_user = getattr(settings, 'EMAIL_HOST_USER', None)
        email_host_password = getattr(settings, 'EMAIL_HOST_PASSWORD', None)
        notification_emails = getattr(settings, 'NOTIFICATION_EMAILS', [])

        if email_host_user and email_host_password:
            self.stdout.write(self.style.SUCCESS(f"   ✅ Email configurado: {email_host_user}"))
        else:
            self.stdout.write(self.style.WARNING("   ⚠️ Email não está configurado"))

        if notification_emails:
            self.stdout.write(self.style.SUCCESS(f"   ✅ Emails de notificação: {', '.join(notification_emails)}"))
        else:
            self.stdout.write(self.style.WARNING("   ⚠️ NOTIFICATION_EMAILS não configurado"))
        self.stdout.write()

        # 6. Resumo
        self.stdout.write("=" * 60)
        self.stdout.write("📋 Resumo:")
        self.stdout.write("=" * 60)

        issues = []
        if not DJANGO_Q_AVAILABLE:
            issues.append("django_q não instalado")
        if DJANGO_Q_AVAILABLE and not Schedule.objects.filter(func__contains='check_expiring').exists():
            issues.append("Schedule de validade não encontrado")
        if not active_subscriptions.exists():
            issues.append("Nenhuma subscription ativa")
        if not VAPID_AVAILABLE:
            issues.append("py-vapid não instalado")
        if not vapid_private_key:
            issues.append("VAPID_PRIVATE_KEY não configurada")

        if issues:
            self.stdout.write(self.style.ERROR("❌ Problemas encontrados:"))
            for issue in issues:
                self.stdout.write(self.style.ERROR(f"   - {issue}"))
            self.stdout.write()
            self.stdout.write(self.style.WARNING("💡 Execute os comandos sugeridos acima para resolver"))
        else:
            self.stdout.write(self.style.SUCCESS("✅ Tudo configurado corretamente!"))
            self.stdout.write(self.style.WARNING("💡 Se ainda não funciona, verifique os logs do QCluster"))

        self.stdout.write()

