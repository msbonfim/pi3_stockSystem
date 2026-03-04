#!/usr/bin/env python
"""
Script para automatizar a geração e atualização das chaves VAPID.

Este script irá:
1. Gerar um novo par de chaves VAPID (pública e privada) usando o script 'gerar_chaves_vapid.py'.
2. Inserir a chave privada diretamente no arquivo settings.py.
3. Inserir a chave pública diretamente no arquivo pushNotifications.ts do frontend.

Execute: python automatizar_chaves.py
"""

import os
import sys
from pathlib import Path

# Importa a função de geração de chaves do seu script existente
try:
    from gerar_chaves_vapid import generate_vapid_keys
except ImportError:
    print("❌ Erro: O arquivo 'gerar_chaves_vapid.py' não foi encontrado.")
    print("   Certifique-se de que este script está na mesma pasta que 'gerar_chaves_vapid.py'.")
    sys.exit(1)

# --- Definição dos Caminhos ---
BASE_DIR = Path(__file__).resolve().parent
SETTINGS_PY_PATH = BASE_DIR / 'sistema_gestao' / 'settings.py'
FRONTEND_DIR = BASE_DIR.parent / 'frontend'
PUSH_TS_PATH = FRONTEND_DIR / 'src' / 'services' / 'pushNotifications.ts'

def update_file_content(file_path: Path, pattern: str, replacement: str):
    """
    Lê um arquivo, substitui um texto exato (pattern) por um novo conteúdo e salva.
    Simplificado para usar busca direta em vez de Regex para ser infalível.
    """
    if not file_path.exists():
        print(f"⚠️  Aviso: Arquivo não encontrado em '{file_path}'. Pulando atualização.")
        return False

    try:
        content = file_path.read_text(encoding='utf-8')
        
        # Verifica se o padrão exato (PLACEHOLDER) foi encontrado
        if pattern not in content:
            print(f"⚠️  Aviso: Padrão '{pattern}' não encontrado em '{file_path.name}'.")
            print("   A estrutura do arquivo pode ter mudado. Verifique manualmente.")
            return False
            
        new_content = content.replace(pattern, replacement)
        file_path.write_text(new_content, encoding='utf-8')
        print(f"✅ Arquivo '{file_path.name}' atualizado com sucesso!")
        return True
    except Exception as e:
        print(f"❌ Erro ao atualizar o arquivo '{file_path.name}': {e}")
        return False

def main():
    print("=" * 70)
    print("🚀 Automatizando a Geração e Atualização de Chaves VAPID")
    print("=" * 70)
    
    # 1. Gerar novas chaves
    print("\n1. Gerando novo par de chaves VAPID...")
    private_key, public_key = generate_vapid_keys()
    
    if not private_key or not public_key:
        print("\nProcesso abortado devido a erro na geração de chaves.")
        sys.exit(1)
        
    print("   Chaves geradas com sucesso.")
    
    # 2. Atualizar settings.py com a chave privada E pública
    print("\n2. Atualizando chaves no backend (settings.py)...")
    
    sucesso_privada = update_file_content(SETTINGS_PY_PATH, 'PLACEHOLDER_PRIVATE_KEY', private_key)
    sucesso_publica_backend = update_file_content(SETTINGS_PY_PATH, 'PLACEHOLDER_PUBLIC_KEY', public_key)
    
    if not sucesso_privada or not sucesso_publica_backend:
        print("❌ Erro ao atualizar settings.py. Certifique-se de que os placeholders estão lá.")

    # 3. Atualizar pushNotifications.ts com a chave pública
    print("\n3. Atualizando a chave pública no frontend (pushNotifications.ts)...")
    
    if not update_file_content(PUSH_TS_PATH, 'PLACEHOLDER_PUBLIC_KEY', public_key):
        # Plano B: Criar um arquivo .env no frontend se a substituição falhar
        env_path = FRONTEND_DIR / '.env'
        print(f"⚠️  Substituição falhou. Criando/Atualizando arquivo '{env_path.name}' como fallback...")
        try:
            # Mantém conteúdo anterior do .env, atualizando apenas a chave VAPID
            env_content = ""
            if env_path.exists():
                linhas = env_path.read_text(encoding='utf-8').splitlines()
                linhas = [l for l in linhas if not l.startswith('VITE_VAPID_PUBLIC_KEY')]
                env_content = '\n'.join(linhas) + '\n' if linhas else ""
                
            env_content += f"VITE_VAPID_PUBLIC_KEY={public_key}\n"
            env_path.write_text(env_content, encoding='utf-8')
            print(f"✅ Arquivo '{env_path.name}' criado/atualizado com a chave pública.")
            print("   ℹ️  DICA: No seu código frontend, certifique-se de usar: import.meta.env.VITE_VAPID_PUBLIC_KEY")
        except Exception as e:
            print(f"❌ Falha ao criar .env: {e}")
    
    print("\n" + "=" * 70)
    print("🎉 Processo Concluído!")
    print("=" * 70)
    print("\n💡 Próximos Passos:")
    print("   1. Pare todos os servidores (Backend, QCluster, Frontend).")
    print("   2. Reinicie-os para que as novas chaves sejam carregadas.")
    print("\n   Lembre-se de reiniciar:")
    print("   - Servidor Django: python manage.py runserver")
    print("   - QCluster: python manage.py qcluster")
    print("   - Servidor Frontend: npm run dev (ou similar)")
    print("\n" + "=" * 70)

if __name__ == "__main__":
    main()