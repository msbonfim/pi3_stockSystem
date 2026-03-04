#!/usr/bin/env python
"""
Script para testar notificações desktop do Windows
Execute: python testar_notificacao_desktop.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings')
django.setup()

from core.push_utils import send_desktop_notification, DESKTOP_NOTIFICATIONS_AVAILABLE

print("=" * 60)
print("Teste de Notificação Desktop")
print("=" * 60)

if not DESKTOP_NOTIFICATIONS_AVAILABLE:
    print("\n❌ Notificações desktop não estão disponíveis!")
    print("   Certifique-se de que está rodando no Windows e que winotify está instalado.")
    exit(1)

print()

# Teste 1: Notificação normal
print("📋 Teste 1: Notificação Normal")
result1 = send_desktop_notification(
    title="🔔 Teste de Notificação",
    message="Esta é uma notificação de teste normal. Deve aparecer no canto da tela por 10 segundos.",
    duration=10,
    urgency='normal'
)
print(f"   Resultado: {'✅ Enviada!' if result1.get('sent') else '❌ Falhou'}")
if result1.get('error'):
    print(f"   Erro: {result1.get('error')}")
print()

# Teste 2: Notificação crítica
print("📋 Teste 2: Notificação Crítica (15 segundos)")
result2 = send_desktop_notification(
    title="⚠️ Alerta Crítico: 5 produto(s) próximo(s) da validade",
    message="5 produto(s) vence(m) nos próximos 7 dias! Ação urgente necessária.",
    duration=15,
    urgency='critical'
)
print(f"   Resultado: {'✅ Enviada!' if result2.get('sent') else '❌ Falhou'}")
if result2.get('error'):
    print(f"   Erro: {result2.get('error')}")
print()

# Teste 3: Notificação com produtos específicos
print("📋 Teste 3: Notificação com Lista de Produtos")
result3 = send_desktop_notification(
    title="🚨 Alerta: Produtos Próximos da Validade",
    message="Produto A, Produto B, Produto C e mais 2 produto(s). 5 produto(s) vence(m) nos próximos 7 dias!",
    duration=15,
    urgency='critical'
)
print(f"   Resultado: {'✅ Enviada!' if result3.get('sent') else '❌ Falhou'}")
if result3.get('error'):
    print(f"   Erro: {result3.get('error')}")
print()

print("=" * 60)
print("✅ Testes concluídos!")
print()
print("💡 Verifique se as notificações apareceram no canto inferior direito da tela.")
print("   Se não apareceram, verifique se:")
print("   - As notificações do Windows estão habilitadas")
print("   - O sistema está rodando no Windows 10/11")
print("=" * 60)

