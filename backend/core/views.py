# core/views.py

import logging

from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from decimal import Decimal

from django.db.models import Count, F, Q, Sum
from django.db.models import DecimalField, ExpressionWrapper
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta, date
from .models import Product, Category, Notification, PushSubscription
from .serializers import ProductSerializer, CategorySerializer, NotificationSerializer, PushSubscriptionSerializer

logger = logging.getLogger(__name__)
# django_q2 é importado como django_q
# from django_q.tasks import async_task  # Não usado por enquanto

# Imports para o filtro
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

# View para listar e criar produtos
class ProductListCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'batch']
    search_fields = ['name', 'description', 'batch']
    ordering_fields = ['name', 'price', 'expiration_date']

# View para detalhes, atualizar e deletar produtos
class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

# View para listar produtos próximos do vencimento
class ExpiringProductsView(generics.ListAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        """
        Retorna produtos que irão expirar nos próximos 30 dias
        """
        today = timezone.now().date()
        expiration_limit = today + timedelta(days=30)

        return Product.objects.filter(
            expiration_date__gte=today,
            expiration_date__lte=expiration_limit,
            quantity__gt=0
        ).order_by('expiration_date')

# View para listar produtos vencidos
class ExpiredProductsView(generics.ListAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        """
        Retorna produtos já vencidos
        """
        today = timezone.now().date()
        return Product.objects.filter(
            expiration_date__lt=today
        ).order_by('expiration_date')

# View para categorias
class CategoryListCreateView(generics.ListCreateAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

# Endpoint para estatísticas do dashboard
@api_view(['GET'])
def dashboard_stats(request):
    """
    Retorna estatísticas para o dashboard
    Nova classificação:
    - Vencidos: < 0 dias
    - Críticos: 0-3 dias  
    - Aviso: 4-7 dias
    - Bom: > 7 dias
    """
    today = date.today()
    
    total_products = Product.objects.count()
    expired_products = Product.objects.filter(expiration_date__lt=today).count()
    
    # Críticos: 0-3 dias
    critical_products = Product.objects.filter(
        expiration_date__gte=today,
        expiration_date__lte=today + timedelta(days=3)
    ).count()
    
    # Aviso: 4-7 dias
    expiring_soon = Product.objects.filter(
        expiration_date__gte=today + timedelta(days=4),
        expiration_date__lte=today + timedelta(days=7)
    ).count()
    
    low_stock = Product.objects.filter(quantity__lt=10).count()
    
    # Log para debug
    print(f"📊 Estatísticas calculadas - Data: {today}")
    print(f"Total: {total_products}, Vencidos: {expired_products}, Críticos: {critical_products}, Aviso: {expiring_soon}")
    
    return Response({
        'total_products': total_products,
        'expired_products': expired_products,
        'critical_products': critical_products,
        'expiring_soon': expiring_soon,
        'low_stock': low_stock,
        'good_products': total_products - expired_products - critical_products - expiring_soon
    })


def _line_value_expr():
    return ExpressionWrapper(
        F('quantity') * F('price'),
        output_field=DecimalField(max_digits=14, decimal_places=2),
    )


def build_analytics_payload(request):
    """
    Agregações via ORM (fallback quando o Metabase não está configurado).
    Query params: low_stock_max (default 5)
    """
    today = date.today()
    low_max = int(request.query_params.get('low_stock_max', 5))

    products = Product.objects.all()
    total_units = products.aggregate(u=Coalesce(Sum('quantity'), 0))['u'] or 0
    total_value = products.aggregate(
        v=Coalesce(Sum(_line_value_expr()), Decimal('0'))
    )['v'] or Decimal('0')

    by_category = []
    for row in (
        Product.objects.values('category__name')
        .annotate(
            product_count=Count('id'),
            units=Coalesce(Sum('quantity'), 0),
            stock_value=Coalesce(Sum(_line_value_expr()), Decimal('0')),
        )
        .order_by('-stock_value')
    ):
        by_category.append({
            'name': row['category__name'] or '(sem categoria)',
            'product_count': row['product_count'],
            'units': row['units'],
            'stock_value': float(row['stock_value'] or 0),
        })

    by_brand = []
    for row in (
        Product.objects.values('brand__name')
        .annotate(
            product_count=Count('id'),
            units=Coalesce(Sum('quantity'), 0),
            stock_value=Coalesce(Sum(_line_value_expr()), Decimal('0')),
        )
        .order_by('-stock_value')
    ):
        by_brand.append({
            'name': row['brand__name'] or '(sem marca)',
            'product_count': row['product_count'],
            'units': row['units'],
            'stock_value': float(row['stock_value'] or 0),
        })

    low_stock = list(
        Product.objects.filter(quantity__lte=low_max)
        .select_related('category', 'brand')
        .order_by('quantity', 'name')[:100]
        .values(
            'id',
            'name',
            'quantity',
            'price',
            'expiration_date',
            'category__name',
            'brand__name',
        )
    )
    for p in low_stock:
        p['price'] = float(p['price'])
        if p['expiration_date']:
            p['expiration_date'] = p['expiration_date'].isoformat()
        p['category'] = p.pop('category__name')
        p['brand'] = p.pop('brand__name')

    top_by_value = []
    for p in (
        Product.objects.annotate(line_value=_line_value_expr())
        .order_by('-line_value')[:10]
        .values('id', 'name', 'quantity', 'price', 'line_value')
    ):
        top_by_value.append({
            'id': p['id'],
            'name': p['name'],
            'quantity': p['quantity'],
            'price': float(p['price']),
            'line_value': float(p['line_value'] or 0),
        })

    expiring = {
        'expired_count': Product.objects.filter(expiration_date__lt=today).count(),
        'next_7_days_count': Product.objects.filter(
            expiration_date__gte=today,
            expiration_date__lt=today + timedelta(days=7),
        ).count(),
        'next_30_days_count': Product.objects.filter(
            expiration_date__gte=today,
            expiration_date__lt=today + timedelta(days=30),
        ).count(),
    }

    return {
        'overview': {
            'total_products': products.count(),
            'total_units': total_units,
            'total_stock_value': float(total_value),
        },
        'by_category': by_category,
        'by_brand': by_brand,
        'low_stock': low_stock,
        'low_stock_threshold': low_max,
        'top_by_stock_value': top_by_value,
        'expiration': expiring,
    }


@api_view(['GET'])
def dashboard_analytics(request):
    """BI via ORM (Postgres/SQLite)."""
    return Response(build_analytics_payload(request))


@api_view(['GET'])
def metabase_analytics(request):
    """
    BI executado no Metabase (cards guardados). Credenciais só no servidor.
    Se METABASE_* / METABASE_CARD_* não estiverem completos, usa o mesmo payload do ORM.

    Variáveis de ambiente: ver sistema_gestao/settings.py e core/metabase_cards.sql
    """
    from django.conf import settings as dj_settings

    from .metabase_client import (
        MetabaseError,
        find_collection_id_by_name,
        get_metabase_session,
        infer_card_ids_from_collection,
        list_collection_cards,
        metabase_cards_fully_configured,
        rows_to_dicts,
        run_card_query,
    )

    low_max = int(request.query_params.get('low_stock_max', 5))

    base = dj_settings.METABASE_URL.rstrip('/')
    ids = dict(dj_settings.METABASE_CARD_IDS)

    try:
        session = get_metabase_session()
    except MetabaseError as e:
        payload = build_analytics_payload(request)
        payload['_meta'] = {
            'source': 'django_orm',
            'reason': 'metabase_auth_error',
            'hint': str(e),
        }
        return Response(payload)

    # Se IDs não estiverem completos, tenta descobrir pela collection do Metabase.
    needed = ("overview", "by_category", "by_brand", "low_stock", "top_by_stock_value", "expiration")
    if not all(ids.get(k) for k in needed):
        collection_name = (request.query_params.get("collection") or getattr(dj_settings, "METABASE_COLLECTION_NAME", "")).strip()
        if collection_name:
            try:
                cid = find_collection_id_by_name(session, base, collection_name)
                cards = list_collection_cards(session, base, cid) if cid else []
                inferred = infer_card_ids_from_collection(cards)
                for k, v in inferred.items():
                    if not ids.get(k) and v:
                        ids[k] = v
            except MetabaseError:
                pass

    if not all(ids.get(k) for k in needed):
        payload = build_analytics_payload(request)
        payload['_meta'] = {
            'source': 'django_orm',
            'reason': 'metabase_incomplete',
            'hint': 'Defina METABASE_CARD_* ou METABASE_COLLECTION_NAME com nomes claros das 6 perguntas.',
            'missing': [k for k in needed if not ids.get(k)],
        }
        return Response(payload)

    try:
        ov_data = run_card_query(session, base, ids['overview'])
        ov_rows = ov_data.get('rows') or []
        if not ov_rows:
            raise MetabaseError('Card overview sem linhas.')
        r0 = ov_rows[0]
        overview = {
            'total_products': int((r0[0] if len(r0) > 0 else 0) or 0),
            'total_units': int((r0[1] if len(r0) > 1 else 0) or 0),
            'total_stock_value': float((r0[2] if len(r0) > 2 else 0) or 0),
        }

        by_category = []
        by_category_data = run_card_query(session, base, ids['by_category'])
        for row in (by_category_data.get('rows') or []):
            by_category.append({
                'name': (row[0] if len(row) > 0 else None) or '(sem categoria)',
                'product_count': int((row[1] if len(row) > 1 else 0) or 0),
                'units': int((row[2] if len(row) > 2 else 0) or 0),
                'stock_value': float((row[3] if len(row) > 3 else 0) or 0),
            })

        by_brand = []
        by_brand_data = run_card_query(session, base, ids['by_brand'])
        for row in (by_brand_data.get('rows') or []):
            by_brand.append({
                'name': (row[0] if len(row) > 0 else None) or '(sem marca)',
                'product_count': int((row[1] if len(row) > 1 else 0) or 0),
                'units': int((row[2] if len(row) > 2 else 0) or 0),
                'stock_value': float((row[3] if len(row) > 3 else 0) or 0),
            })

        low_stock_data = run_card_query(session, base, ids['low_stock'])
        low_stock_raw = low_stock_data.get('rows') or []
        low_stock = []
        for row in low_stock_raw:
            ed = row[4] if len(row) > 4 else None
            if hasattr(ed, 'isoformat'):
                ed = ed.isoformat()[:10]
            try:
                pid = int((row[0] if len(row) > 0 else 0) or 0)
            except (TypeError, ValueError):
                continue
            low_stock.append({
                'id': pid,
                'name': (row[1] if len(row) > 1 else '') or '',
                'quantity': int((row[2] if len(row) > 2 else 0) or 0),
                'price': float((row[3] if len(row) > 3 else 0) or 0),
                'expiration_date': ed,
                'category': (row[5] if len(row) > 5 else None) or None,
                'brand': (row[6] if len(row) > 6 else None) or None,
            })

        top_by_value = []
        top_data = run_card_query(session, base, ids['top_by_stock_value'])
        for idx, row in enumerate((top_data.get('rows') or []), start=1):
            # Alguns cards não retornam ID; usamos chave sintética para não descartar dados.
            raw_id = (row[0] if len(row) > 0 else None)
            try:
                tid = int(raw_id) if raw_id is not None else -(100000 + idx)
            except (TypeError, ValueError):
                tid = -(100000 + idx)
            top_by_value.append({
                'id': tid,
                'name': (row[1] if len(row) > 1 else '') or f'Item {idx}',
                'quantity': int((row[2] if len(row) > 2 else 0) or 0),
                'price': float((row[3] if len(row) > 3 else 0) or 0),
                'line_value': float((row[4] if len(row) > 4 else 0) or 0),
            })

        ex_data = run_card_query(session, base, ids['expiration'])
        ex_rows = ex_data.get('rows') or []
        if not ex_rows:
            raise MetabaseError('Card expiration sem linhas.')
        er = ex_rows[0]
        expiring = {
            'expired_count': int((er[0] if len(er) > 0 else 0) or 0),
            'next_7_days_count': int((er[1] if len(er) > 1 else 0) or 0),
            'next_30_days_count': int((er[2] if len(er) > 2 else 0) or 0),
        }

        payload = {
            'overview': overview,
            'by_category': by_category,
            'by_brand': by_brand,
            'low_stock': low_stock,
            'low_stock_threshold': low_max,
            'top_by_stock_value': top_by_value,
            'expiration': expiring,
            '_meta': {
                'source': 'metabase',
                'note': 'Lista estoque baixo usa o limite fixo do SQL do card Metabase (ex.: 5).',
            },
        }
        return Response(payload)

    except MetabaseError as e:
        return Response(
            {'error': str(e), '_meta': {'source': 'error', 'hint': 'Ver IDs dos cards e SQL em core/metabase_cards.sql'}},
            status=502,
        )
    except (KeyError, TypeError, ValueError) as e:
        logger.exception('metabase_analytics parse error')
        return Response(
            {'error': f'Formato inesperado do Metabase: {e}'},
            status=502,
        )


# Views para Notificações
class NotificationListCreateView(generics.ListCreateAPIView):
    serializer_class = NotificationSerializer
    
    def get_queryset(self):
        queryset = Notification.objects.all()
        read = self.request.query_params.get('read', None)
        if read is not None:
            queryset = queryset.filter(read=read.lower() == 'true')
        return queryset.order_by('-created_at')[:50]  # Últimas 50 notificações


class NotificationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer


@api_view(['POST'])
def mark_notification_read(request, notification_id):
    """Marca uma notificação como lida"""
    try:
        notification = Notification.objects.get(id=notification_id)
        notification.read = True
        notification.save()
        return Response({'success': True, 'message': 'Notificação marcada como lida'})
    except Notification.DoesNotExist:
        return Response({'error': 'Notificação não encontrada'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
def mark_all_notifications_read(request):
    """Marca todas as notificações como lidas"""
    Notification.objects.filter(read=False).update(read=True)
    return Response({'success': True, 'message': 'Todas as notificações foram marcadas como lidas'})


# Views para Push Subscriptions
class PushSubscriptionListCreateView(generics.ListCreateAPIView):
    serializer_class = PushSubscriptionSerializer
    queryset = PushSubscription.objects.filter(active=True)
    
    def perform_create(self, serializer):
        # Salva a subscription
        serializer.save()


@api_view(['POST'])
def unregister_push_subscription(request):
    """Desativa uma push subscription"""
    try:
        endpoint = request.data.get('endpoint')
        p256dh = request.data.get('p256dh')
        auth = request.data.get('auth')
        
        subscription = PushSubscription.objects.filter(
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth
        ).first()
        
        if subscription:
            subscription.active = False
            subscription.save()
            return Response({'success': True, 'message': 'Subscription desativada'})
        else:
            return Response({'error': 'Subscription não encontrada'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# Views para Schedules (Agendamentos)
try:
    from django_q.models import Schedule
    from .serializers import ScheduleSerializer
    
    class ScheduleListCreateView(generics.ListCreateAPIView):
        """Lista e cria schedules"""
        serializer_class = ScheduleSerializer
        queryset = Schedule.objects.all().order_by('name')
        
        def get_queryset(self):
            queryset = Schedule.objects.all().order_by('name')
            # Filtro opcional por função
            func_filter = self.request.query_params.get('func', None)
            if func_filter:
                queryset = queryset.filter(func__contains=func_filter)
            return queryset
    
    class ScheduleDetailView(generics.RetrieveUpdateDestroyAPIView):
        """Detalhes, atualiza e deleta schedule"""
        serializer_class = ScheduleSerializer
        queryset = Schedule.objects.all()
        
        def update(self, request, *args, **kwargs):
            """Atualiza um schedule"""
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            
            # Se next_run foi alterado, recalcula se necessário
            if 'next_run' in request.data:
                from django.utils import timezone
                if instance.next_run and instance.next_run <= timezone.now():
                    # Se next_run está no passado, pode precisar recalcular
                    pass
            
            return Response(serializer.data)
    
    @api_view(['POST'])
    def execute_schedule_now(request, schedule_id):
        """Executa um schedule manualmente"""
        try:
            schedule = Schedule.objects.get(id=schedule_id)
            # Executa a task imediatamente
            from django_q.tasks import async_task
            result = async_task(schedule.func, *schedule.args, **schedule.kwargs)
            return Response({
                'success': True,
                'message': 'Schedule executado com sucesso',
                'task_id': result
            })
        except Schedule.DoesNotExist:
            return Response({'error': 'Schedule não encontrado'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    SCHEDULE_VIEWS_AVAILABLE = True
    
except ImportError:
    SCHEDULE_VIEWS_AVAILABLE = False
    ScheduleListCreateView = None
    ScheduleDetailView = None
    execute_schedule_now = None