#!/usr/bin/env python
"""
Comando para testar push notifications diretamente
Execute: python manage.py test_push_notification
"""

from django.core.management.base import BaseCommand
from core.push_utils import send_push_notification
from core.models import PushSubscription


class Command(BaseCommand):
    help = 'Testa envio de push notification diretamente'

    def handle(self, *args, **options):
        self.stdout.write("=" * 70)
        self.stdout.write(self.style.SUCCESS("🧪 TESTE DE PUSH NOTIFICATION"))
        self.stdout.write("=" * 70)
        self.stdout.write()
        
        # Verifica subscriptions
        total = PushSubscription.objects.count()
        active = PushSubscription.objects.filter(active=True).count()
        
        self.stdout.write(f"📊 Subscriptions:")
        self.stdout.write(f"   Total: {total}")
        self.stdout.write(f"   Ativas: {active}")
        self.stdout.write()
        
        if active == 0:
            self.stdout.write(self.style.ERROR("❌ PROBLEMA: Nenhuma subscription ativa!"))
            self.stdout.write()
            self.stdout.write("💡 SOLUÇÃO:")
            self.stdout.write("1. No navegador: F12 → Application → Clear site data")
            self.stdout.write("2. Acesse o frontend e permita notificações")
            self.stdout.write("3. Verifique se a subscription foi criada em /admin/core/pushsubscription/")
            return
        
        # Lista subscriptions
        self.stdout.write("📋 Subscriptions ativas:")
        for sub in PushSubscription.objects.filter(active=True):
            self.stdout.write(f"   - ID: {sub.id}, Endpoint: {sub.endpoint[:50]}...")
        self.stdout.write()
        
        # Testa envio
        self.stdout.write("🚀 Enviando push notification de teste...")
        self.stdout.write()
        
        try:
            result = send_push_notification(
                title="🧪 Teste de Notificação",
                message="Esta é uma notificação de teste!",
                data={"type": "test"}
            )
            
            self.stdout.write()
            self.stdout.write("=" * 70)
            self.stdout.write(self.style.SUCCESS("✅ RESULTADO DO TESTE"))
            self.stdout.write("=" * 70)
            self.stdout.write(f"Enviadas: {result.get('sent', 0)}")
            self.stdout.write(f"Falhas: {result.get('failed', 0)}")
            if 'error' in result:
                self.stdout.write(self.style.ERROR(f"Erro: {result['error']}"))
            self.stdout.write()
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Erro ao enviar: {e}"))
            import traceback
            traceback.print_exc()

