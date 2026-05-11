import { describe, expect, it } from "vitest";
import {
  buildComboCategoryStockRows,
  buildHighValuesPieRows,
  buildNestedPieRingRows,
  buildSalesRevenueMonthRows,
  formatSalesMonthAxisLabel,
  gridCardSortOrder,
  isTopSummaryCardName,
  norm,
  partitionReportCards,
  resolveCategoryCoverageScatterKeys,
  resolveComboCategoryStockKeys,
  resolveNestedPieRingKeys,
  resolveScatterKeys,
  type AutoCard,
} from "./metabaseReports.logic";

function card(partial: Partial<AutoCard> & Pick<AutoCard, "name" | "col_names" | "col_types" | "rows">): AutoCard {
  return {
    id: partial.id ?? 1,
    name: partial.name,
    description: partial.description,
    chart_type: partial.chart_type ?? "bar",
    col_names: partial.col_names,
    col_types: partial.col_types,
    rows: partial.rows,
    metric_values: partial.metric_values ?? {},
    error: partial.error,
  };
}

describe("norm", () => {
  it("remove acentos e minúsculas", () => {
    expect(norm("ÀÉÇ POR MARCA")).toBe("aec por marca");
  });
});

describe("partitionReportCards", () => {
  it("separa resumo no topo e ordena grelha com prioridade fixa", () => {
    const c1 = card({
      name: "Outro",
      col_names: ["a"],
      col_types: ["string"],
      rows: [],
    });
    const c2 = card({
      name: "Valores totais",
      col_names: ["a"],
      col_types: ["number"],
      rows: [],
    });
    const c3 = card({
      name: "PRODUTOS VENDIDOS NO MÊS vs RECEITA BRUTA",
      col_names: ["a"],
      col_types: ["string"],
      rows: [],
    });
    const c4 = card({
      name: "ESTOQUE POR CATEGORIA (quantidade e valor)",
      col_names: ["a"],
      col_types: ["string"],
      rows: [],
    });
    const { topSummaryCards, gridCards } = partitionReportCards([c1, c2, c3, c4]);
    expect(topSummaryCards.map((c) => c.name)).toEqual(["Valores totais"]);
    expect(gridCards.map((c) => c.name)).toEqual([
      "ESTOQUE POR CATEGORIA (quantidade e valor)",
      "PRODUTOS VENDIDOS NO MÊS vs RECEITA BRUTA",
      "Outro",
    ]);
  });
});

describe("gridCardSortOrder", () => {
  it("prioriza estoque por categoria e vendas vs receita", () => {
    expect(gridCardSortOrder("ESTOQUE POR CATEGORIA (quantidade e valor)")).toBe(0);
    expect(gridCardSortOrder("Produtos vendidos no mês vs receita bruta")).toBe(1);
    expect(gridCardSortOrder("X")).toBe(999);
  });
});

describe("isTopSummaryCardName", () => {
  it("identifica cards de resumo no topo", () => {
    expect(isTopSummaryCardName("Valores totais")).toBe(true);
    expect(isTopSummaryCardName("Vencidos + 30 dias")).toBe(true);
    expect(isTopSummaryCardName("Por validade")).toBe(true);
    expect(isTopSummaryCardName("Por categoria")).toBe(false);
  });
});

describe("resolveScatterKeys", () => {
  it("detecta nome, quantidade e preço", () => {
    const c = card({
      name: "low",
      col_names: ["id", "nome_produto", "quantidade", "preco"],
      col_types: ["number", "string", "number", "number"],
      rows: [],
    });
    expect(resolveScatterKeys(c)).toEqual({
      nameKey: "nome_produto",
      qtyKey: "quantidade",
      priceKey: "preco",
    });
  });
});

describe("resolveCategoryCoverageScatterKeys", () => {
  it("encontra colunas de cobertura por categoria", () => {
    const c = card({
      name: "Cobertura por categoria",
      col_names: ["categoria", "itens_estoque_baixo", "total_itens"],
      col_types: ["string", "number", "number"],
      rows: [],
    });
    expect(resolveCategoryCoverageScatterKeys(c)).toEqual({
      catKey: "categoria",
      lowItemsKey: "itens_estoque_baixo",
      totalKey: "total_itens",
    });
  });
});

describe("resolveComboCategoryStockKeys", () => {
  it("resolve chaves e buildComboCategoryStockRows monta linhas", () => {
    const c = card({
      name: "Estoque por categoria",
      col_names: ["categoria", "total_produtos", "total_unidades", "valor_estoque"],
      col_types: ["string", "number", "number", "number"],
      rows: [
        {
          categoria: "X",
          total_produtos: 1,
          total_unidades: 10,
          valor_estoque: 99.5,
        },
      ],
    });
    expect(resolveComboCategoryStockKeys(c)).toEqual({
      catKey: "categoria",
      prodKey: "total_produtos",
      unitsKey: "total_unidades",
      valueKey: "valor_estoque",
    });
    expect(buildComboCategoryStockRows(c)).toEqual([
      { categoria: "X", total_produtos: 1, total_unidades: 10, valor_estoque: 99.5 },
    ]);
  });
});

describe("resolveNestedPieRingKeys", () => {
  it("modo categoria usa coluna de categoria", () => {
    const c = card({
      name: "por categoria",
      col_names: ["categoria", "total_produtos", "valor_estoque"],
      col_types: ["string", "number", "number"],
      rows: [],
    });
    expect(resolveNestedPieRingKeys(c, "category")).toEqual({
      labelKey: "categoria",
      countKey: "total_produtos",
      valueKey: "valor_estoque",
    });
  });
});

describe("buildNestedPieRingRows", () => {
  it("monta linhas por marca", () => {
    const c = card({
      name: "por marca",
      col_names: ["marca", "total_produtos", "valor_estoque"],
      col_types: ["string", "number", "number"],
      rows: [
        { marca: "A", total_produtos: 2, valor_estoque: 10 },
        { marca: "B", total_produtos: 3, valor_estoque: 20 },
      ],
    });
    const rows = buildNestedPieRingRows(c, "brand");
    expect(rows).toEqual([
      { segment: "A", product_count: 2, stock_value: 10 },
      { segment: "B", product_count: 3, stock_value: 20 },
    ]);
  });

  it("retorna null se nenhuma linha válida", () => {
    const c = card({
      name: "por marca",
      col_names: ["marca", "total_produtos", "valor_estoque"],
      col_types: ["string", "number", "number"],
      rows: [{ marca: "A", total_produtos: Number.NaN, valor_estoque: 1 }],
    });
    expect(buildNestedPieRingRows(c, "brand")).toBeNull();
  });
});

describe("buildSalesRevenueMonthRows", () => {
  it("só ativa para título compatível", () => {
    const wrong = card({
      name: "Vendas",
      col_names: ["mes", "a", "b"],
      col_types: ["string", "number", "number"],
      rows: [{ mes: "Jan", a: 1, b: 2 }],
    });
    expect(buildSalesRevenueMonthRows(wrong)).toBeNull();

    const ok = card({
      name: "Produtos vendidos no mês vs receita bruta",
      col_names: ["mes", "produtos_vendidos", "receita_bruta"],
      col_types: ["string", "number", "number"],
      rows: [{ mes: "Jan", produtos_vendidos: 5, receita_bruta: 100 }],
    });
    expect(buildSalesRevenueMonthRows(ok)).toEqual([
      { label: "Jan", produtos_vendidos: 5, receita_bruta: 100 },
    ]);
  });

  it("rótulo de data ISO sem hora no eixo", () => {
    const c = card({
      name: "Produtos vendidos no mês vs receita bruta",
      col_names: ["dia", "produtos_vendidos", "receita_bruta"],
      col_types: ["date", "number", "number"],
      rows: [
        { dia: "2026-05-01T14:30:00", produtos_vendidos: 3, receita_bruta: 50 },
        { dia: "2026-05-07T00:00:00.000Z", produtos_vendidos: 1, receita_bruta: 10 },
      ],
    });
    expect(buildSalesRevenueMonthRows(c)).toEqual([
      { label: "01/05/2026", produtos_vendidos: 3, receita_bruta: 50 },
      { label: "07/05/2026", produtos_vendidos: 1, receita_bruta: 10 },
    ]);
  });
});

describe("formatSalesMonthAxisLabel", () => {
  it("extrai só a parte da data em ISO com hora", () => {
    expect(formatSalesMonthAxisLabel("2026-01-15T23:59:59")).toBe("15/01/2026");
  });
  it("mantém texto que não é ISO no início", () => {
    expect(formatSalesMonthAxisLabel("Jan")).toBe("Jan");
  });
});

describe("buildHighValuesPieRows", () => {
  it("ignora preço inválido", () => {
    const c = card({
      name: "x",
      col_names: ["nome_produto", "preco"],
      col_types: ["string", "number"],
      rows: [
        { nome_produto: "P1", preco: 10 },
        { nome_produto: "P2", preco: Number.NaN },
      ],
    });
    const rows = buildHighValuesPieRows(c);
    expect(rows).toEqual([{ segment: "P1", preco: 10 }]);
  });
});
