import calendar
import random
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.models import Product, Sale, SaleItem


class Command(BaseCommand):
    help = "Gera vendas históricas para os últimos N meses (padrão: 5)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--months",
            type=int,
            default=5,
            help="Quantidade de meses retroativos para gerar vendas (padrão: 5).",
        )
        parser.add_argument(
            "--sales-per-month",
            type=int,
            default=8,
            help="Quantidade de vendas por mês (padrão: 8).",
        )
        parser.add_argument(
            "--seed",
            type=int,
            default=42,
            help="Semente randômica para resultados reproduzíveis (padrão: 42).",
        )
        parser.add_argument(
            "--clear-existing",
            action="store_true",
            help="Apaga vendas existentes antes de gerar novos dados.",
        )

    def _month_year_back(self, year: int, month: int, back: int) -> tuple[int, int]:
        month -= back
        while month <= 0:
            year -= 1
            month += 12
        return year, month

    def handle(self, *args, **options):
        months = max(1, options["months"])
        sales_per_month = max(1, options["sales_per_month"])
        rng = random.Random(options["seed"])

        products = list(Product.objects.all())
        if not products:
            raise CommandError("Nenhum produto encontrado. Cadastre produtos antes de gerar vendas.")

        if options["clear_existing"]:
            deleted = Sale.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Vendas existentes removidas: {deleted[0]} registro(s)."))

        created_sales = 0
        created_items = 0
        now = timezone.now()

        with transaction.atomic():
            # Gera do mês mais antigo para o mais recente.
            for back in range(months - 1, -1, -1):
                year, month = self._month_year_back(now.year, now.month, back)
                _, last_day = calendar.monthrange(year, month)

                for _ in range(sales_per_month):
                    day = rng.randint(1, last_day)
                    hour = rng.randint(9, 20)
                    minute = rng.randint(0, 59)

                    sold_naive = datetime(year, month, day, hour, minute, 0)
                    sold_at = (
                        timezone.make_aware(sold_naive, timezone.get_current_timezone())
                        if timezone.is_aware(now)
                        else sold_naive
                    )

                    sale = Sale.objects.create(
                        sold_at=sold_at,
                        gross_revenue=Decimal("0"),
                        notes=f"Seed histórico ({year}-{month:02d})",
                    )

                    items_count = rng.randint(1, min(4, len(products)))
                    selected = rng.sample(products, k=items_count)

                    gross = Decimal("0")
                    for product in selected:
                        qty = rng.randint(1, 6)
                        price = Decimal(str(product.price or 0))
                        factor = Decimal(str(rng.uniform(0.9, 1.1))).quantize(Decimal("0.01"))
                        unit_price = (price * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                        line_total = (unit_price * qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

                        SaleItem.objects.create(
                            sale=sale,
                            product=product,
                            quantity=qty,
                            unit_price=unit_price,
                            line_total=line_total,
                        )
                        gross += line_total
                        created_items += 1

                    sale.gross_revenue = gross.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    sale.save(update_fields=["gross_revenue"])
                    created_sales += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed concluído: {created_sales} venda(s), {created_items} item(ns), "
                f"últimos {months} mês(es)."
            )
        )
