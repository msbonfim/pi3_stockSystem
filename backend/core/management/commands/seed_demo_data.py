from django.core.management.base import BaseCommand

from core.demo_seed import seed_demo_data


class Command(BaseCommand):
    help = "Cria categorias, marcas e produtos de demonstração (útil para Metabase/BI)."

    def handle(self, *args, **options):
        seed_demo_data()
        self.stdout.write(self.style.SUCCESS("seed_demo_data concluído."))
