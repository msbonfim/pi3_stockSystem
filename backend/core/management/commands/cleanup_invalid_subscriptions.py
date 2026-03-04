#!/usr/bin/env python
"""
Comando Django para limpar subscriptions inválidas (403 Forbidden)
Execute: python manage.py cleanup_invalid_subscriptions
"""

from django.core.management.base import BaseCommand
from core.models import PushSubscription


class Command(BaseCommand):
    help = 'Limpa todas as subscriptions ativas (útil após trocar chaves VAPID)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            help='Deleta TODAS as subscriptions (não apenas as inativas)',
        )

    def handle(self, *args, **options):
        self.stdout.write("=" * 60)
        self.stdout.write(self.style.WARNING("🧹 Limpando Subscriptions Inválidas"))
        self.stdout.write("=" * 60)
        self.stdout.write()
        
        if options['all']:
            # Deleta todas as subscriptions
            count = PushSubscription.objects.all().count()
            PushSubscription.objects.all().delete()
            self.stdout.write(self.style.SUCCESS(f"✅ {count} subscription(s) deletada(s)"))
        else:
            # Desativa todas as subscriptions ativas
            active_count = PushSubscription.objects.filter(active=True).count()
            PushSubscription.objects.filter(active=True).update(active=False)
            self.stdout.write(self.style.SUCCESS(f"✅ {active_count} subscription(s) desativada(s)"))
            
            # Deleta subscriptions inativas
            inactive_count = PushSubscription.objects.filter(active=False).count()
            PushSubscription.objects.filter(active=False).delete()
            self.stdout.write(self.style.SUCCESS(f"✅ {inactive_count} subscription(s) inativa(s) deletada(s)"))
        
        self.stdout.write()
        self.stdout.write("=" * 60)
        self.stdout.write(self.style.SUCCESS("✅ Limpeza concluída!"))
        self.stdout.write("=" * 60)
        self.stdout.write()
        self.stdout.write("📋 Próximos passos:")
        self.stdout.write("1. Verifique se as chaves VAPID estão corretas no Render.com e Vercel")
        self.stdout.write("2. No navegador: F12 → Application → Clear site data")
        self.stdout.write("3. Acesse o frontend e permita notificações novamente")
        self.stdout.write()

