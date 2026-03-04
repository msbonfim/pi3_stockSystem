#!/usr/bin/env python
"""
Script de PREPARAÇÃO para o Ambiente de Desenvolvimento.

Este script irá:
1. Garantir que está sendo executado dentro do ambiente virtual (venv).
2. Instalar/atualizar dependências e rodar migrações (opcional).
3. Sincronizar chaves VAPID.
4. Gerar os scripts de inicialização (.bat) para cada serviço.
"""

import os
import time
from pathlib import Path
import sys
import subprocess
import shutil
import platform

def run_in_new_terminal(command, title):
    """
    Executa um comando em um novo terminal, de forma robusta para cada SO.
    """
    system = platform.system()
    print(f"🚀 Iniciando '{title}'...")
    
    if system == "Windows":
        # No Windows, 'start' abre um novo terminal. O comando é o caminho para o .bat.
        os.system(f'start "{title}" "{command}"')
    elif system == "Darwin":  # macOS
        os.system(f'''
            osascript -e 'tell app "Terminal" to do script "cd \\"{os.path.dirname(command)}\\" && ./{os.path.basename(command)}"'
        ''')
    elif system == "Linux":
        try:
            os.system(f'gnome-terminal --title="{title}" -- bash -c "cd \\"{os.path.dirname(command)}\\" && ./{os.path.basename(command)}; exec bash"')
        except Exception:
            os.system(f'xterm -T "{title}" -e "cd \\"{os.path.dirname(command)}\\" && ./{os.path.basename(command)}; exec bash"')
    else:
        print(f"❌ Sistema operacional '{system}' não suportado para abertura automática de terminais.")
        return
    print(f"✅ '{title}' iniciado em um novo terminal.")

def main():
    """
    Função principal que orquestra o início dos serviços.
    """
    # --- Caminhos e Comandos ---
    project_root = Path(__file__).resolve().parent
    backend_dir = project_root / 'backend'
    frontend_dir = project_root / 'frontend'
    venv_folder = backend_dir / 'venv'
    
    # Determina o executável do Python dentro do venv
    if sys.platform == "win32":
        python_executable = venv_folder / 'Scripts' / 'python.exe'
    else: # Linux/macOS
        python_executable = venv_folder / 'bin' / 'python'

    def rebuild_venv():
        print("🔥 Reconstruindo o ambiente virtual (venv)...")
        if venv_folder.exists():
            print(f"   Removendo pasta venv existente: {venv_folder}")
            try:
                shutil.rmtree(venv_folder)
            except PermissionError as e:
                print(f"\n❌ ERRO DE PERMISSÃO: {e}")
                print("   Isso geralmente acontece se o venv que você está tentando excluir ainda está ativo em outro terminal (ou neste).")
                print("   Feche todos os terminais, certifique-se de que não está no venv e tente novamente.")
                return
        print("   Criando novo venv...")
        subprocess.run([sys.executable, "-m", "venv", str(venv_folder)], check=True)
        print("✅ Ambiente virtual reconstruído com sucesso.")
        # Força a reinstalação das dependências
        (backend_dir / ".last_pip_install").unlink(missing_ok=True)

    if '--rebuild-venv' in sys.argv:
        rebuild_venv()
        print("\n👉 Agora, execute 'python iniciar_servicos.py' novamente para instalar as dependências e iniciar.")
        return

    # --- Passo -1: Verificar e Criar o VENV se não existir ---
    if not python_executable.exists():
        print("🔎 Ambiente virtual (venv) não encontrado.")
        rebuild_venv()
        print("   A próxima etapa irá instalar as dependências. Isso pode levar um momento...")

    # --- Passo 0: Garantir que estamos no VENV ---
    if sys.executable.lower() != str(python_executable).lower():
        print("⚠️  Não estamos no ambiente virtual (venv). Executando o script dentro do venv...")
        result = subprocess.run([str(python_executable), __file__] + sys.argv[1:])
        
        if result.returncode == 0:
            print("\n✅ Script concluído com sucesso.")
        else:
            print("\n❌ Script encontrou um erro.")
        return # Finaliza o script original.

    print("=" * 70)
    print("🚀 Orquestrador de Serviços do StockSystem (executando no venv)")
    
    # --- Passo 1: Instalar Dependências ---
    print("\nPASSO 1: Verificando dependências do backend...")
    requirements_path = backend_dir / "requirements.txt"
    last_install_path = backend_dir / ".last_pip_install"
    
    try:
        # Tenta importar um pacote chave para ver se o venv está saudável.
        subprocess.check_call([str(python_executable), "-c", "import django"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        venv_is_healthy = True
    except subprocess.CalledProcessError:
        venv_is_healthy = False
        print("   ⚠️  Ambiente virtual parece corrompido. Forçando reinstalação de dependências.")

    install_needed = True
    if venv_is_healthy and last_install_path.exists() and requirements_path.exists():
        last_install_time = last_install_path.stat().st_mtime
        reqs_last_modified_time = requirements_path.stat().st_mtime
        if last_install_time >= reqs_last_modified_time:
            install_needed = False
            print("   Dependências já estão atualizadas.")
    
    if install_needed:
        print("   Instalando/atualizando dependências...")
        # Usa o caminho absoluto para o python do venv para garantir.
        result = subprocess.run([str(python_executable), "-m", "pip", "install", "-r", str(requirements_path)], check=False)
        if result.returncode != 0:
            print("\n❌ Erro ao instalar dependências. Abortando.")
            return
        # Cria/atualiza o arquivo de timestamp
        last_install_path.touch()
        print("   Dependências instaladas com sucesso.")

    # --- Passo 2: Banco de Dados - Migrações ---
    print("\nPASSO 2: Banco de Dados - Migrações")
    escolha_migracoes = input("Deseja verificar e aplicar as migrações (makemigrations e migrate)? (s/N): ").strip().lower()
    
    if escolha_migracoes == 's':
        print("   2.1: Verificando alterações nos modelos (makemigrations)...")
        res_make = subprocess.run(
            [str(python_executable), "manage.py", "makemigrations"], 
            cwd=backend_dir, 
            capture_output=True, 
            text=True
        )
        
        # Mostra o resultado do makemigrations de forma limpa
        if "No changes detected" in res_make.stdout:
            print("   ℹ️  Nenhuma mudança detectada nos modelos.")
        else:
            print(f"   ✅ Novas migrações geradas:\n{res_make.stdout.strip()}")
        
        print("\n   2.2: Aplicando ao banco de dados (migrate)...")
        result_migrate = subprocess.run([str(python_executable), "manage.py", "migrate"], cwd=backend_dir, check=False)
        if result_migrate.returncode != 0:
            print("\n❌ Erro ao executar migrações. Verifique o log e tente novamente.")
            print("   Se o problema persistir, execute 'python iniciar_servicos.py --rebuild-venv'.")
            return
        print("   ✅ Migrações aplicadas com sucesso.")
    else:
        print("   ➡️  Pulando a etapa de migrações.")

    # --- Passo 3: Chaves VAPID ---
    print("=" * 70)
    print("\n--- Gerenciamento de Chaves VAPID ---")
    choice = input("Deseja executar o gerenciador de chaves VAPID? (s/N): ").strip().lower()
    
    if choice == 's':
        print("\nPASSO 3: Executando gerenciador de chaves...")
        key_manager_script = project_root / 'gerenciar_chaves_vapid.py'
        subprocess.run([str(python_executable), str(key_manager_script)], check=False)
    else:
        print("\n➡️  Pulando a geração de chaves. Usando as chaves existentes.")

    # --- Passo FINAL: Gerar Scripts de Lançamento ---
    print("\nPASSO FINAL: Gerando scripts de inicialização...")

    # Script para o Backend (Django)
    with open(project_root / "1-iniciar-backend.bat", "w") as f:
        f.write(f"@echo off\n")
        f.write(f"echo --- INICIANDO SERVIDOR DJANGO ---\n")
        f.write(f"cd /d {backend_dir}\n")
        f.write(f"call .\\venv\\Scripts\\activate\n")
        f.write(f"python manage.py runserver --noreload\n")
        f.write(f"pause\n")

    # Script para o QCluster
    with open(project_root / "2-iniciar-qcluster.bat", "w") as f:
        f.write(f"@echo off\n")
        f.write(f"echo --- INICIANDO QCLUSTER (TAREFAS) ---\n")
        f.write(f"cd /d {backend_dir}\n")
        f.write(f"call .\\venv\\Scripts\\activate\n")
        f.write(f"python manage.py qcluster\n")
        f.write(f"pause\n")

    # Script para o Frontend
    with open(project_root / "3-iniciar-frontend.bat", "w") as f:
        f.write(f"@echo off\n")
        f.write(f"echo --- INICIANDO FRONTEND (VITE) ---\n")
        f.write(f"cd /d {frontend_dir}\n")
        f.write(f"npm run dev\n")
        f.write(f"pause\n")
    
    # --- Passo FINAL AUTOMÁTICO: Iniciar os servidores ---
    print("\n" + "=" * 70)
    print("🚀 INICIANDO SERVIÇOS AUTOMATICAMENTE...")
    print("   Aguarde a abertura das novas janelas de terminal.")
    print("=" * 70)

    # Executa os scripts .bat que acabamos de criar
    run_in_new_terminal(str(project_root / "1-iniciar-backend.bat"), "Backend (Django)")
    time.sleep(2) # Pausa para não sobrecarregar o sistema
    run_in_new_terminal(str(project_root / "2-iniciar-qcluster.bat"), "QCluster (Tarefas)")
    time.sleep(2)
    run_in_new_terminal(str(project_root / "3-iniciar-frontend.bat"), "Frontend (Vite)")

    print("\n" + "=" * 70)
    print("🎉 Todos os serviços foram iniciados em seus próprios terminais!")
    print("   Para encerrar, feche cada uma das janelas abertas.")
    print("=" * 70)

if __name__ == "__main__":
    main()