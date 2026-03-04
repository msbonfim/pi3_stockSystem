#!/usr/bin/env python
"""
Script para testar notificações de estoque baixo
Execute: python testar_estoque_baixo.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings')
django.setup()

from core.tasks import check_low_stock_and_notify
from core.models import Product, Category, Brand

print("=" * 60)
print("Teste de Notificações de Estoque Baixo")
print("=" * 60)
print()

# Verificar produtos existentes com estoque baixo
low_stock = Product.objects.filter(quantity__gt=0, quantity__lt=2)
print(f"📦 Produtos com menos de 2 unidades encontrados: {low_stock.count()}")
print()

if low_stock.count() > 0:
    print("Produtos encontrados:")
    for p in low_stock:
        print(f"  - {p.name}: {p.quantity} unidade(s)")
    print()

# Executar a task
print("🧪 Executando task de verificação...")
print("-" * 60)
try:
    result = check_low_stock_and_notify(min_quantity=2)
    print(result)
    print()
    print("=" * 60)
    print("✅ Teste concluído!")
    print()
    print("💡 Verifique:")
    print("   - Notificações criadas no banco (Django Admin)")
    print("   - E-mail enviado")
    print("   - Push notification (se subscriptions existirem)")
    print("   - Notificação desktop (se Windows)")
except Exception as e:
    print(f"❌ Erro: {e}")
    import traceback
    traceback.print_exc()

