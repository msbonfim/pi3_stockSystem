import os
import django

# Configura o ambiente Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings')
django.setup()

from admin_interface.models import Theme

print("=" * 60)
print("🔥 Resetando o tema do Admin Interface para forçar a releitura do settings.py...")
print("=" * 60)

try:
    # Deleta TODOS os temas do banco de dados.
    # Isso força o django-admin-interface a recriar um tema padrão
    # usando as configurações atuais do settings.py na próxima vez que o admin for carregado.
    themes_deleted, _ = Theme.objects.all().delete()

    if themes_deleted > 0:
        print(f"✅ {themes_deleted} tema(s) removido(s) com sucesso do banco de dados.")
    else:
        print("ℹ️ Nenhum tema para remover foi encontrado no banco de dados.")

    print("\n" + "=" * 60)
    print("🎉 RESET COMPLETO!")
    print("=" * 60)
    print("\n💡 Próximos passos:")
    print("   1. Reinicie o servidor Django (Ctrl+C e 'python manage.py runserver').")
    print("   2. Acesse o admin. Um novo tema padrão será criado automaticamente.")
    print("   3. O menu 'django_q' estará traduzido conforme definido no settings.py.")

except Exception as e:
    print(f"\n❌ Erro durante o reset: {e}")
