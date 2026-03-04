#!/usr/bin/env python
"""
Script para testar a validade da VAPID_PRIVATE_KEY diretamente do settings.py.

Este script isola o problema, verificando se a chave pode ser lida
pela biblioteca de criptografia, eliminando outras variáveis.
"""

import os
import django
import sys

print("=" * 70)
print("🔑 TESTE DE VALIDADE DA CHAVE VAPID")
print("=" * 70)

try:
    # Configura o ambiente Django para acessar as configurações
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings')
    django.setup()

    from django.conf import settings
    from cryptography.hazmat.primitives import serialization

    print("\n1. Lendo a chave VAPID do arquivo settings.py...")
    vapid_private_key_str = getattr(settings, 'VAPID_PRIVATE_KEY', None)

    if not vapid_private_key_str or 'placeholder' in vapid_private_key_str:
        print("❌ FALHA: A variável VAPID_PRIVATE_KEY não está configurada ou contém um placeholder.")
        sys.exit(1)

    print(f"   Chave encontrada. Tamanho: {len(vapid_private_key_str)} bytes.")
    print(f"   Começa com: '{vapid_private_key_str[:30].strip()}...'")

    print("\n2. Tentando carregar (deserializar) a chave...")

    # Tenta carregar a chave. Esta é a operação que falha internamente.
    private_key_object = serialization.load_pem_private_key(
        vapid_private_key_str.encode("utf-8"), password=None
    )

    print("\n" + "=" * 70)
    print("✅ SUCESSO! A chave VAPID em settings.py é VÁLIDA.")
    print("   A biblioteca de criptografia conseguiu ler a chave corretamente.")
    print("=" * 70)

except ImportError:
    print("❌ FALHA: Bibliotecas necessárias (Django, cryptography) não encontradas.")
    sys.exit(1)
except Exception as e:
    print("\n" + "=" * 70)
    print(f"❌ FALHA: A chave VAPID em settings.py é INVÁLIDA ou está CORROMPIDA.")
    print(f"   Erro detalhado: {e}")
    print("=" * 70)
    sys.exit(1)