"""
Testes de integração do stack BI (Metabase + PostgreSQL).

Executam apenas quando RUN_BI_STACK_TESTS=1 e com `docker compose up -d` ativo.

Exemplo (PowerShell):
  $env:RUN_BI_STACK_TESTS="1"
  cd backend
  python -m unittest core.tests.test_metabase_integration -v

Variáveis opcionais: METABASE_URL, PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_APP_DB
"""

from __future__ import annotations

import json
import os
import unittest
import urllib.error
import urllib.request

RUN_BI = os.environ.get("RUN_BI_STACK_TESTS", "").lower() in ("1", "true", "yes")


@unittest.skipUnless(
    RUN_BI,
    "Defina RUN_BI_STACK_TESTS=1 e suba o stack: docker compose up -d",
)
class MetabaseStackIntegrationTests(unittest.TestCase):
    """Valida Metabase acessível e banco interno `metabase` no Postgres."""

    metabase_url = os.environ.get("METABASE_URL", "http://127.0.0.1:3000").rstrip("/")
    pg_host = os.environ.get("PG_HOST", "127.0.0.1")
    pg_port = int(os.environ.get("PG_PORT", "5432"))
    pg_user = os.environ.get("PG_USER", "app")
    pg_password = os.environ.get("PG_PASSWORD", "app")
    pg_app_db = os.environ.get("PG_APP_DB", "sistema_gestao")

    def test_metabase_health_endpoint(self) -> None:
        req = urllib.request.Request(
            f"{self.metabase_url}/api/health",
            headers={"Accept": "application/json"},
        )
        raw = ""
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                self.assertEqual(resp.status, 200)
                raw = resp.read().decode()
        except urllib.error.HTTPError as e:
            self.fail(f"Metabase health falhou: {e.code} {e.reason}")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            self.skipTest(
                f"Metabase não acessível em {self.metabase_url} "
                f"(subir: docker compose up -d). Detalhe: {e}"
            )

        if raw.strip().startswith("{"):
            body = json.loads(raw)
            self.assertEqual(body.get("status"), "ok")

    def test_postgres_has_metabase_database(self) -> None:
        try:
            import psycopg2
        except ImportError:
            self.skipTest(
                "Instale psycopg2-binary (ver requirements.txt) para validar o Postgres."
            )

        try:
            conn = psycopg2.connect(
                host=self.pg_host,
                port=self.pg_port,
                user=self.pg_user,
                password=self.pg_password,
                dbname=self.pg_app_db,
                connect_timeout=10,
            )
        except Exception as e:
            self.skipTest(
                f"Postgres não acessível em {self.pg_host}:{self.pg_port} "
                f"(subir: docker compose up -d). Detalhe: {e}"
            )

        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM pg_database WHERE datname = %s",
                    ("metabase",),
                )
                row = cur.fetchone()
            self.assertIsNotNone(row, "O banco 'metabase' deve existir (init SQL do compose).")
        finally:
            conn.close()


class MetabaseConfigSmokeTests(unittest.TestCase):
    """Garante que o repositório referencia Metabase no compose (sem Docker)."""

    def test_compose_defines_metabase_service(self) -> None:
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        path = os.path.join(root, "docker-compose.yml")
        self.assertTrue(os.path.isfile(path), msg=f"Esperado: {path}")
        with open(path, encoding="utf-8") as f:
            text = f.read()
        self.assertIn("metabase:", text)
        self.assertIn("MB_DB_TYPE:", text)
        self.assertIn("init-metabase-db.sql", text)
