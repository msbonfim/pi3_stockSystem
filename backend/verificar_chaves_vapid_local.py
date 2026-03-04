#!/usr/bin/env python
"""
Script para verificar se as chaves VAPID do Render.com e Vercel correspondem
Execute localmente: python verificar_chaves_vapid_local.py
"""

import base64
from cryptography.hazmat.primitives import serialization

print("=" * 70)
print("🔍 VERIFICAÇÃO DE CHAVES VAPID")
print("=" * 70)
print()
print("📋 Cole a chave PRIVADA que está no Render.com:")
print("   (Cole a chave completa, incluindo BEGIN e END)")
print("   (Pressione Enter após colar tudo, depois Ctrl+Z e Enter no Windows)")
print()

# Lê a chave privada
lines = []
try:
    while True:
        line = input()
        lines.append(line)
except EOFError:
    pass

private_key_pem = '\n'.join(lines)

if not private_key_pem.strip() or 'BEGIN' not in private_key_pem:
    print("❌ Chave privada inválida ou não fornecida")
    exit(1)

try:
    # Carrega a chave privada
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode('utf-8'),
        password=None
    )
    
    # Extrai a chave pública
    public_key = private_key.public_key()
    public_numbers = public_key.public_numbers()
    public_bytes = bytes([4]) + public_numbers.x.to_bytes(32, 'big') + public_numbers.y.to_bytes(32, 'big')
    public_key_base64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')
    
    print()
    print("=" * 70)
    print("✅ CHAVE PÚBLICA CORRESPONDENTE")
    print("=" * 70)
    print()
    print("Esta é a chave que DEVE estar no Vercel:")
    print()
    print(public_key_base64)
    print()
    print("=" * 70)
    print("📋 PRÓXIMOS PASSOS")
    print("=" * 70)
    print()
    print("1. ✅ Vercel → Environment Variables → VITE_VAPID_PUBLIC_KEY")
    print("   Deve ser exatamente: " + public_key_base64)
    print()
    print("2. ✅ Django Admin → /admin/core/pushsubscription/")
    print("   Delete TODAS as subscriptions")
    print()
    print("3. ✅ Navegador: F12 → Application → Clear site data")
    print()
    print("4. ✅ Acesse o frontend e permita notificações novamente")
    print()
    
except Exception as e:
    print(f"❌ Erro: {e}")
    import traceback
    traceback.print_exc()

