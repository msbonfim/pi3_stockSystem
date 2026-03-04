#!/usr/bin/env python
"""
Script para verificar se os arquivos estáticos estão sendo coletados corretamente
Execute: python verify_staticfiles.py
"""
import os
import sys
from pathlib import Path

# Adiciona o diretório do projeto ao path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

# Configura settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings_production')

import django
django.setup()

from django.conf import settings
from pathlib import Path

print("=" * 60)
print("VERIFICAÇÃO DE ARQUIVOS ESTÁTICOS")
print("=" * 60)

print(f"\n📁 STATIC_ROOT: {settings.STATIC_ROOT}")
print(f"📁 STATIC_URL: {settings.STATIC_URL}")
print(f"\n📂 STATICFILES_DIRS:")
for dir_path in settings.STATICFILES_DIRS:
    print(f"   - {dir_path}")
    if Path(dir_path).exists():
        print(f"     ✓ Existe")
        # Listar arquivos admin
        admin_css = Path(dir_path) / "admin" / "css"
        admin_js = Path(dir_path) / "admin" / "js"
        if admin_css.exists():
            print(f"     📄 CSS files:")
            for css_file in admin_css.glob("*.css"):
                print(f"        - {css_file.name}")
        if admin_js.exists():
            print(f"     📄 JS files:")
            for js_file in admin_js.glob("*.js"):
                print(f"        - {js_file.name}")
    else:
        print(f"     ✗ NÃO EXISTE")

print(f"\n📦 STATIC_ROOT (coletados):")
static_root = Path(settings.STATIC_ROOT)
if static_root.exists():
    print(f"   ✓ Existe")
    # Verificar arquivos admin coletados
    admin_css_collected = static_root / "admin" / "css"
    admin_js_collected = static_root / "admin" / "js"
    
    if admin_css_collected.exists():
        print(f"   📄 CSS files coletados:")
        for css_file in admin_css_collected.glob("*.css"):
            print(f"      - {css_file.name}")
    else:
        print(f"   ✗ CSS não coletados")
    
    if admin_js_collected.exists():
        print(f"   📄 JS files coletados:")
        for js_file in admin_js_collected.glob("*.js"):
            print(f"      - {js_file.name}")
    else:
        print(f"   ✗ JS não coletados")
else:
    print(f"   ✗ NÃO EXISTE - Execute: python manage.py collectstatic")

print("\n" + "=" * 60)

