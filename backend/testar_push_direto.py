#!/usr/bin/env python
"""
Teste direto de push notification
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings')
django.setup()

from core.push_utils import send_push_notification
from core.models import PushSubscription

print("=" * 70)
print("🧪 TESTE DIRETO DE PUSH NOTIFICATION")
print("=" * 70)
print()

# Verificar subscriptions
subs = PushSubscription.objects.filter(active=True)
print(f"📱 Subscriptions ativas: {subs.count()}")

if subs.count() == 0:
    print("❌ Nenhuma subscription ativa! Não há para quem enviar.")
    exit(1)

for sub in subs:
    print(f"\n   Endpoint: {sub.endpoint[:60]}...")
    print(f"   p256dh: {sub.p256dh[:30]}...")
    print(f"   auth: {sub.auth[:30]}...")

print("\n" + "-" * 70)
print("📤 Enviando push notification de teste...")
print("-" * 70)

try:
    result = send_push_notification(
        title="🧪 Teste de Push Notification",
        message="Esta é uma notificação de teste do sistema",
        data={"type": "test", "timestamp": "2025-01-01"}
    )
    
    print(f"\n✅ Resultado:")
    print(f"   Enviados: {result.get('sent', 0)}")
    print(f"   Falhas: {result.get('failed', 0)}")
    if 'error' in result:
        print(f"   Erro: {result['error']}")
    
    if result.get('sent', 0) > 0:
        print("\n✅ Push notification enviada com sucesso!")
        print("   Verifique no navegador/celular se a notificação apareceu.")
    else:
        print("\n❌ Nenhuma push notification foi enviada.")
        print("   Verifique os logs acima para erros.")
        
except Exception as e:
    print(f"\n❌ Erro ao enviar: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)