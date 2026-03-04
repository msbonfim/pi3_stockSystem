#!/usr/bin/env python
"""
Comando para diagnosticar e corrigir problemas de push notifications de uma vez
Execute: python manage.py fix_push_notifications
"""

from django.core.management.base import BaseCommand
from django.conf import settings
from core.models import PushSubscription
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


class Command(BaseCommand):
    help = 'Diagnostica e corrige problemas de push notifications automaticamente'

    def handle(self, *args, **options):
        self.stdout.write("=" * 70)
        self.stdout.write(self.style.SUCCESS("🔧 DIAGNÓSTICO E CORREÇÃO DE PUSH NOTIFICATIONS"))
        self.stdout.write("=" * 70)
        self.stdout.write()
        
        # 1. Verifica chave privada
        self.stdout.write("📋 PASSO 1: Verificando chave privada VAPID...")
        vapid_private_key = getattr(settings, 'VAPID_PRIVATE_KEY', None)
        
        if not vapid_private_key or not vapid_private_key.strip():
            self.stdout.write(self.style.ERROR("   ❌ VAPID_PRIVATE_KEY não configurada!"))
            self.stdout.write(self.style.WARNING("   → Configure em Render.com → Environment Variables"))
            return
        
        if not vapid_private_key.strip().startswith('-----BEGIN'):
            self.stdout.write(self.style.ERROR("   ❌ VAPID_PRIVATE_KEY em formato inválido!"))
            return
        
        try:
            private_key = serialization.load_pem_private_key(
                vapid_private_key.encode('utf-8'),
                password=None
            )
            public_key = private_key.public_key()
            public_numbers = public_key.public_numbers()
            public_bytes = bytes([4]) + public_numbers.x.to_bytes(32, 'big') + public_numbers.y.to_bytes(32, 'big')
            public_key_base64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')
            
            self.stdout.write(self.style.SUCCESS("   ✅ Chave privada válida"))
            self.stdout.write(f"   📌 Chave pública correspondente: {public_key_base64[:50]}...")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"   ❌ Erro ao validar chave: {e}"))
            return
        
        # 2. Verifica subscriptions
        self.stdout.write()
        self.stdout.write("📋 PASSO 2: Verificando subscriptions...")
        total_subscriptions = PushSubscription.objects.count()
        active_subscriptions = PushSubscription.objects.filter(active=True).count()
        
        self.stdout.write(f"   Total: {total_subscriptions}")
        self.stdout.write(f"   Ativas: {active_subscriptions}")
        
        if active_subscriptions == 0:
            self.stdout.write(self.style.SUCCESS("   ✅ Nenhuma subscription ativa - pode criar novas!"))
            self.stdout.write()
            self.stdout.write("   📋 Próximos passos:")
            self.stdout.write(f"   1. Vercel → VITE_VAPID_PUBLIC_KEY = {public_key_base64}")
            self.stdout.write("   2. Navegador: F12 → Application → Clear site data")
            self.stdout.write("   3. Acesse o frontend e permita notificações")
            return
        
        # 3. Pergunta se quer limpar
        self.stdout.write()
        self.stdout.write(self.style.WARNING("⚠️  PROBLEMA DETECTADO:"))
        self.stdout.write("   As subscriptions ativas foram criadas com uma chave diferente!")
        self.stdout.write("   Isso causa erro 403 Forbidden.")
        self.stdout.write()
        
        resposta = input("   Deseja DELETAR todas as subscriptions para recriar? (s/N): ")
        
        if resposta.lower() == 's':
            deleted = PushSubscription.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f"   ✅ {deleted} subscription(s) deletada(s)"))
            self.stdout.write()
            self.stdout.write("=" * 70)
            self.stdout.write(self.style.SUCCESS("✅ CORREÇÃO APLICADA"))
            self.stdout.write("=" * 70)
            self.stdout.write()
            self.stdout.write("📋 PRÓXIMOS PASSOS:")
            self.stdout.write()
            self.stdout.write("1. ✅ Verifique chaves no Vercel:")
            self.stdout.write(f"   VITE_VAPID_PUBLIC_KEY deve ser: {public_key_base64}")
            self.stdout.write()
            self.stdout.write("2. ✅ No navegador:")
            self.stdout.write("   - F12 → Application → Service Workers → Unregister")
            self.stdout.write("   - Application → Storage → Clear site data")
            self.stdout.write()
            self.stdout.write("3. ✅ Acesse o frontend e permita notificações novamente")
            self.stdout.write()
        else:
            self.stdout.write("   Operação cancelada.")
            self.stdout.write()
            self.stdout.write("   Para limpar manualmente:")
            self.stdout.write("   - Django Admin: /admin/core/pushsubscription/")
            self.stdout.write("   - Ou execute: python manage.py cleanup_invalid_subscriptions --all")

