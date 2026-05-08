"""Testes unitários de helpers do cliente Metabase (JSON, inferência de IDs, collections)."""

from __future__ import annotations

import os
import unittest
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sistema_gestao.settings")

try:
    import django

    django.setup()
except ModuleNotFoundError:  # pragma: no cover
    django = None  # type: ignore[assignment]

if django is not None:
    from core.metabase_client import (  # noqa: E402
        MetabaseError,
        _jsonify_cell,
        find_collection_id_by_name,
        infer_card_ids_from_collection,
        list_collection_cards,
        rows_to_dicts,
    )


@unittest.skipUnless(django is not None, "Requer Django instalado (ex.: venv do projeto)")
class _MetabaseClientTestCase(unittest.TestCase):
    pass


class JsonifyCellTests(_MetabaseClientTestCase):
    def test_none(self) -> None:
        self.assertIsNone(_jsonify_cell(None))

    def test_decimal_to_float(self) -> None:
        self.assertEqual(_jsonify_cell(Decimal("10.5")), 10.5)

    def test_date_iso(self) -> None:
        self.assertEqual(_jsonify_cell(date(2026, 5, 1)), "2026-05-01")

    def test_datetime_iso(self) -> None:
        dt = datetime(2026, 5, 1, 14, 30, 0)
        self.assertEqual(_jsonify_cell(dt), dt.isoformat())

    def test_plain_passthrough(self) -> None:
        self.assertEqual(_jsonify_cell("x"), "x")
        self.assertEqual(_jsonify_cell(42), 42)


class RowsToDictsTests(_MetabaseClientTestCase):
    def test_builds_keys_from_names(self) -> None:
        data = {
            "cols": [{"name": "categoria"}, {"display_name": "total"}],
            "rows": [["A", 10]],
        }
        self.assertEqual(rows_to_dicts(data), [{"categoria": "A", "total": 10}])

    def test_decimal_in_row(self) -> None:
        data = {
            "cols": [{"name": "v"}],
            "rows": [[Decimal("1.25")]],
        }
        self.assertEqual(rows_to_dicts(data), [{"v": 1.25}])


class InferCardIdsFromCollectionTests(_MetabaseClientTestCase):
    def test_assigns_first_match_per_slot(self) -> None:
        cards = [
            {"id": 1, "name": "Resumo geral", "description": ""},
            {"id": 2, "name": "Por categoria", "description": ""},
            {"id": 3, "name": "Análise por marca", "description": ""},
            {"id": 4, "name": "Estoque baixo", "description": ""},
            {"id": 5, "name": "Top valor", "description": ""},
            {"id": 6, "name": "Validade", "description": ""},
            {"id": 7, "name": "Vendas mensais", "description": ""},
        ]
        out = infer_card_ids_from_collection(cards)
        self.assertEqual(out["overview"], 1)
        self.assertEqual(out["by_category"], 2)
        self.assertEqual(out["by_brand"], 3)
        self.assertEqual(out["low_stock"], 4)
        self.assertEqual(out["top_by_stock_value"], 5)
        self.assertEqual(out["expiration"], 6)
        self.assertEqual(out["sales_monthly"], 7)


class FindCollectionIdByNameTests(_MetabaseClientTestCase):
    def test_root_string(self) -> None:
        session = MagicMock()
        self.assertEqual(find_collection_id_by_name(session, "http://x", "root"), "root")

    def test_numeric_id_string(self) -> None:
        session = MagicMock()
        self.assertEqual(find_collection_id_by_name(session, "http://x", " 42 "), 42)

    def test_parses_collection_url(self) -> None:
        session = MagicMock()
        url = "http://localhost:3000/collection/12-relatorios"
        self.assertEqual(find_collection_id_by_name(session, "http://x", url), 12)

    def test_relative_collection_url_root(self) -> None:
        session = MagicMock()
        self.assertEqual(find_collection_id_by_name(session, "http://x", "/collection/root"), "root")

    @patch("core.metabase_client.list_all_collections")
    def test_resolves_by_collection_name(self, mock_list: MagicMock) -> None:
        mock_list.return_value = [
            {"name": "Relatórios BI", "id": 99},
            {"name": "Outra", "id": 1},
        ]
        session = MagicMock()
        cid = find_collection_id_by_name(session, "http://localhost:3000", "relatórios bi")
        self.assertEqual(cid, 99)
        mock_list.assert_called_once()

    @patch("core.metabase_client.list_all_collections")
    def test_returns_zero_when_missing(self, mock_list: MagicMock) -> None:
        mock_list.return_value = [{"name": "X", "id": 1}]
        session = MagicMock()
        self.assertEqual(find_collection_id_by_name(session, "http://x", "inexistente"), 0)


class ListCollectionCardsTests(_MetabaseClientTestCase):
    def test_filters_only_card_and_dataset(self) -> None:
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = {
            "data": [
                {"model": "card", "id": 10, "name": "A", "description": "d"},
                {"model": "dashboard", "id": 20, "name": "B", "description": ""},
                {"model": "dataset", "id": 30, "name": "C", "description": ""},
            ]
        }
        session = MagicMock()
        session.get.return_value = mock_resp
        cards = list_collection_cards(session, "http://localhost:3000", 4)
        self.assertEqual(len(cards), 2)
        self.assertEqual({c["id"] for c in cards}, {10, 30})

    def test_raises_when_http_error(self) -> None:
        mock_resp = MagicMock()
        mock_resp.ok = False
        session = MagicMock()
        session.get.return_value = mock_resp
        with self.assertRaises(MetabaseError):
            list_collection_cards(session, "http://localhost:3000", 1)


if __name__ == "__main__":
    unittest.main()
