#!/bin/bash
# start.sh - Inicia Django (Gunicorn) e QCluster juntos no mesmo processo
set -e

echo "🚀 Iniciando serviços..."

# Inicia QCluster em background
echo "📅 Iniciando QCluster..."
python manage.py qcluster &
QCLUSTER_PID=$!

# Aguarda um pouco para QCluster iniciar
sleep 2

# Verifica se QCluster está rodando
if ! kill -0 $QCLUSTER_PID 2>/dev/null; then
    echo "❌ Erro ao iniciar QCluster"
    exit 1
fi

echo "✅ QCluster iniciado (PID: $QCLUSTER_PID)"

# Inicia Gunicorn (web server) - usa exec para substituir o processo atual
echo "🌐 Iniciando Gunicorn..."
exec gunicorn sistema_gestao.wsgi:application --bind 0.0.0.0:$PORT

# Quando Gunicorn parar, mata o QCluster também (não deve chegar aqui devido ao exec)
echo "🛑 Encerrando QCluster..."
kill $QCLUSTER_PID 2>/dev/null || true

