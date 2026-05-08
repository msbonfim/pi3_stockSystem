"""Testes unitários de inferência de tipo de gráfico Metabase (sem Django)."""

from __future__ import annotations

import unittest

from core.chart_inference import col_type_metabase, infer_chart_type


def col(name: str, base_type: str) -> dict:
    return {"display_name": name, "base_type": base_type}


class ColTypeMetabaseTests(unittest.TestCase):
    def test_numeric_and_date_and_string(self) -> None:
        self.assertEqual(col_type_metabase({"base_type": "type/Integer"}), "number")
        self.assertEqual(col_type_metabase({"base_type": "type/Float"}), "number")
        self.assertEqual(col_type_metabase({"base_type": "type/Date"}), "date")
        self.assertEqual(col_type_metabase({"base_type": "type/Text"}), "string")


class InferChartTypeTests(unittest.TestCase):
    def test_special_titles(self) -> None:
        cases: list[tuple[str, list[dict], str]] = [
            (
                "Cobertura por categoria",
                [col("categoria", "type/Text"), col("a", "type/Integer"), col("b", "type/Integer")],
                "scatter",
            ),
            (
                "Estoque por categoria (quantidade e valor)",
                [
                    col("categoria", "type/Text"),
                    col("total_produtos", "type/Integer"),
                    col("total_unidades", "type/Integer"),
                    col("valor_estoque", "type/Float"),
                ],
                "combo_category_stock",
            ),
            (
                "POR CATEGORIA",
                [col("categoria", "type/Text"), col("qtd", "type/Integer"), col("valor", "type/Float")],
                "nested_pie_equal_category",
            ),
            (
                "por marca",
                [col("marca", "type/Text"), col("n", "type/Integer"), col("v", "type/Float")],
                "nested_pie_equal_brand",
            ),
            (
                "Valores mais altos",
                [col("nome_produto", "type/Text"), col("preco", "type/Float")],
                "nested_pie_high_values",
            ),
            (
                "Alguns valores mais altos",
                [col("nome", "type/Text"), col("preco", "type/Float")],
                "nested_pie_high_values",
            ),
            (
                "Vendas",
                [col("mes", "type/Date"), col("qtd", "type/Integer")],
                "line",
            ),
            (
                "Rank",
                [col("nome", "type/Text"), col("score", "type/Integer")],
                "bar",
            ),
            (
                "KPI",
                [col("a", "type/Integer"), col("b", "type/Integer")],
                "metric",
            ),
            (
                "Muitas métricas",
                [
                    col("a", "type/Integer"),
                    col("b", "type/Integer"),
                    col("c", "type/Integer"),
                    col("d", "type/Integer"),
                ],
                "table",
            ),
        ]
        for title, cols, expected in cases:
            with self.subTest(title=title):
                self.assertEqual(infer_chart_type(cols, title), expected)

    def test_estoque_por_categoria_long_title_is_combo(self) -> None:
        cols = [
            col("categoria", "type/Text"),
            col("total_produtos", "type/Integer"),
            col("total_unidades", "type/Integer"),
            col("valor_estoque", "type/Float"),
        ]
        self.assertEqual(
            infer_chart_type(cols, "ESTOQUE POR CATEGORIA (quantidade e valor)"),
            "combo_category_stock",
        )


if __name__ == "__main__":
    unittest.main()
