"""Validação dos serializers DRF sem acesso ao banco (apenas campos de entrada)."""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sistema_gestao.settings")

try:
    import django

    django.setup()
except ModuleNotFoundError:  # pragma: no cover
    django = None  # type: ignore[assignment]

if django is not None:
    from core.serializers import SaleCreateSerializer, SaleItemWriteSerializer  # noqa: E402


@unittest.skipUnless(django is not None, "Requer Django instalado (ex.: venv do projeto)")
class _SerializerTestCase(unittest.TestCase):
    pass


class SaleItemWriteSerializerTests(_SerializerTestCase):
    def test_valid(self) -> None:
        s = SaleItemWriteSerializer(data={"product": 1, "quantity": 5, "unit_price": "12.50"})
        self.assertTrue(s.is_valid(), s.errors)

    def test_quantity_min(self) -> None:
        s = SaleItemWriteSerializer(data={"product": 1, "quantity": 0, "unit_price": "1.00"})
        self.assertFalse(s.is_valid())

    def test_product_min(self) -> None:
        s = SaleItemWriteSerializer(data={"product": 0, "quantity": 1, "unit_price": "1.00"})
        self.assertFalse(s.is_valid())


class SaleCreateSerializerTests(_SerializerTestCase):
    def test_valid_one_item(self) -> None:
        s = SaleCreateSerializer(
            data={
                "items": [{"product": 2, "quantity": 1, "unit_price": "9.99"}],
                "notes": "ok",
            }
        )
        self.assertTrue(s.is_valid(), s.errors)

    def test_items_required_min_one(self) -> None:
        s = SaleCreateSerializer(data={"items": []})
        self.assertFalse(s.is_valid())


if __name__ == "__main__":
    unittest.main()
