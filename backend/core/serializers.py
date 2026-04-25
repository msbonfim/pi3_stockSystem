# core/serializers.py

from rest_framework import serializers
from .models import Category, Notification, Product, PushSubscription, Sale, SaleItem

# --- NOVO SERIALIZER PARA CATEGORY ---
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name']


class ProductSerializer(serializers.ModelSerializer):
    # Exibe o nome da categoria em vez de apenas o ID.
    # read_only=True significa que este campo é apenas para leitura na API de produto.
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)

    class Meta:
        model = Product
        # Adicionamos os novos campos à lista
        fields = [
            'id', 
            'name', 
            'description', 
            'price', 
            'quantity', 
            'expiration_date',
            'batch',
            'category', # ID da categoria, usado para criar/atualizar
            'category_name', # Nome da categoria, para exibição
            'created_at',
            'updated_at'
        ]


class SaleItemWriteSerializer(serializers.Serializer):
    product = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)


class SaleItemReadSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = SaleItem
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_price', 'line_total']
        read_only_fields = ['id', 'line_total']


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemReadSerializer(many=True, read_only=True)

    class Meta:
        model = Sale
        fields = ['id', 'sold_at', 'gross_revenue', 'notes', 'created_at', 'items']
        read_only_fields = ['id', 'gross_revenue', 'created_at', 'items']


class SaleCreateSerializer(serializers.Serializer):
    sold_at = serializers.DateTimeField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=255)
    items = SaleItemWriteSerializer(many=True, min_length=1)


class NotificationSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, allow_null=True)
    
    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'message',
            'notification_type',
            'read',
            'product',
            'product_name',
            'created_at'
        ]
        read_only_fields = ['created_at']


class PushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushSubscription
        fields = ['id', 'endpoint', 'p256dh', 'auth', 'active', 'created_at']
        read_only_fields = ['created_at']


# Serializer para Django Q Schedule
try:
    from django_q2.models import Schedule
    
    class ScheduleSerializer(serializers.ModelSerializer):
        """Serializer para agendamentos de notificações"""
        schedule_type_display = serializers.CharField(source='get_schedule_type_display', read_only=True)
        is_active = serializers.SerializerMethodField()
        next_run_local = serializers.SerializerMethodField()
        
        class Meta:
            model = Schedule
            fields = [
                'id',
                'name',
                'func',
                'schedule_type',
                'schedule_type_display',
                'repeats',
                'next_run',
                'next_run_local',  # Versão convertida para timezone local
                'minutes',
                'hook',
                'args',
                'kwargs',
                'is_active',
            ]
            read_only_fields = ['id']
        
        def get_next_run_local(self, obj):
            """Retorna next_run convertido para timezone local"""
            from django.utils import timezone
            if obj.next_run:
                local_time = timezone.localtime(obj.next_run)
                return local_time.isoformat()
            return None
        
        def get_is_active(self, obj):
            """Verifica se o schedule está ativo (tem next_run no futuro)"""
            from django.utils import timezone
            if obj.next_run:
                # Usa localtime para comparação correta
                local_next = timezone.localtime(obj.next_run)
                local_now = timezone.localtime(timezone.now())
                return local_next > local_now
            return False
        
        def validate_func(self, value):
            """Valida que a função existe"""
            # Remove espaços e caracteres especiais do markdown
            import re
            # Se tiver markdown, extrai a função
            match = re.search(r'`([^`]+)`', value)
            if match:
                return match.group(1)
            return value.strip()
    
except ImportError:
    # Se django_q não estiver disponível, cria um serializer vazio
    ScheduleSerializer = None