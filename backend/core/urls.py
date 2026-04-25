# core/urls.py

from django.urls import path
from .views import (
    ProductListCreateView, 
    ProductDetailView,
    ExpiringProductsView, 
    ExpiredProductsView,
    CategoryListCreateView,
    dashboard_stats,
    dashboard_analytics,
    metabase_analytics,
    sales_collection,
    sales_monthly_summary,
    NotificationListCreateView,
    NotificationDetailView,
    mark_notification_read,
    mark_all_notifications_read,
    PushSubscriptionListCreateView,
    unregister_push_subscription,
)

# Importa views de Schedule se disponível
try:
    from .views import (
        ScheduleListCreateView,
        ScheduleDetailView,
        execute_schedule_now,
        SCHEDULE_VIEWS_AVAILABLE,
    )
except ImportError:
    SCHEDULE_VIEWS_AVAILABLE = False

urlpatterns = [
    # Produtos
    path('products/', ProductListCreateView.as_view(), name='product-list-create'),
    path('products/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path('products/expiring-soon/', ExpiringProductsView.as_view(), name='expiring-products-list'),
    path('products/expired/', ExpiredProductsView.as_view(), name='expired-products-list'),
    
    # Categorias
    path('categories/', CategoryListCreateView.as_view(), name='category-list-create'),
    
    # Dashboard / BI (frontend + Metabase usam o mesmo Postgres)
    path('dashboard/stats/', dashboard_stats, name='dashboard-stats'),
    path('dashboard/analytics/', dashboard_analytics, name='dashboard-analytics'),
    path('bi/summary/', dashboard_analytics, name='bi-summary'),
    path('metabase/analytics/', metabase_analytics, name='metabase-analytics'),
    path('sales/', sales_collection, name='sales-collection'),
    path('sales/monthly-summary/', sales_monthly_summary, name='sales-monthly-summary'),
    
    # Notificações
    path('notifications/', NotificationListCreateView.as_view(), name='notification-list-create'),
    path('notifications/<int:pk>/', NotificationDetailView.as_view(), name='notification-detail'),
    path('notifications/<int:notification_id>/read/', mark_notification_read, name='mark-notification-read'),
    path('notifications/read-all/', mark_all_notifications_read, name='mark-all-notifications-read'),
    
    # Push Subscriptions
    path('push-subscriptions/', PushSubscriptionListCreateView.as_view(), name='push-subscription-list-create'),
    path('push-subscriptions/unregister/', unregister_push_subscription, name='unregister-push-subscription'),
]

# Adiciona rotas de Schedule se disponível
try:
    from .views import SCHEDULE_VIEWS_AVAILABLE, ScheduleListCreateView, ScheduleDetailView, execute_schedule_now
    if SCHEDULE_VIEWS_AVAILABLE:
        urlpatterns += [
            # Schedules (Agendamentos)
            path('schedules/', ScheduleListCreateView.as_view(), name='schedule-list-create'),
            path('schedules/<int:pk>/', ScheduleDetailView.as_view(), name='schedule-detail'),
            path('schedules/<int:schedule_id>/execute/', execute_schedule_now, name='schedule-execute'),
        ]
except:
    pass