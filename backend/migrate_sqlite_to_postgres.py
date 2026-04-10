#!/usr/bin/env python
"""
Migra dados do SQLite (db.sqlite3) para PostgreSQL (DATABASE_URL).

Uso (PowerShell), a partir da pasta backend:

  1) Exportar fixtures do SQLite (sem DATABASE_URL no ambiente):
       python migrate_sqlite_to_postgres.py export

  2) Importar no Postgres (defina DATABASE_URL e tenha o Docker Postgres no ar):
       $env:DATABASE_URL="postgresql://app:app@127.0.0.1:5432/sistema_gestao"
       python migrate_sqlite_to_postgres.py import

O ficheiro gerado fica em: backend/pg_migration_fixture.json

Notas:
- O import corre migrate antes do loaddata.
- Exclui contenttypes/sessions/permissões para reduzir conflitos; usa chaves naturais.
- Se o Postgres já tiver dados que colidem, o loaddata pode falhar — nesse caso
  avalie backup ou base Postgres vazia (apenas para dev).
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
FIXTURE_NAME = "pg_migration_fixture.json"
FIXTURE_PATH = BACKEND_DIR / FIXTURE_NAME


def _run_manage(args: list[str], env: dict[str, str] | None) -> int:
    cmd = [sys.executable, str(BACKEND_DIR / "manage.py")] + args
    return subprocess.run(cmd, cwd=str(BACKEND_DIR), env=env).returncode


def cmd_export() -> int:
    env = os.environ.copy()
    env.pop("DATABASE_URL", None)
    # Windows: evita 'charmap' codec ao serializar texto com caracteres fora do CP1252
    env.setdefault("PYTHONUTF8", "1")
    env.setdefault("PYTHONIOENCODING", "utf-8")

    print("Exportando do SQLite (DATABASE_URL removido)...")
    sqlite_path = BACKEND_DIR / "db.sqlite3"
    if not sqlite_path.is_file():
        print(f"Aviso: não existe {sqlite_path} — não há SQLite para exportar.")
        return 1

    out_path = FIXTURE_PATH
    if out_path.is_file():
        try:
            out_path.unlink()
        except OSError:
            pass

    # --output faz o Django gravar o JSON em UTF-8 (evita erro ao redirecionar stdout no cmd)
    rc = subprocess.run(
        [
            sys.executable,
            str(BACKEND_DIR / "manage.py"),
            "dumpdata",
            "--natural-foreign",
            "--natural-primary",
            "--indent",
            "2",
            "--exclude",
            "contenttypes",
            "--exclude",
            "sessions",
            "--exclude",
            "auth.permission",
            "--output",
            str(out_path),
            "core",
            "auth",
        ],
        cwd=str(BACKEND_DIR),
        env=env,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if rc.returncode != 0:
        print(rc.stderr or "dumpdata falhou.")
        if out_path.is_file():
            try:
                out_path.unlink()
            except OSError:
                pass
        return rc.returncode
    print(f"OK: fixture gravada em {out_path}")
    return 0


def cmd_import() -> int:
    if not os.environ.get("DATABASE_URL"):
        print("Defina DATABASE_URL para o Postgres antes do import.")
        print('Ex.: $env:DATABASE_URL="postgresql://app:app@127.0.0.1:5432/sistema_gestao"')
        return 1
    if not FIXTURE_PATH.is_file():
        print(f"Não existe {FIXTURE_PATH}. Rode primeiro: python migrate_sqlite_to_postgres.py export")
        return 1

    env = os.environ.copy()
    print("Aplicando migrações no Postgres...")
    if _run_manage(["migrate", "--noinput"], env) != 0:
        return 1
    print("Carregando fixture...")
    if _run_manage(["loaddata", str(FIXTURE_PATH)], env) != 0:
        print(
            "\nSe falhou por duplicados, o Postgres pode já ter registos."
            " Em dev pode fazer flush (apaga dados) ou usar outra base."
        )
        return 1
    print("OK: dados importados para o PostgreSQL.")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="SQLite → PostgreSQL (dumpdata/loaddata)")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("export", help="Gera pg_migration_fixture.json a partir do SQLite")
    sub.add_parser("import", help="Aplica migrate e loaddata no Postgres (DATABASE_URL obrigatório)")
    args = p.parse_args()
    if args.cmd == "export":
        return cmd_export()
    if args.cmd == "import":
        return cmd_import()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
