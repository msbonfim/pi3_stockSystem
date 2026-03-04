# core/views.py

from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta, date
from .models import Product, Category, Notification, PushSubscription
from .serializers import ProductSerializer, CategorySerializer, NotificationSerializer, PushSubscriptionSerializer
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