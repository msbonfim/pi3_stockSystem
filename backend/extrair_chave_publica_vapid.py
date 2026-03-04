#!/usr/bin/env python
"""
Script para extrair a chave pública VAPID a partir da chave privada
Execute: python extrair_chave_publica_vapid.py
"""

import os
import sys
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

def extract_public_key_from_private_key(private_key_pem: str):
    """
    Extrai a chave pública VAPID a partir da chave privada PEM
    
    Args:
        private_key_pem: String com a chave privada em formato PEM
        
    Returns:
        String com a chave pública em formato base64 URL-safe
    """
    try:
        # Carrega a chave privada
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode('utf-8'),
            password=None
        )
        
        # Obtém a chave pública
        public_key = private_key.public_key()
        
        # Serializa em formato uncompressed point
        public_numbers = public_key.public_numbers()
        public_bytes = bytes([4])  # 0x04 = uncompressed format
        public_bytes += public_numbers.x.to_bytes(32, 'big')
        public_bytes += public_numbers.y.to_bytes(32, 'big')
        
        # Converte para base64 URL-safe
        public_base64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')
        
        return public_base64
        
    except Exception as e:
        print(f"❌ Erro ao extrair chave pública: {e}")
        return None

def main():
    print("=" * 60)
    print("Extrator de Chave Pública VAPID")
    print("=" * 60)
    print()
    
    # Tenta ler do arquivo private_key.pem se existir
    if os.path.exists('private_key.pem'):
        print("📁 Arquivo private_key.pem encontrado!")
        with open('private_key.pem', 'r') as f:
            private_key_pem = f.read()
        print("✅ Chave privada carregada do arquivo.\n")
    else:
        print("📝 Cole sua chave privada VAPID abaixo (formato PEM completo):")
        print("   (Pressione Enter após colar, depois Ctrl+D para finalizar no Linux/Mac ou Ctrl+Z+Enter no Windows)\n")
        
        lines = []
        try:
            while True:
                line = input()
                lines.append(line)
        except EOFError:
            pass
        
        private_key_pem = '\n'.join(lines)
        
        if not private_key_pem.strip():
            print("❌ Nenhuma chave fornecida.")
            return
    
    # Extrai a chave pública
    print("🔄 Extraindo chave pública...")
    public_key = extract_public_key_from_private_key(private_key_pem)
    
    if public_key:
        print()
        print("✅ Chave pública VAPID extraída com sucesso!")
        print()
        print("=" * 60)
        print("📋 Use esta chave no Vercel (frontend):")
        print("=" * 60)
        print()
        print(f"VITE_VAPID_PUBLIC_KEY={public_key}")
        print()
        print("=" * 60)
        
        # Salva em arquivo também
        with open('public_key_extracted.txt', 'w') as f:
            f.write(public_key)
        print("💾 Chave salva em: public_key_extracted.txt")
        print()
    else:
        print("❌ Falha ao extrair chave pública.")
        sys.exit(1)

if __name__ == '__main__':
    main()

