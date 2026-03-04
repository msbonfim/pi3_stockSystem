#!/usr/bin/env bash
# exit on error
set -o errexit

# Instalar dependências
pip install --upgrade pip
pip install -r requirements.txt

# Configurar variável de ambiente para usar settings de produção
export DJANGO_SETTINGS_MODULE=sistema_gestao.settings_production
export RENDER=true

# Executar migrações
python manage.py migrate --no-input

# Coletar arquivos estáticos (limpar antes para evitar conflitos)
echo "📦 Coletando arquivos estáticos..."
echo "📂 Verificando diretórios de origem..."
if [ -d "core/static" ]; then
    echo "✓ core/static encontrado"
    find core/static -type f -name "*.css" -o -name "*.js" | head -10
else
    echo "⚠️ core/static não encontrado!"
fi

python manage.py collectstatic --no-input --clear --verbosity=2

# Verificar se os arquivos foram coletados (debug)
echo "🔍 Verificando arquivos coletados em staticfiles/..."
if [ -d "staticfiles" ]; then
    echo "✓ staticfiles/ existe"
    if [ -d "staticfiles/admin/css" ]; then
        echo "✓ Arquivos CSS encontrados:"
        ls -la staticfiles/admin/css/ || true
        echo "📊 Total de arquivos CSS:"
        find staticfiles/admin/css -type f -name "*.css" | wc -l
    else
        echo "⚠️ Pasta staticfiles/admin/css não encontrada!"
        echo "📂 Estrutura de staticfiles:"
        find staticfiles -type d -maxdepth 3 | head -20
    fi

    if [ -d "staticfiles/admin/js" ]; then
        echo "✓ Arquivos JS encontrados:"
        ls -la staticfiles/admin/js/ || true
        echo "📊 Total de arquivos JS:"
        find staticfiles/admin/js -type f -name "*.js" | wc -l
    else
        echo "⚠️ Pasta staticfiles/admin/js não encontrada!"
    fi
else
    echo "❌ staticfiles/ não existe após collectstatic!"
fi

# Criar superusuário se não existir (opcional)
# python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(username='admin').exists() or User.objects.create_superuser('admin', 'admin@example.com', 'admin123')"
