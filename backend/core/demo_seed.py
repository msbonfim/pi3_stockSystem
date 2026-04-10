"""
Dados de demonstração para desenvolvimento e BI (Metabase lê as mesmas tabelas no Postgres).

Tabelas principais no banco: core_category, core_brand, core_product.
"""

from __future__ import annotations

from datetime import date, timedelta

from core.models import Brand, Category, Product


def seed_demo_data() -> None:
    """Cria categorias, marcas e produtos de exemplo (idempotente por nome)."""
    print("Criando dados de demonstração...")

    cat_hair, _ = Category.objects.get_or_create(name="Cabelo")
    cat_finish, _ = Category.objects.get_or_create(name="Finalização")
    cat_dairy, _ = Category.objects.get_or_create(name="Laticínios")
    cat_higiene, _ = Category.objects.get_or_create(name="Higiene")

    brand_a, _ = Brand.objects.get_or_create(name="Marca Demo A")
    brand_b, _ = Brand.objects.get_or_create(name="Marca Demo B")

    today = date.today()

    products_data: list[dict] = [
        {
            "name": "Shampoo Hidratante",
            "description": "Shampoo hidratante para todos os tipos de cabelo",
            "price": 25.90,
            "quantity": 10,
            "expiration_date": today - timedelta(days=5),
            "category": cat_hair,
            "brand": brand_a,
            "batch": "SH20250101",
        },
        {
            "name": "Máscara Capilar Reconstrutora",
            "description": "Máscara capilar para reconstrução intensa dos fios",
            "price": 45.50,
            "quantity": 5,
            "expiration_date": today + timedelta(days=2),
            "category": cat_hair,
            "brand": brand_a,
            "batch": "MC20250115",
        },
        {
            "name": "Creme para Pentear",
            "description": "Creme para pentear sem enxágue, ideal para uso diário",
            "price": 18.90,
            "quantity": 20,
            "expiration_date": today + timedelta(days=15),
            "category": cat_hair,
            "brand": brand_b,
            "batch": "CP20250201",
        },
        {
            "name": "Leite Integral",
            "description": "Leite integral pasteurizado",
            "price": 4.50,
            "quantity": 30,
            "expiration_date": today + timedelta(days=7),
            "category": cat_dairy,
            "brand": brand_b,
            "batch": "LT20250120",
        },
        {
            "name": "Spray Fixador",
            "description": "Spray fixador de alta duração para penteados",
            "price": 32.90,
            "quantity": 18,
            "expiration_date": today + timedelta(days=60),
            "category": cat_finish,
            "brand": brand_a,
            "batch": "SF20250301",
        },
        # extras para gráficos (estoque / preço / categorias)
        {
            "name": "Condicionador Nutritivo",
            "description": "Condicionador para uso diário",
            "price": 22.00,
            "quantity": 2,
            "expiration_date": today + timedelta(days=1),
            "category": cat_hair,
            "brand": brand_b,
            "batch": "CN20250401",
        },
        {
            "name": "Sabonete Líquido 500ml",
            "description": "Higiene corporal",
            "price": 12.50,
            "quantity": 45,
            "expiration_date": today + timedelta(days=120),
            "category": cat_higiene,
            "brand": brand_a,
            "batch": "SB20250501",
        },
        {
            "name": "Iogurte Natural",
            "description": "Iogurte natural 1kg",
            "price": 9.90,
            "quantity": 12,
            "expiration_date": today - timedelta(days=1),
            "category": cat_dairy,
            "brand": brand_b,
            "batch": "IO20250310",
        },
    ]

    for row in products_data:
        _, created = Product.objects.get_or_create(
            name=row["name"],
            defaults={
                "description": row["description"],
                "price": row["price"],
                "quantity": row["quantity"],
                "expiration_date": row["expiration_date"],
                "category": row["category"],
                "brand": row.get("brand"),
                "batch": row.get("batch"),
            },
        )
        if created:
            print(f"✅ Produto criado: {row['name']}")
        else:
            print(f"⚠️ Produto já existe: {row['name']}")

    print(f"\nTotais — produtos: {Product.objects.count()}, categorias: {Category.objects.count()}, marcas: {Brand.objects.count()}")
    print("Concluído.")
