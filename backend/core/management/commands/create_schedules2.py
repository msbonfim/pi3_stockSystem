# core/management/commands/create_low_stock_schedule.py

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, time
try:
    from django_q.models import Schedule
    Q2_AVAILABLE = True
except ImportError:
    Q2_AVAILABLE = False


class Command(BaseCommand):
    help = 'Cria o schedule para verificar produtos com estoque baixo'

    def add_arguments(self, parser):
        parser.add_argument(
            '--min-quantity',
            type=int,
            default=2,
            help='Quantidade mínima para considerar estoque baixo (padrão: 2)',
        )
        parser.add_argument(
            '--hour',
            type=int,
            default=9,
            help='Hora do dia para executar (padrão: 9)',
        )

    def handle(self, *args, **options):
        if not Q2_AVAILABLE:
            self.stdout.write(
                self.style.ERROR('django_q2 não está instalado. Execute: pip install django-q2')
            )
            return
        
        min_quantity = options['min_quantity']
        hour = options['hour']
        
        # Nome da task
        func = 'core.tasks.check_low_stock_and_notify'
        
        # Verifica se já existe um schedule
        existing = Schedule.objects.filter(func=func).first()
        
        if existing:
            self.stdout.write(
                self.style.WARNING(f'Schedule já existe: {existing.name}')
            )
            resposta = input('Deseja atualizar? (s/N): ')
            if resposta.lower() != 's':
                return
            
            # Atualiza o schedule existente
            existing.name = f'Verificar produtos com estoque baixo (menos de {min_quantity} unidades)'
            existing.next_run = self._calculate_next_run(hour)
            existing.save()
            
            self.stdout.write(
                self.style.SUCCESS(f'Schedule atualizado! ID: {existing.id}')
            )
            return
        
        try:
            # Calcula a próxima execução
            next_run = self._calculate_next_run(hour)
            
            # Cria um novo schedule - roda diariamente
            schedule = Schedule.objects.create(
                func=func,
                name=f'Verificar produtos com estoque baixo (menos de {min_quantity} unidades)',
                schedule_type=Schedule.DAILY,
                repeats=-1,  # Repete infinitamente
                next_run=next_run,
                kwargs={'min_quantity': min_quantity}  # Passa o parâmetro min_quantity
            )
            
            self.stdout.write(
                self.style.SUCCESS(f'Schedule criado com sucesso! ID: {schedule.id}')
            )
            self.stdout.write(
                self.style.SUCCESS(f'A task será executada diariamente às {hour}:00')
            )
            self.stdout.write(
                self.style.SUCCESS(f'Próxima execução: {next_run.strftime("%d/%m/%Y %H:%M")}')
            )
            self.stdout.write(
                self.style.SUCCESS(f'Verificará produtos com menos de {min_quantity} unidades')
            )
            self.stdout.write(
                self.style.WARNING('Lembre-se de iniciar o qcluster: python manage.py qcluster')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Erro ao criar schedule: {e}')
            )
            import traceback
            self.stdout.write(traceback.format_exc())

    def _calculate_next_run(self, hour):
        """Calcula a próxima execução baseada na hora especificada"""
        now = timezone.now()
        next_run_time = time(hour, 0)
        next_run = datetime.combine(now.date(), next_run_time)
        next_run = timezone.make_aware(next_run)
        if next_run <= now:
            # Se já passou do horário, agenda para amanhã
            from datetime import timedelta
            next_run = next_run + timedelta(days=1)
        return next_run

