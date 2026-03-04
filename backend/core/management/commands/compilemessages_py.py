from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings
import sys
import subprocess
import shutil
import importlib

class Command(BaseCommand):
    help = "Compila arquivos .po para .mo. Usa polib (tenta instalar) ou msgfmt do sistema."

    def ensure_polib(self):
        try:
            import polib  # try import first
            return polib
        except Exception:
            self.stdout.write("polib não instalado. Tentando instalar polib via pip...")
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", "polib"])
                polib = importlib.import_module("polib")
                self.stdout.write("polib instalado com sucesso.")
                return polib
            except Exception as exc:
                self.stdout.write(f"Falha ao instalar polib: {exc}")
                return None

    def run_msgfmt(self, po_path: Path, mo_path: Path) -> bool:
        msgfmt = shutil.which("msgfmt") or shutil.which("msgfmt.exe")
        if not msgfmt:
            return False
        try:
            subprocess.check_call([msgfmt, str(po_path), "-o", str(mo_path)])
            return True
        except subprocess.CalledProcessError:
            return False

    def find_po_files(self):
        base = Path(getattr(settings, "BASE_DIR", Path(__file__).resolve().parents[4]))
        po_files = set()

        # Search common locations: project-level locale + LOCALE_PATHS
        try:
            po_files.update(base.rglob("locale/*/LC_MESSAGES/*.po"))
        except Exception:
            pass

        for lp in getattr(settings, "LOCALE_PATHS", []):
            try:
                po_files.update(Path(lp).rglob("*/LC_MESSAGES/*.po"))
            except Exception:
                pass

        # also search app locale dirs under BASE_DIR
        try:
            po_files.update(base.rglob("**/locale/*/LC_MESSAGES/*.po"))
        except Exception:
            pass

        return sorted(po_files)

    def handle(self, *args, **options):
        po_files = self.find_po_files()
        if not po_files:
            self.stdout.write("Nenhum arquivo .po encontrado. Verifique LOCALE_PATHS e nomes de diretório (ex: pt_BR).")
            return

        polib = self.ensure_polib()
        for po in po_files:
            mo = po.with_suffix(".mo")
            self.stdout.write(f"Processando: {po} -> {mo}")
            if polib:
                try:
                    pofile = polib.pofile(str(po))
                    pofile.save_as_mofile(str(mo))
                    self.stdout.write(self.style.SUCCESS(f"Compilado com polib: {mo}"))
                    continue
                except Exception as exc:
                    self.stderr.write(f"Erro ao compilar com polib: {exc}")

            # fallback para msgfmt do sistema
            if self.run_msgfmt(po, mo):
                self.stdout.write(self.style.SUCCESS(f"Compilado com msgfmt: {mo}"))
                continue

            self.stderr.write("Não foi possível compilar: polib ausente/erro e msgfmt não encontrado/erro.")
            self.stderr.write("Instale polib (pip install polib) ou msgfmt (gettext) e tente novamente.")
            raise SystemExit(1)

        self.stdout.write(self.style.SUCCESS("Todas as traduções compiladas."))