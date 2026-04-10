#!/usr/bin/env python
"""
Script de PREPARAÇÃO para o Ambiente de Desenvolvimento.

Este script irá:
1. Garantir que está sendo executado dentro do ambiente virtual (venv).
2. Instalar/atualizar dependências e rodar migrações (opcional).
3. Subir Postgres + Metabase via Docker (docker compose) e aguardar o Metabase ficar pronto.
4. Sincronizar chaves VAPID.
5. Gerar os scripts de inicialização (.bat) para cada serviço.

Flags: --rebuild-venv | --skip-docker (pula Docker/Metabase)
"""

import json
import os
import time
import urllib.error
import urllib.request
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


def docker_cli_available() -> bool:
    return shutil.which("docker") is not None


def _docker_info_once(timeout_sec: int) -> tuple[bool, str]:
    """Uma chamada a `docker info`. Retorna (ok, mensagem_erro)."""
    try:
        docker_exe = shutil.which("docker")
        cmd = [docker_exe, "info"] if docker_exe else ["docker", "info"]
        r = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            encoding="utf-8",
            errors="replace",
        )
        if r.returncode == 0:
            return True, ""
        err = (r.stderr or r.stdout or "").strip()
        first = err.splitlines()[0] if err else "docker info falhou sem mensagem."
        return False, first
    except FileNotFoundError:
        return False, "comando 'docker' não encontrado."
    except subprocess.TimeoutExpired:
        return False, f"timeout após {timeout_sec}s (daemon ainda não respondeu)."
    except OSError as e:
        return False, str(e)


def wait_for_docker_engine(
    total_sec: int = 240,
    per_attempt_timeout: int = 90,
    pause_sec: float = 4.0,
) -> tuple[bool, str]:
    """
    Espera o daemon responder. No Windows o primeiro `docker info` após abrir o
    Desktop pode levar 1–2 minutos; um único timeout curto falha à toa.
    """
    env_total = os.environ.get("DOCKER_ENGINE_WAIT_SEC")
    if env_total:
        try:
            total_sec = max(30, int(env_total))
        except ValueError:
            pass

    deadline = time.monotonic() + total_sec
    attempt = 0
    last_err = ""
    is_win = platform.system() == "Windows"

    if is_win:
        print(
            f"   (Pode levar até alguns minutos após o Docker Desktop abrir; "
            f"limite total ~{total_sec}s. Opcional: defina DOCKER_ENGINE_WAIT_SEC.)"
        )

    while time.monotonic() < deadline:
        attempt += 1
        ok, err = _docker_info_once(per_attempt_timeout)
        if ok:
            if attempt > 1:
                print(f"   ✅ Docker respondeu na tentativa {attempt}.")
            return True, ""
        last_err = err
        if is_win and attempt == 1 and "timeout" in err.lower():
            print(
                "   ⏳ Primeira chamada ao daemon demorou; novas tentativas até o engine ficar pronto..."
            )
        # Ainda há tempo?
        if time.monotonic() + pause_sec >= deadline:
            break
        time.sleep(pause_sec)

    return False, last_err or "timeout total aguardando o Docker."


def print_docker_desktop_windows_help() -> None:
    """Orientações quando o engine não está disponível no Windows."""
    print("   ")
    print("   O motor do Docker não está ativo. Isso costuma ser Docker Desktop, não o projeto.")
    print("   Tente nesta ordem:")
    print("   1) Abra o **Docker Desktop** e espere o ícone parar de animar (Engine running).")
    print("   2) Se não abrir: reinicie o Docker Desktop ou o PC.")
    print("   3) Confirme virtualização (BIOS): Intel VT-x / AMD-V; no Windows: recursos → WSL 2 / Hyper-V conforme seu setup.")
    print("   4) Atualize o Docker Desktop ou reinstale: https://docs.docker.com/desktop/")
    print("   ")
    print("   Para seguir **sem** Postgres/Metabase neste script: python iniciar_servicos.py --skip-docker")
    print("   Depois que o Docker voltar, rode de novo ou execute 0-iniciar-docker.bat na raiz do projeto.")
    print("   Se o Docker já está \"running\" mas o script falha: abra um PowerShell, rode `docker info` e")
    print("   confira se o PATH é o mesmo; opcional: `$env:DOCKER_ENGINE_WAIT_SEC=400` antes de rodar o script.")


def run_docker_compose_up(project_root: Path) -> bool:
    """Sobe postgres + metabase (docker-compose.yml na raiz). Retorna True se ok."""
    print("\n🐳 Docker: verificando se o motor está ativo...")
    ok, err_msg = wait_for_docker_engine()
    if not ok:
        print(f"   ❌ Docker não está pronto: {err_msg}")
        if platform.system() == "Windows":
            print_docker_desktop_windows_help()
        else:
            print("   Inicie o serviço Docker (daemon) e execute o script de novo.")
        return False

    print("🐳 Docker: subindo Postgres + Metabase (docker compose up -d)...")
    try:
        r = subprocess.run(
            ["docker", "compose", "up", "-d"],
            cwd=str(project_root),
            capture_output=True,
            text=True,
            timeout=600,
        )
        if r.returncode != 0:
            print("   ❌ docker compose falhou.")
            out = (r.stderr or "") + "\n" + (r.stdout or "")
            for line in out.strip().splitlines()[-8:]:
                if line.strip():
                    print(f"      {line}")
            print("   ")
            if platform.system() == "Windows":
                print_docker_desktop_windows_help()
            else:
                print("   Verifique se o daemon Docker está em execução e tente de novo.")
            return False
        print("   ✅ Containers em execução (ou já estavam ativos).")
        return True
    except FileNotFoundError:
        print("   ❌ Comando 'docker' não encontrado no PATH.")
        return False
    except subprocess.TimeoutExpired:
        print("   ❌ docker compose excedeu o tempo limite (rede lenta ou daemon travado).")
        if platform.system() == "Windows":
            print_docker_desktop_windows_help()
        return False
    except OSError as e:
        print(f"   ❌ Erro ao executar docker: {e}")
        return False


def wait_for_metabase_health(
    base_url: str = "http://127.0.0.1:3000",
    timeout_sec: int = 180,
    interval_sec: float = 2.0,
) -> bool:
    """Aguarda GET /api/health do Metabase (container pode demorar no primeiro boot)."""
    base = base_url.rstrip("/")
    deadline = time.monotonic() + timeout_sec
    print(f"   ⏳ Aguardando Metabase responder em {base}/api/health (até {timeout_sec}s)...")
    while time.monotonic() < deadline:
        req = urllib.request.Request(
            f"{base}/api/health",
            headers={"Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status != 200:
                    time.sleep(interval_sec)
                    continue
                raw = resp.read().decode().strip()
                if raw.startswith("{"):
                    data = json.loads(raw)
                    if data.get("status") == "ok":
                        print("   ✅ Metabase pronto (health OK).")
                        return True
                else:
                    print("   ✅ Metabase respondeu (HTTP 200).")
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(interval_sec)
    print("   ⚠️  Metabase não respondeu a tempo. Abra http://localhost:3000 manualmente quando subir.")
    return False


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

    skip_docker = "--skip-docker" in sys.argv

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

    # --- Passo 1.5: Docker (Postgres + Metabase) ---
    if not skip_docker:
        compose_file = project_root / "docker-compose.yml"
        if compose_file.is_file():
            if docker_cli_available():
                if run_docker_compose_up(project_root):
                    wait_for_metabase_health()
                    print("   📊 Metabase UI: http://localhost:3000")
                    print(
                        "      (No Metabase: Admin → Bases de dados → Postgres — "
                        "host: postgres, base: sistema_gestao, user: app)"
                    )
                else:
                    print("\n   ➡️  Continuando o script sem Postgres/Metabase. Corrija o Docker e rode de novo ou use 0-iniciar-docker.bat.")
            else:
                print("\n⚠️  Docker não encontrado no PATH; ignorando Postgres/Metabase automáticos.")
                print("   Instale o Docker Desktop ou use: python iniciar_servicos.py --skip-docker")
        else:
            print("\n⚠️  docker-compose.yml não encontrado na raiz; etapa Docker ignorada.")
    else:
        print("\n➡️  Pulando Docker (--skip-docker).")

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

    # --- .env do backend (Metabase / secrets locais) ---
    env_example = backend_dir / ".env.example"
    env_file = backend_dir / ".env"
    if env_example.is_file() and not env_file.is_file():
        try:
            shutil.copy(env_example, env_file)
            print("\n📝 Criado backend/.env a partir de .env.example")
            print("   Edite backend/.env com METABASE_API_KEY e METABASE_CARD_* (IDs das perguntas).")
            print("   O Django carrega .env automaticamente — não precisa de 'set' no terminal.")
        except OSError as e:
            print(f"\n⚠️  Não foi possível criar .env: {e}")

    # --- Passo FINAL: Gerar Scripts de Lançamento ---
    print("\nPASSO FINAL: Gerando scripts de inicialização...")

    # Script Docker (Postgres + Metabase) — idempotente; útil para repetir sem rodar o Python
    win_root = str(project_root).replace("/", "\\")
    with open(project_root / "0-iniciar-docker.bat", "w", encoding="utf-8") as f:
        f.write("@echo off\n")
        f.write("echo --- DOCKER: Postgres + Metabase ---\n")
        f.write(f"cd /d {win_root}\n")
        f.write("docker compose up -d\n")
        f.write("echo.\n")
        f.write("echo Metabase: http://localhost:3000\n")
        f.write("echo Postgres: localhost:5432 (app / app, DB sistema_gestao + metabase)\n")
        f.write("pause\n")

    # Script para o Backend (Django)
    default_database_url = os.environ.get(
        "DATABASE_URL", "postgresql://app:app@127.0.0.1:5432/sistema_gestao"
    )
    with open(project_root / "1-iniciar-backend.bat", "w", encoding="utf-8") as f:
        f.write(f"@echo off\n")
        f.write(f"echo --- INICIANDO SERVIDOR DJANGO ---\n")
        f.write(f"cd /d {backend_dir}\n")
        f.write("REM Define o DATABASE_URL apenas se não estiver definido (permite override)\n")
        f.write(f'if "%DATABASE_URL%"=="" set "DATABASE_URL={default_database_url}"\n')
        f.write("echo DATABASE_URL=%DATABASE_URL%\n")
        f.write(f"call .\\venv\\Scripts\\activate\n")
        f.write(f"python manage.py runserver --noreload\n")
        f.write(f"pause\n")

    # Script para o QCluster
    with open(project_root / "2-iniciar-qcluster.bat", "w", encoding="utf-8") as f:
        f.write(f"@echo off\n")
        f.write(f"echo --- INICIANDO QCLUSTER (TAREFAS) ---\n")
        f.write(f"cd /d {backend_dir}\n")
        f.write("REM Define o DATABASE_URL apenas se não estiver definido (permite override)\n")
        f.write(f'if "%DATABASE_URL%"=="" set "DATABASE_URL={default_database_url}"\n')
        f.write("echo DATABASE_URL=%DATABASE_URL%\n")
        f.write(f"call .\\venv\\Scripts\\activate\n")
        f.write(f"python manage.py qcluster\n")
        f.write(f"pause\n")

    # Script para o Frontend
    with open(project_root / "3-iniciar-frontend.bat", "w", encoding="utf-8") as f:
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