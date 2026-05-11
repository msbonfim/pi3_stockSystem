#!/usr/bin/env python
"""
Orquestrador de testes do StockSystem (espelha o fluxo de `iniciar_servicos.py`).

1. Garante execução dentro do venv do backend (unittest + Django nos mesmos testes que o projeto).
2. Instala dependências se necessário ou com --install.
3. Executa unittest em backend/core/tests e Vitest no frontend.
4. Gera scripts .bat na raiz para repetir sem rodar o Python.

Flags:
  --rebuild-venv   Recria backend/venv (igual iniciar_servicos.py).
  --install        Força pip install -r requirements.txt e npm install no frontend.
  --skip-backend   Não executa testes Python.
  --skip-frontend  Não executa Vitest.
  --only-backend   Apenas unittest (sem frontend).
  --only-frontend  Apenas Vitest (sem backend; não exige venv).
  --watch          Após o fluxo, abre novo terminal com Vitest em modo watch.
  --ui             Abre novo terminal com Vitest UI (npm run test:ui).
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


def _ensure_utf8_stdio() -> None:
    """Evita UnicodeEncodeError no console Windows (cp1252) com mensagens e emojis."""
    if sys.platform == "win32":
        for stream in (sys.stdout, sys.stderr):
            try:
                stream.reconfigure(encoding="utf-8")
            except Exception:
                pass


def run_in_new_terminal(command: str, title: str) -> None:
    """Executa um comando em um novo terminal (mesma ideia que iniciar_servicos.py)."""
    system = platform.system()
    print(f"🚀 Abrindo '{title}'...")
    if system == "Windows":
        os.system(f'start "{title}" "{command}"')
    elif system == "Darwin":
        os.system(
            f'''osascript -e 'tell app "Terminal" to do script "cd \\"{os.path.dirname(command)}\\" && ./{os.path.basename(command)}"' '''
        )
    elif system == "Linux":
        try:
            os.system(
                f'gnome-terminal --title="{title}" -- bash -c "cd \\"{os.path.dirname(command)}\\" && ./{os.path.basename(command)}; exec bash"'
            )
        except Exception:
            os.system(
                f'xterm -T "{title}" -e "cd \\"{os.path.dirname(command)}\\" && ./{os.path.basename(command)}; exec bash"'
            )
    else:
        print(f"❌ SO '{system}' não suportado para novo terminal.")
        return
    print(f"✅ '{title}' iniciado em um novo terminal.")


def _venv_python(project_root: Path) -> Path:
    venv_folder = project_root / "backend" / "venv"
    if sys.platform == "win32":
        return venv_folder / "Scripts" / "python.exe"
    return venv_folder / "bin" / "python"


def rebuild_venv(project_root: Path) -> None:
    venv_folder = project_root / "backend" / "venv"
    print("🔥 Reconstruindo o ambiente virtual (venv)...")
    if venv_folder.exists():
        print(f"   Removendo: {venv_folder}")
        try:
            shutil.rmtree(venv_folder)
        except PermissionError as e:
            print(f"\n❌ ERRO DE PERMISSÃO: {e}")
            print("   Feche terminais que usem o venv e tente de novo.")
            raise SystemExit(1) from e
    print("   Criando novo venv...")
    subprocess.run([sys.executable, "-m", "venv", str(venv_folder)], check=True)
    (project_root / "backend" / ".last_pip_install").unlink(missing_ok=True)
    print("✅ venv recriado. Execute de novo sem --rebuild-venv para instalar deps e rodar testes.")


def ensure_venv_exists(project_root: Path, python_executable: Path) -> None:
    if python_executable.exists():
        return
    print("🔎 venv não encontrado; criando...")
    venv_folder = project_root / "backend" / "venv"
    subprocess.run([sys.executable, "-m", "venv", str(venv_folder)], check=True)
    print("✅ venv criado. A próxima execução instalará dependências se necessário.")


def needs_pip_install(backend_dir: Path, python_executable: Path) -> bool:
    requirements_path = backend_dir / "requirements.txt"
    last_install_path = backend_dir / ".last_pip_install"
    try:
        subprocess.check_call(
            [str(python_executable), "-c", "import django"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        venv_ok = True
    except subprocess.CalledProcessError:
        venv_ok = False
    if not venv_ok:
        return True
    if not last_install_path.exists() or not requirements_path.exists():
        return True
    if last_install_path.stat().st_mtime < requirements_path.stat().st_mtime:
        return True
    return False


def run_pip_install(backend_dir: Path, python_executable: Path) -> None:
    requirements_path = backend_dir / "requirements.txt"
    print("   📦 pip install -r requirements.txt ...")
    r = subprocess.run(
        [str(python_executable), "-m", "pip", "install", "-r", str(requirements_path)],
        cwd=str(backend_dir),
    )
    if r.returncode != 0:
        print("❌ pip install falhou.")
        raise SystemExit(r.returncode)
    (backend_dir / ".last_pip_install").touch()
    print("   ✅ Dependências do backend instaladas.")


def run_backend_tests(backend_dir: Path, python_executable: Path) -> int:
    print("\n" + "=" * 70)
    print("🐍 Backend — unittest (core/tests)")
    print("=" * 70)
    r = subprocess.run(
        [
            str(python_executable),
            "-m",
            "unittest",
            "discover",
            "-s",
            "core/tests",
            "-p",
            "test_*.py",
            "-v",
        ],
        cwd=str(backend_dir),
    )
    return r.returncode


def npm_cmd() -> str:
    for name in ("npm", "npm.cmd"):
        found = shutil.which(name)
        if found:
            return found
    return "npm"


def frontend_deps_needed(frontend_dir: Path, force: bool) -> bool:
    if force:
        return True
    if not (frontend_dir / "node_modules").is_dir():
        return True
    lock = frontend_dir / "package-lock.json"
    pkg = frontend_dir / "package.json"
    if lock.is_file() and pkg.is_file():
        try:
            if pkg.stat().st_mtime > lock.stat().st_mtime:
                return True
        except OSError:
            pass
    return False


def run_npm_install(frontend_dir: Path) -> None:
    npm = npm_cmd()
    print("   📦 npm install ...")
    r = subprocess.run([npm, "install"], cwd=str(frontend_dir), shell=False)
    if r.returncode != 0:
        print("❌ npm install falhou.")
        raise SystemExit(r.returncode)
    print("   ✅ Dependências do frontend instaladas.")


def run_frontend_tests(frontend_dir: Path) -> int:
    print("\n" + "=" * 70)
    print("⚡ Frontend — Vitest (run)")
    print("=" * 70)
    npm = npm_cmd()
    r = subprocess.run([npm, "run", "test"], cwd=str(frontend_dir), shell=False)
    return r.returncode


def write_batch_files(project_root: Path, backend_dir: Path, frontend_dir: Path) -> None:
    win_backend = str(backend_dir).replace("/", "\\")
    win_frontend = str(frontend_dir).replace("/", "\\")
    win_root = str(project_root).replace("/", "\\")

    with open(project_root / "4-testes-backend.bat", "w", encoding="utf-8") as f:
        f.write("@echo off\n")
        f.write("echo --- TESTES BACKEND (unittest) ---\n")
        f.write(f"cd /d {win_backend}\n")
        f.write("call .\\venv\\Scripts\\activate\n")
        f.write('python -m unittest discover -s core/tests -p "test_*.py" -v\n')
        f.write("pause\n")

    with open(project_root / "5-testes-frontend.bat", "w", encoding="utf-8") as f:
        f.write("@echo off\n")
        f.write("echo --- TESTES FRONTEND (Vitest) ---\n")
        f.write(f"cd /d {win_frontend}\n")
        f.write("npm test\n")
        f.write("pause\n")

    if sys.platform == "win32":
        py_venv = backend_dir / "venv" / "Scripts" / "python.exe"
    else:
        py_venv = backend_dir / "venv" / "bin" / "python"
    py_runner = str(py_venv).replace("/", "\\") if py_venv.is_file() else "python"

    with open(project_root / "6-testes-todos.bat", "w", encoding="utf-8") as f:
        f.write("@echo off\n")
        f.write("echo --- TESTES BACKEND + FRONTEND ---\n")
        f.write(f"cd /d {win_root}\n")
        f.write(f'"{py_runner}" iniciar_testes.py\n')
        f.write("pause\n")

    with open(project_root / "7-testes-frontend-watch.bat", "w", encoding="utf-8") as f:
        f.write("@echo off\n")
        f.write("echo --- VITEST (watch) ---\n")
        f.write(f"cd /d {win_frontend}\n")
        f.write("npm run test:watch\n")
        f.write("pause\n")

    with open(project_root / "8-testes-frontend-ui.bat", "w", encoding="utf-8") as f:
        f.write("@echo off\n")
        f.write("echo --- VITEST UI ---\n")
        f.write(f"cd /d {win_frontend}\n")
        f.write("npm run test:ui\n")
        f.write("pause\n")

    print("\n📝 Scripts gerados na raiz:")
    print("   4-testes-backend.bat")
    print("   5-testes-frontend.bat")
    print("   6-testes-todos.bat (chama iniciar_testes.py)")
    print("   7-testes-frontend-watch.bat")
    print("   8-testes-frontend-ui.bat")


def main() -> None:
    _ensure_utf8_stdio()
    project_root = Path(__file__).resolve().parent
    backend_dir = project_root / "backend"
    frontend_dir = project_root / "frontend"
    python_executable = _venv_python(project_root)

    argv = sys.argv[1:]
    if "--rebuild-venv" in argv:
        rebuild_venv(project_root)
        return

    skip_backend = "--skip-backend" in argv or "--only-frontend" in argv
    skip_frontend = "--skip-frontend" in argv or "--only-backend" in argv
    do_install = "--install" in argv
    do_watch = "--watch" in argv
    do_ui = "--ui" in argv

    if skip_backend and skip_frontend:
        print("❌ Não use --skip-backend e --skip-frontend ao mesmo tempo.")
        raise SystemExit(2)

    # --- Apenas frontend: não exige venv ---
    if skip_backend and not skip_frontend:
        print("=" * 70, flush=True)
        print("🧪 Orquestrador de testes (apenas frontend — sem venv)", flush=True)
        print("=" * 70, flush=True)

        exit_codes: list[int] = []
        if frontend_deps_needed(frontend_dir, do_install):
            run_npm_install(frontend_dir)
        elif do_install:
            run_npm_install(frontend_dir)
        else:
            print("\n📌 Frontend: node_modules presente (use --install para forçar npm install).")
        if not do_ui:
            exit_codes.append(run_frontend_tests(frontend_dir))
        write_batch_files(project_root, backend_dir, frontend_dir)
        if do_watch:
            run_in_new_terminal(
                str(project_root / "7-testes-frontend-watch.bat"),
                "Vitest (watch)",
            )
        if do_ui:
            run_in_new_terminal(
                str(project_root / "8-testes-frontend-ui.bat"),
                "Vitest UI",
            )
        failures = [c for c in exit_codes if c != 0]
        if failures:
            print("\n❌ Pelo menos uma suíte falhou.")
            raise SystemExit(max(failures))
        print("\n✅ Frontend concluído sem erro de retorno.")
        return

    ensure_venv_exists(project_root, python_executable)

    if sys.executable.lower() != str(python_executable).lower():
        print("⚠️  Executando de novo dentro do venv do backend...")
        r = subprocess.run([str(python_executable), __file__] + argv)
        raise SystemExit(r.returncode)

    print("=" * 70, flush=True)
    print("🧪 Orquestrador de testes (StockSystem — venv ativo)", flush=True)
    print("=" * 70, flush=True)


    if do_install or needs_pip_install(backend_dir, python_executable):
        run_pip_install(backend_dir, python_executable)
    elif not skip_backend:
        print("\n📌 Backend: dependências já marcadas como atualizadas (use --install para forçar).")

    exit_codes = []

    if not skip_backend:
        exit_codes.append(run_backend_tests(backend_dir, python_executable))
    else:
        print("\n➡️  Pulando testes do backend (--skip-backend / --only-frontend).")

    if not skip_frontend:
        if frontend_deps_needed(frontend_dir, do_install):
            run_npm_install(frontend_dir)
        elif not skip_backend:
            print("\n📌 Frontend: node_modules presente (use --install para forçar npm install).")
        if not do_ui:
            exit_codes.append(run_frontend_tests(frontend_dir))
    else:
        print("\n➡️  Pulando testes do frontend (--skip-frontend / --only-backend).")

    write_batch_files(project_root, backend_dir, frontend_dir)

    if do_watch and not skip_frontend:
        run_in_new_terminal(
            str(project_root / "7-testes-frontend-watch.bat"),
            "Vitest (watch)",
        )
    elif do_watch:
        print("⚠️  --watch ignorado (frontend foi pulado).")

    if do_ui and not skip_frontend:
        run_in_new_terminal(
            str(project_root / "8-testes-frontend-ui.bat"),
            "Vitest UI",
        )
    elif do_ui:
        print("⚠️  --ui ignorado (frontend foi pulado).")

    failures = [c for c in exit_codes if c != 0]
    if failures:
        print("\n❌ Pelo menos uma suíte falhou.")
        raise SystemExit(max(failures))

    print("\n✅ Suíte(s) concluída(s) sem erro de retorno.")
    print("   Use 4-testes-backend.bat / 5-testes-frontend.bat / 6-testes-todos.bat na raiz do projeto.")


if __name__ == "__main__":
    main()
