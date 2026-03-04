#!/usr/bin/env python
"""
Script de Teste Rápido para o Sistema de Notificações
Execute: python testar_notificacoes.py
"""

import os
import sys
import django
from datetime import date, timedelta

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings')
django.setup()

from core.models import Product, Notification
from core.tasks import check_expiring_products_and_notify


def print_separator():
    print("=" * 60)


def testar_notificacoes():
    """Testa o sistema completo de notificações"""
    
    print_separator()
    print("🧪 TESTE DO SISTEMA DE NOTIFICAÇÕES")
    print_separator()
    
    # 1. Verificar se há produtos próximos da validade
    print("\n📦 Passo 1: Verificando produtos existentes...")
    today = date.today()
    produtos_criticos = Product.objects.filter(
        expiration_date__gte=today,
        expiration_date__lte=today + timedelta(days=7),
        quantity__gt=0
    )
    
    print(f"   ✅ Produtos críticos encontrados: {produtos_criticos.count()}")
    
    if produtos_criticos.count() == 0:
        print("\n   ⚠️  Nenhum produto crítico encontrado. Criando produto de teste...")
        
        # Criar produto de teste
        produto_teste = Product.objects.create(
            name="🔬 PRODUTO DE TESTE - Vencimento",
            price=10.00,
            quantity=5,
            expiration_date=today + timedelta(days=3)  # Vence em 3 dias
        )
        print(f"   ✅ Produto criado: {produto_teste.name}")
        print(f"      Vence em: {produto_teste.expiration_date} ({3} dias)")
    else:
        print("\n   Produtos que vencem nos próximos 7 dias:")
        for produto in produtos_criticos[:5]:  # Mostrar apenas os 5 primeiros
            dias = (produto.expiration_date - today).days
            print(f"      • {produto.name} - Vence em {dias} dia(s)")
    
    # 2. Executar a função de notificação
    print("\n📧 Passo 2: Executando verificação de notificações...")
    print_separator()
    
    try:
        resultado = check_expiring_products_and_notify()
        print(f"\n✅ Resultado: {resultado}")
    except Exception as e:
        print(f"\n❌ Erro ao executar notificação: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print_separator()
    
    # 3. Verificar notificações criadas
    print("\n📬 Passo 3: Verificando notificações criadas...")
    notificacoes = Notification.objects.all().order_by('-created_at')[:5]
    
    if notificacoes.exists():
        print(f"   ✅ {notificacoes.count()} notificação(ões) encontrada(s):\n")
        for notif in notificacoes:
            print(f"      📌 {notif.title}")
            print(f"         Mensagem: {notif.message[:80]}...")
            print(f"         Criada em: {notif.created_at.strftime('%d/%m/%Y %H:%M')}")
            print(f"         Lida: {'Sim' if notif.read else 'Não'}\n")
    else:
        print("   ⚠️  Nenhuma notificação encontrada.")
    
    # 4. Resumo final
    print_separator()
    print("\n📊 RESUMO DO TESTE:")
    print_separator()
    print(f"   ✅ Produtos críticos: {produtos_criticos.count()}")
    print(f"   ✅ Notificações criadas: {Notification.objects.count()}")
    print(f"   ✅ Notificações não lidas: {Notification.objects.filter(read=False).count()}")
    
    print("\n✅ Teste concluído!")
    print("\n💡 Próximos passos:")
    print("   1. Verifique o console onde o Django está rodando para ver o e-mail")
    print("   2. Acesse http://localhost:8000/admin/core/notification/ para ver as notificações")
    print("   3. Verifique se o QCluster está rodando: python manage.py qcluster")
    
    print_separator()
    return True


if __name__ == '__main__':
    try:
        testar_notificacoes()
    except KeyboardInterrupt:
        print("\n\n❌ Teste interrompido pelo usuário.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

