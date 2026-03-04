#!/usr/bin/env python
"""
Script de diagnóstico completo para sistema de notificações
Execute: python diagnosticar_notificacoes.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings')
django.setup()

from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from core.models import Product, Notification, PushSubscription
from django_q.models import Schedule, Success, Failure, OrmQ
from django.contrib.auth.models import User
import logging

logger = logging.getLogger(__name__)

print("=" * 70)
print("🔍 DIAGNÓSTICO COMPLETO DO SISTEMA DE NOTIFICAÇÕES")
print("=" * 70)
print()

# 1. Verificar Configurações
print("📋 1. VERIFICANDO CONFIGURAÇÕES")
print("-" * 70)

# VAPID
vapid_key = getattr(settings, 'VAPID_PRIVATE_KEY', None)
if vapid_key:
    print("✅ VAPID_PRIVATE_KEY: Configurada")
    print(f"   Tamanho: {len(vapid_key)} bytes")
    print(f"   Formato PEM: {vapid_key.strip().startswith('-----BEGIN')}")
else:
    print("❌ VAPID_PRIVATE_KEY: NÃO configurada")

# Email
notification_emails = getattr(settings, 'NOTIFICATION_EMAILS', None)
if notification_emails and notification_emails != ['admin@example.com']:
    print(f"✅ NOTIFICATION_EMAILS: {notification_emails}")
else:
    print("❌ NOTIFICATION_EMAILS: NÃO configurado ou está no padrão")

email_backend = getattr(settings, 'EMAIL_BACKEND', None)
email_host = getattr(settings, 'EMAIL_HOST', None)
print(f"📧 EMAIL_BACKEND: {email_backend}")
if email_backend and 'smtp' in email_backend:
    print(f"   EMAIL_HOST: {email_host}")
    print(f"   EMAIL_HOST_USER: {getattr(settings, 'EMAIL_HOST_USER', 'NÃO configurado')}")

print()

# 2. Verificar Schedules
print("📅 2. VERIFICANDO AGENDAMENTOS (SCHEDULES)")
print("-" * 70)

schedules = Schedule.objects.all()
print(f"Total de schedules: {schedules.count()}")

if schedules.count() == 0:
    print("⚠️  NENHUM SCHEDULE ENCONTRADO!")
    print("   Crie um schedule com: python manage.py create_notification_schedule")
else:
    for schedule in schedules:
        print(f"\n📌 Schedule: {schedule.name}")
        print(f"   Função: {schedule.func}")
        print(f"   Tipo: {schedule.get_schedule_type_display()}")
        print(f"   Repetições: {schedule.repeats} ({'Infinito' if schedule.repeats == -1 else 'Limitado'})")
        
        if schedule.next_run:
            local_next = timezone.localtime(schedule.next_run)
            now = timezone.localtime(timezone.now())
            print(f"   Próxima execução: {local_next.strftime('%d/%m/%Y %H:%M:%S')}")
            if local_next > now:
                print(f"   Status: ✅ Ativo (executará em {(local_next - now).total_seconds() / 60:.1f} minutos)")
            else:
                print(f"   Status: ⚠️  Passado ({abs((local_next - now).total_seconds() / 60):.1f} minutos atrás)")
                print(f"   ⚠️  A próxima execução está no passado! O schedule pode não estar funcionando.")
        else:
            print(f"   Status: ❌ Sem próxima execução agendada")

print()

# 3. Verificar Tarefas na Fila
print("📦 3. VERIFICANDO TAREFAS NA FILA (ORMQ)")
print("-" * 70)

tasks_in_queue = OrmQ.objects.all()
print(f"Total de tarefas na fila: {tasks_in_queue.count()}")

if tasks_in_queue.count() > 0:
    print("\nÚltimas 5 tarefas:")
    for task in tasks_in_queue.order_by('-id')[:5]:
        print(f"   - {task.name or task.func} (ID: {task.id})")
        print(f"     Criada: {task.created.strftime('%d/%m/%Y %H:%M:%S')}")

print()

# 4. Verificar Execuções Recentes
print("✅ 4. VERIFICANDO EXECUÇÕES RECENTES (SUCCESS)")
print("-" * 70)

recent_successes = Success.objects.all().order_by('-stopped')[:5]
print(f"Total de execuções bem-sucedidas: {Success.objects.count()}")

if recent_successes:
    print("\nÚltimas 5 execuções bem-sucedidas:")
    for success in recent_successes:
        local_stopped = timezone.localtime(success.stopped) if success.stopped else None
        print(f"   - {success.name or success.func}")
        print(f"     Tempo: {local_stopped.strftime('%d/%m/%Y %H:%M:%S') if local_stopped else 'N/A'}")
        if success.result:
            result_str = str(success.result)
            if len(result_str) > 100:
                result_str = result_str[:100] + "..."
            print(f"     Resultado: {result_str}")
else:
    print("⚠️  NENHUMA EXECUÇÃO BEM-SUCEDIDA RECENTE!")
    print("   O schedule pode não estar sendo executado.")

print()

# 5. Verificar Falhas
print("❌ 5. VERIFICANDO FALHAS (FAILURE)")
print("-" * 70)

recent_failures = Failure.objects.all().order_by('-stopped')[:5]
print(f"Total de falhas: {Failure.objects.count()}")

if recent_failures:
    print("\n⚠️  Últimas 5 falhas:")
    for failure in recent_failures:
        local_stopped = timezone.localtime(failure.stopped) if failure.stopped else None
        print(f"   - {failure.name or failure.func}")
        print(f"     Tempo: {local_stopped.strftime('%d/%m/%Y %H:%M:%S') if local_stopped else 'N/A'}")
        if failure.result:
            error_str = str(failure.result)
            if len(error_str) > 200:
                error_str = error_str[:200] + "..."
            print(f"     Erro: {error_str}")
else:
    print("✅ Nenhuma falha recente registrada")

print()

# 6. Verificar Produtos que Deveriam Gerar Notificações
print("📦 6. VERIFICANDO PRODUTOS QUE DEVERIAM GERAR NOTIFICAÇÕES")
print("-" * 70)

today = timezone.now().date()

# Produtos críticos (0-7 dias)
critical_limit = today + timedelta(days=7)
critical_products = Product.objects.filter(
    expiration_date__gte=today,
    expiration_date__lte=critical_limit,
    quantity__gt=0
)

# Produtos em aviso (8-30 dias)
warning_limit = today + timedelta(days=30)
warning_products = Product.objects.filter(
    expiration_date__gt=critical_limit,
    expiration_date__lte=warning_limit,
    quantity__gt=0
)

# Estoque baixo
low_stock_products = Product.objects.filter(quantity__gt=0, quantity__lt=2)

print(f"Produtos críticos (0-7 dias): {critical_products.count()}")
if critical_products.count() > 0:
    print("   Produtos:")
    for p in critical_products[:5]:
        days = (p.expiration_date - today).days
        print(f"     - {p.name}: vence em {days} dias (qtd: {p.quantity})")

print(f"\nProdutos em aviso (8-30 dias): {warning_products.count()}")
if warning_products.count() > 0:
    print("   Produtos:")
    for p in warning_products[:5]:
        days = (p.expiration_date - today).days
        print(f"     - {p.name}: vence em {days} dias (qtd: {p.quantity})")

print(f"\nProdutos com estoque baixo (< 2): {low_stock_products.count()}")
if low_stock_products.count() > 0:
    print("   Produtos:")
    for p in low_stock_products[:5]:
        print(f"     - {p.name}: {p.quantity} unidade(s)")

if critical_products.count() == 0 and warning_products.count() == 0 and low_stock_products.count() == 0:
    print("\n⚠️  NENHUM PRODUTO ENCONTRADO QUE DEVERIA GERAR NOTIFICAÇÃO")
    print("   O sistema está funcionando, mas não há produtos que atendam aos critérios.")

print()

# 7. Verificar Notificações Criadas
print("📬 7. VERIFICANDO NOTIFICAÇÕES NO BANCO")
print("-" * 70)

recent_notifications = Notification.objects.all().order_by('-created_at')[:10]
print(f"Total de notificações: {Notification.objects.count()}")
print(f"Lidas: {Notification.objects.filter(read=True).count()}")
print(f"Não lidas: {Notification.objects.filter(read=False).count()}")

if recent_notifications:
    print("\nÚltimas 10 notificações:")
    for notif in recent_notifications:
        local_created = timezone.localtime(notif.created_at) if notif.created_at else None
        print(f"   - [{notif.notification_type}] {notif.title}")
        print(f"     Criada: {local_created.strftime('%d/%m/%Y %H:%M:%S') if local_created else 'N/A'}")
        print(f"     Lida: {'Sim' if notif.read else 'Não'}")
else:
    print("⚠️  NENHUMA NOTIFICAÇÃO CRIADA!")

print()

# 8. Verificar Push Subscriptions
print("📱 8. VERIFICANDO PUSH SUBSCRIPTIONS")
print("-" * 70)

active_subscriptions = PushSubscription.objects.filter(active=True)
print(f"Total de subscriptions ativas: {active_subscriptions.count()}")

all_subscriptions = PushSubscription.objects.all()
print(f"Total de subscriptions (todas): {all_subscriptions.count()}")

if active_subscriptions.count() == 0:
    print("⚠️  NENHUMA SUBSCRIPTION ATIVA!")
    print("   As push notifications não serão enviadas até que alguém se inscreva.")

print()

# 9. Teste Manual da Task
print("🧪 9. TESTE MANUAL DA TASK")
print("-" * 70)

resposta = input("Deseja executar a task manualmente agora? (s/N): ")
if resposta.lower() == 's':
    try:
        from core.tasks import check_expiring_products_and_notify
        print("\nExecutando task...")
        result = check_expiring_products_and_notify()
        print(f"\n✅ Resultado: {result}")
        print("\nVerifique:")
        print("  - Se uma notificação foi criada no banco")
        print("  - Se um e-mail foi enviado (ou apareceu no console)")
        print("  - Se push notification foi enviada")
    except Exception as e:
        print(f"\n❌ Erro ao executar task: {e}")
        import traceback
        traceback.print_exc()
else:
    print("Teste manual pulado.")

print()

# 10. Diagnóstico Final
print("=" * 70)
print("📊 DIAGNÓSTICO FINAL")
print("=" * 70)

issues = []

if not vapid_key:
    issues.append("❌ VAPID_PRIVATE_KEY não configurada")
if not notification_emails or notification_emails == ['admin@example.com']:
    issues.append("❌ NOTIFICATION_EMAILS não configurado")
if schedules.count() == 0:
    issues.append("❌ Nenhum schedule criado")
elif any(s.next_run and timezone.localtime(s.next_run) <= timezone.localtime(timezone.now()) for s in schedules):
    issues.append("⚠️  Algum schedule tem próxima execução no passado")
if recent_successes.count() == 0:
    issues.append("⚠️  Nenhuma execução bem-sucedida recente (QCluster pode não estar rodando)")
if critical_products.count() == 0 and warning_products.count() == 0:
    issues.append("ℹ️  Nenhum produto próximo da validade encontrado (pode ser normal)")
if active_subscriptions.count() == 0:
    issues.append("ℹ️  Nenhuma subscription ativa para push notifications (pode ser normal)")

if issues:
    print("\n⚠️  PROBLEMAS ENCONTRADOS:")
    for issue in issues:
        print(f"   {issue}")
else:
    print("\n✅ Tudo parece estar configurado corretamente!")

print("\n💡 AÇÕES RECOMENDADAS:")
print("   1. Verifique se o QCluster está rodando: python manage.py qcluster")
print("   2. Se schedules têm execução no passado, edite-os no admin")
print("   3. Execute o teste manual acima para verificar")
print("   4. Verifique os logs do QCluster em tempo real")

print("\n" + "=" * 70)