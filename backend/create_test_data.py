#!/usr/bin/env python
import os
import sys
import django
from datetime import date, timedelta

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings')
django.setup()

from core.models import Category, Product

def create_test_data():
    print("Criando dados de teste...")
    
    # Criar categorias
    category1, created = Category.objects.get_or_create(name="Cabelo")
    category2, created = Category.objects.get_or_create(name="Finalização")
    category3, created = Category.objects.get_or_create(name="Laticínios")
    
    print(f"Categorias criadas: {Category.objects.count()}")
    
    # Criar produtos
    products_data = [
        {
            'name': 'Shampoo Hidratante',
            'description': 'Shampoo hidratante para todos os tipos de cabelo',
            'price': 25.90,
            'quantity': 10,
            'expiration_date': date.today() - timedelta(days=5),  # Vencido
            'category': category1,
            'batch': 'SH20250101'
        },
        {
            'name': 'Máscara Capilar Reconstrutora',
            'description': 'Máscara capilar para reconstrução intensa dos fios',
            'price': 45.50,
            'quantity': 5,
            'expiration_date': date.today() + timedelta(days=2),  # Próximo do vencimento
            'category': category1,
            'batch': 'MC20250115'
        },
        {
            'name': 'Creme para Pentear',
            'description': 'Creme para pentear sem enxágue, ideal para uso diário',
            'price': 18.90,
            'quantity': 20,
            'expiration_date': date.today() + timedelta(days=15),  # Válido
            'category': category1,
            'batch': 'CP20250201'
        },
        {
            'name': 'Leite Integral',
            'description': 'Leite integral pasteurizado',
            'price': 4.50,
            'quantity': 30,
            'expiration_date': date.today() + timedelta(days=7),  # Próximo do vencimento
            'category': category3,
            'batch': 'LT20250120'
        },
        {
            'name': 'Spray Fixador',
            'description': 'Spray fixador de alta duração para penteados',
            'price': 32.90,
            'quantity': 18,
            'expiration_date': date.today() + timedelta(days=60),  # Válido
            'category': category2,
            'batch': 'SF20250301'
        }
    ]
    
    for product_data in products_data:
        product, created = Product.objects.get_or_create(
            name=product_data['name'],
            defaults=product_data
        )
        if created:
            print(f"✅ Produto criado: {product.name}")
        else:
            print(f"⚠️ Produto já existe: {product.name}")
    
    print(f"\nTotal de produtos: {Product.objects.count()}")
    print(f"Total de categorias: {Category.objects.count()}")
    print("\nDados de teste criados com sucesso!")

if __name__ == "__main__":
    create_test_data()
