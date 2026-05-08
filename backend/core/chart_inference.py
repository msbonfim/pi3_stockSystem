"""Inferência de chart_type para cards Metabase (usado pela API e pelos testes unitários)."""


def col_type_metabase(col: dict) -> str:
    """Simplifica o tipo de coluna do Metabase em: string | number | date."""
    base_type = str(col.get("base_type") or col.get("effective_type") or "")
    if "Integer" in base_type or "Float" in base_type or "Decimal" in base_type or "BigInt" in base_type:
        return "number"
    if "DateTime" in base_type or "Date" in base_type or "Temporal" in base_type:
        return "date"
    return "string"


def infer_chart_type(cols: list[dict], card_name: str = "") -> str:
    """
    Sugere o melhor tipo de gráfico para os dados (valores expostos ao frontend).
    """
    types = [col_type_metabase(c) for c in cols]
    n_num = types.count("number")
    n_str = types.count("string")
    n_date = types.count("date")

    lower = (card_name or "").lower()
    if (
        ("cobertura" in lower and "categoria" in lower)
        or ("cobertura de estoque baixo" in lower)
    ):
        if n_num >= 2 and n_str >= 1:
            return "scatter"
    if any(k in lower for k in ("baixo estoque", "estoque baixo", "low stock")):
        if n_num >= 2 and n_str >= 1:
            return "scatter"

    if (
        ("estoque por categoria" in lower)
        or (
            "estoque" in lower
            and "categoria" in lower
            and ("quantidade" in lower or "valor" in lower)
        )
    ) and "cobertura" not in lower:
        if n_num >= 3 and n_str >= 1:
            return "combo_category_stock"

    if (
        "por categoria" in lower
        and "cobertura" not in lower
        and not (
            ("estoque por categoria" in lower)
            or (
                "estoque" in lower
                and "categoria" in lower
                and ("quantidade" in lower or "valor" in lower)
            )
        )
    ):
        if n_num >= 2 and n_str >= 1:
            return "nested_pie_equal_category"

    if "por marca" in lower and "cobertura" not in lower:
        if n_num >= 2 and n_str >= 1:
            return "nested_pie_equal_brand"

    if "valores mais altos" in lower or ("valores" in lower and "mais altos" in lower):
        if n_num >= 1 and n_str >= 1:
            return "nested_pie_high_values"

    if n_date >= 1 and n_num >= 1:
        return "line"
    if n_str >= 1 and n_num >= 1:
        return "bar"
    if n_num == len(types) and len(types) <= 3:
        return "metric"
    return "table"
