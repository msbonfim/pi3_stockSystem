#!/usr/bin/env python
"""
Script para gerar chaves VAPID para push notifications
Execute: python gerar_chaves_vapid.py
"""

import os
import sys
import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

def generate_vapid_keys():
    """Gera um par de chaves VAPID"""
    # Gera chave privada
    private_key = ec.generate_private_key(ec.SECP256R1())
    
    # Obtém chave pública
    public_key = private_key.public_key()
    
    # Serializa chave privada em PEM
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,  # MUDANÇA CRÍTICA AQUI
        encryption_algorithm=serialization.NoEncryption()
    )
    
    # Serializa chave pública em formato uncompressed point
    public_numbers = public_key.public_numbers()
    public_bytes = bytes([4])  # 0x04 indica formato uncompressed
    public_bytes += public_numbers.x.to_bytes(32, 'big')
    public_bytes += public_numbers.y.to_bytes(32, 'big')
    
    # Converte para base64 URL-safe
    public_base64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')
    
    return private_pem.decode('utf-8'), public_base64

def main():
    print("=" * 60)
    print("Geração de Chaves VAPID para Push Notifications")
    print("=" * 60)
    print()
    print("⚠️  SEGURANÇA: NUNCA commite chaves privadas no Git!")
    print()
    
    try:
        # Gera as chaves VAPID
        print("📋 Gerando chaves VAPID...")
        private_key_pem, public_key_b64 = generate_vapid_keys()
        
        print()
        print("✅ Chaves VAPID geradas com sucesso!")
        print()
        print("=" * 60)
        print("🔑 CHAVE PRIVADA (Backend - Render.com)")
        print("=" * 60)
        print()
        print("Copie esta chave COMPLETA e cole em Render.com → Environment Variables:")
        print("Key: VAPID_PRIVATE_KEY")
        print()
        print(private_key_pem)
        print()
        print("=" * 60)
        print("🔓 CHAVE PÚBLICA (Frontend - Vercel)")
        print("=" * 60)
        print()
        print("Copie esta chave e cole em Vercel → Environment Variables:")
        print("Key: VITE_VAPID_PUBLIC_KEY")
        print()
        print(public_key_b64)
        print()
        print("=" * 60)
        print("📋 PRÓXIMOS PASSOS")
        print("=" * 60)
        print()
        print("1. ✅ Render.com → Environment Variables:")
        print("   - Adicione: VAPID_PRIVATE_KEY = (chave privada acima)")
        print("   - Adicione: VAPID_EMAIL = mailto:seu-email@gmail.com")
        print()
        print("2. ✅ Vercel → Environment Variables:")
        print("   - Adicione: VITE_VAPID_PUBLIC_KEY = (chave pública acima)")
        print()
        print("3. ✅ Limpe subscriptions antigas:")
        print("   - Django Admin → /admin/core/pushsubscription/ → Delete todas")
        print("   - Navegador: F12 → Application → Clear site data")
        print()
        print("4. ✅ Redeploy:")
        print("   - Render.com: O serviço vai reiniciar automaticamente")
        print("   - Vercel: Faça redeploy manual se necessário")
        print()
        print("5. ✅ Recrie subscriptions:")
        print("   - Acesse o frontend e permita notificações novamente")
        print()
        print("⚠️  IMPORTANTE: NÃO salve essas chaves em arquivos!")
        print("   Use apenas variáveis de ambiente.")
        print()
        
    except Exception as e:
        print(f"❌ Erro ao gerar chaves: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
