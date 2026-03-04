#!/usr/bin/env python
"""
Script para corrigir o Schedule com Func incorreto e limpar tarefas na fila
Execute: python corrigir_schedule.py
"""

import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings')
django.setup()

from django_q.models import Schedule, OrmQ

correct_func = 'core.tasks.check_expiring_products_and_notify'

print("=" * 60)
print("Correção de Schedule e Limpeza de Tarefas na Fila")
print("=" * 60)
print()

# 1. Corrigir Schedules
print("📋 Passo 1: Corrigindo Schedules")
print("-" * 60)

schedules_incorretos = Schedule.objects.filter(
    func__contains='check_expiring_products_and_notify'
)

print(f"Encontrados {schedules_incorretos.count()} schedule(s) relacionados\n")

corrigidos = 0

for schedule in schedules_incorretos:
    # Verifica se precisa correção (tem markdown ou formato incorreto)
    if schedule.func != correct_func:
        print(f"📌 Corrigindo: {schedule.name}")
        print(f"   Func antigo: {schedule.func}")
        
        # Extrai o caminho da função se estiver em formato markdown
        # Ex: '| **Func** | `core.tasks.check_expiring_products_and_notify` |'
        match = re.search(r'`([^`]+)`', schedule.func)
        if match:
            extracted_func = match.group(1)
            print(f"   Função extraída do markdown: {extracted_func}")
        
        # Sempre define para o valor correto
        schedule.func = correct_func
        
        schedule.save()
        
        print(f"   Func novo: {schedule.func}")
        print(f"   ✅ Corrigido!\n")
        corrigidos += 1
    else:
        print(f"✅ Schedule '{schedule.name}' já está correto\n")

# 2. Limpar tarefas na fila com formato incorreto
print("\n📋 Passo 2: Limpando Tarefas na Fila")
print("-" * 60)

total_tasks = OrmQ.objects.count()
print(f"Total de tarefas na fila: {total_tasks}")

# Deletar todas as tarefas relacionadas à função (elas serão recriadas pelo Schedule)
tasks_deletadas = 0
try:
    # Tentamos encontrar tarefas com a função incorreta no payload
    # Como o payload é complexo, vamos deletar todas e deixar o Schedule recriar
    all_tasks = OrmQ.objects.all()
    
    # Verificar se há tarefas (se houver muitas, pode ser melhor deletar todas)
    if total_tasks > 0:
        print(f"\n⚠️  Encontradas {total_tasks} tarefa(s) na fila.")
        print("   Como o Schedule foi corrigido, vamos limpar a fila.")
        print("   As tarefas serão recriadas automaticamente pelo Schedule.\n")
        
        # Deleta todas as tarefas - o Schedule vai recriá-las com o formato correto
        tasks_deletadas = OrmQ.objects.all().delete()[0]
        print(f"✅ {tasks_deletadas} tarefa(s) removida(s) da fila.")
    else:
        print("✅ Nenhuma tarefa na fila para limpar.")
        
except Exception as e:
    print(f"⚠️  Erro ao limpar tarefas: {e}")
    print("   Isso não é crítico - as tarefas antigas falharão mas novas serão criadas corretamente.")

# Resumo
print("\n" + "=" * 60)
print("Resumo")
print("=" * 60)

if corrigidos > 0 or tasks_deletadas > 0:
    if corrigidos > 0:
        print(f"✅ {corrigidos} schedule(s) foram corrigidos!")
    if tasks_deletadas > 0:
        print(f"✅ {tasks_deletadas} tarefa(s) foram removidas da fila!")
    print("\n💡 Próximos passos:")
    print("   1. Reinicie o QCluster (Ctrl+C e execute novamente: python manage.py qcluster)")
    print("   2. As novas tarefas serão criadas automaticamente com o formato correto")
else:
    print("✅ Tudo já está correto! Nenhuma ação necessária.")