# core/management/commands/create_schedules.py

from django.core.management.base import BaseCommand
try:
    from django_q.models import Schedule
except ImportError:
    Schedule = None
from datetime import time, datetime, timedelta
from django.utils import timezone

class Command(BaseCommand):
    help = 'Deleta os agendamentos de notificação existentes e cria novos com configurações limpas.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--hour',
            type=int,
            default=9,
            help='A hora (0-23) em que as verificações diárias devem ser executadas. Padrão: 9 (09:00).'
        )
        parser.add_argument(
            '--minute',
            type=int,
            default=0,
            help='O minuto (0-59) em que as verificações diárias devem ser executadas. Padrão: 0.'
        )
        parser.add_argument(
            '--min-quantity',
            type=int,
            default=2,
            help='A quantidade mínima para o alerta de estoque baixo. Padrão: 2.'
        )

    def handle(self, *args, **options):
        if not Schedule:
            self.stdout.write(self.style.ERROR('A biblioteca django-q2 não está instalada.'))
            return
        
        hour = options['hour']
        minute = options['minute']
        min_quantity = options['min_quantity']
        
        # --- Calcula a data e hora completas da próxima execução ---
        now = timezone.now()
        schedule_time_obj = time(hour, minute)
        # Combina a data de hoje com a hora do agendamento
        next_run_datetime = timezone.make_aware(datetime.combine(now.date(), schedule_time_obj))
        
        # Se o horário já passou hoje, agenda para amanhã
        if next_run_datetime < now:
            next_run_datetime += timedelta(days=1)

        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("🚀 Recriando Agendamentos de Notificação..."))
        self.stdout.write(self.style.SUCCESS("=" * 60))

        # --- Funções das tarefas ---
        expiring_func = 'core.tasks.check_expiring_products_and_notify'
        low_stock_func = 'core.tasks.check_low_stock_and_notify'

        # --- Deletar agendamentos antigos ---
        self.stdout.write("\n🗑️  Deletando agendamentos antigos...")
        deleted_expiring, _ = Schedule.objects.filter(func=expiring_func).delete()
        deleted_low_stock, _ = Schedule.objects.filter(func=low_stock_func).delete()
        self.stdout.write(f"   - {deleted_expiring} agendamento(s) de validade removido(s).")
        self.stdout.write(f"   - {deleted_low_stock} agendamento(s) de estoque baixo removido(s).")

        # --- Criar novos agendamentos ---
        self.stdout.write("\n✨ Criando novos agendamentos...")

        # 1. Agendamento para produtos próximos da validade
        Schedule.objects.create(
            name='Notificação de produtos próximos da validade',
            func=expiring_func,
            schedule_type=Schedule.DAILY,
            next_run=next_run_datetime,
            repeats=-1  # Infinito
        )
        self.stdout.write(self.style.SUCCESS(f"   ✅ Agendamento de validade criado para rodar diariamente às {schedule_time_obj.strftime('%H:%M')}."))

        # 2. Agendamento para estoque baixo
        Schedule.objects.create(
            name='Notificação de estoque baixo',
            func=low_stock_func,
            kwargs={'min_quantity': min_quantity},
            schedule_type=Schedule.DAILY,
            next_run=next_run_datetime,
            repeats=-1  # Infinito
        )
        self.stdout.write(self.style.SUCCESS(f"   ✅ Agendamento de estoque baixo criado para rodar diariamente às {schedule_time_obj.strftime('%H:%M')} (limite: < {min_quantity} unidades)."))

        self.stdout.write(self.style.SUCCESS("\n" + "=" * 60))
        self.stdout.write(self.style.SUCCESS("🎉 Processo concluído! Reinicie o QCluster para aplicar as mudanças."))
        self.stdout.write(self.style.SUCCESS("=" * 60))
