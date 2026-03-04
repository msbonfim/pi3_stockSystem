#!/usr/bin/env python
import sys
import subprocess
from pathlib import Path

def get_python_executable():
    project_root = Path(__file__).resolve().parent
    backend_dir = project_root / 'backend'
    if not backend_dir.exists():
        backend_dir = project_root
    if sys.platform == "win32":
        return backend_dir / 'venv' / 'Scripts' / 'python.exe'
    return backend_dir / 'venv' / 'bin' / 'python'

def run_command(executable, script):
    print(f"   Executando: {script.name}...")
    try:
        # A lista [] resolve o erro de sintaxe do Windows
        subprocess.run([str(executable), str(script)], cwd=script.parent, check=True)
        return True
    except subprocess.CalledProcessError:
        return False
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return False

def main():
    python_executable = get_python_executable()
    backend_dir = python_executable.parent.parent.parent

    print("=" * 70)
    print("🔧 Gerenciador de Chaves VAPID")
    print("=" * 70)

    while True:
        print("\nEscolha uma opção:")
        print("  1. Gerar e Sincronizar Novas Chaves VAPID")
        print("  2. Validar Chaves Atuais")
        print("  3. Sair")

        choice = input("\nDigite o número da sua escolha: ").strip()

        if choice == '1':
            print("\n--- Gerando e Sincronizando Novas Chaves ---")
            script_path = backend_dir / 'automatizar_chaves.py'
            if not run_command(python_executable, script_path):
                print("\n❌ Falha ao gerar e sincronizar as chaves.")
            else:
                print("\n✅ Chaves geradas e sincronizadas com sucesso!")
                print("\n--- Validando as Novas Chaves ---")
                test_script = backend_dir / 'testar_chave_vapid.py'
                run_command(python_executable, test_script)

        elif choice == '2':
            print("\n--- Validando Chaves Atuais ---")
            script_path = backend_dir / 'testar_chave_vapid.py'
            run_command(python_executable, script_path)

        elif choice == '3':
            break

if __name__ == "__main__":
    main()