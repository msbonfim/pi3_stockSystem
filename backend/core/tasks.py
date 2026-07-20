# core/tasks.py

from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
from .models import Product, Notification
from .push_utils import send_push_notification, send_desktop_notification
from django.conf import settings
from django.contrib.auth.models import User
import logging

logger = logging.getLogger(__name__)

def check_expiring_products_and_notify():
    """
    Busca produtos próximos da validade (7 dias para críticos, 30 dias para avisos)
    e envia notificações por e-mail e push.
    """
    import sys
    print("\n" + "="*70, file=sys.stdout, flush=True)
    print(" EXECUTANDO: check_expiring_products_and_notify", file=sys.stdout, flush=True)
    print("="*70, file=sys.stdout, flush=True)
    logger.info("=" * 60)
    logger.info(" EXECUTANDO: check_expiring_products_and_notify")
    logger.info("=" * 60)
    today = timezone.now().date()
    
    # Produtos críticos: 0-7 dias
    critical_limit = today + timedelta(days=7)
    critical_products = Product.objects.filter(
        expiration_date__gte=today,
        expiration_date__lte=critical_limit,
        quantity__gt=0
    ).order_by('expiration_date')
    
    # Produtos em aviso: 8-30 dias
    warning_limit = today + timedelta(days=30)
    warning_products = Product.objects.filter(
        expiration_date__gt=critical_limit,
        expiration_date__lte=warning_limit,
        quantity__gt=0
    ).order_by('expiration_date')
    
    results = []
    
    # Processa produtos críticos
    if critical_products.exists():
        result_critical = _send_notifications_for_products(
            critical_products, 
            "CRÍTICO", 
            "produtos críticos próximos da validade",
            today
        )
        results.append(result_critical)
    
    # Processa produtos em aviso (apenas se não houver críticos, para evitar spam)
    if warning_products.exists() and not critical_products.exists():
        result_warning = _send_notifications_for_products(
            warning_products,
            "AVISO",
            "produtos próximos da validade",
            today
        )
        results.append(result_warning)
    
    if not results:
        logger.info("Nenhum produto próximo da validade encontrado.")
        return " Nenhum produto próximo da validade encontrado. Tudo em ordem!"
    
    return " | ".join(results)

def _send_notifications_for_products(products, severity, description, today):
    """Helper para enviar notificações de um grupo de produtos"""
    count = products.count()
    
    # Prepara mensagens em português
    if severity == "CRÍTICO":
        title = f" Alerta Crítico: {count} produto(s) próximo(s) da validade"
        push_message = f"{count} produto(s) vence(m) nos próximos 7 dias! Ação urgente necessária."
    else:
        title = f" Aviso: {count} produto(s) próximo(s) da validade"
        push_message = f"{count} produto(s) vence(m) nos próximos 30 dias."
    
    message_lines = [f"Os seguintes produtos estão próximos da data de validade ({severity}):\n"]
    message_lines.append("=" * 60 + "\n")
    
    notifications_created = 0
    
    for product in products:
        days_left = (product.expiration_date - today).days
        product_msg = (
            f"• {product.name}"
            f"{f' - Marca: {product.brand.name}' if product.brand else ''}"
            f"\n  Vence em: {days_left} dia(s) ({product.expiration_date.strftime('%d/%m/%Y')})"
            f"\n  Quantidade em estoque: {product.quantity} unidade(s)\n"
        )
        message_lines.append(product_msg)
        
        # Cria notificação no banco para cada produto com mensagem em português
        if days_left == 0:
            notification_title = f" {product.name} - Vence HOJE!"
            notification_msg = f"ATENÇÃO! {product.name} vence hoje ({product.expiration_date.strftime('%d/%m/%Y')}). Ação imediata necessária!"
        elif days_left <= 3:
            notification_title = f"🚨 {product.name} - Vence em {days_left} dia(s)"
            notification_msg = f"{product.name} vence em {days_left} dia(s) ({product.expiration_date.strftime('%d/%m/%Y')}). Quantidade: {product.quantity}."
        else:
            notification_title = f" {product.name} - Vence em {days_left} dias"
            notification_msg = f"{product.name} vence em {days_left} dias ({product.expiration_date.strftime('%d/%m/%Y')}). Quantidade: {product.quantity}."
        
        Notification.objects.create(
            title=notification_title,
            message=notification_msg,
            notification_type='expiring_soon',
            product=product
        )
        notifications_created += 1
    
    message = "\n".join(message_lines)
    message += "\n" + "=" * 60
    message += f"\n\nTotal de produtos: {count}"
    message += f"\nTipo de alerta: {severity}"
    message += f"\nData da verificação: {today.strftime('%d/%m/%Y')}\n"
    
    # Envia e-mail
    email_result = _send_email_notification(title, message)
    
    # Envia push notifications
    import sys
    print(f"\n{'='*70}", file=sys.stdout, flush=True)
    print(f"🚀 ENVIANDO PUSH NOTIFICATION - Produtos Próximos da Validade", file=sys.stdout, flush=True)
    print(f"{'='*70}", file=sys.stdout, flush=True)
    logger.info(f" Chamando send_push_notification para produtos próximos da validade...")
    push_result = send_push_notification(
        title=title,
        message=push_message,
        data={"type": "expiring_products", "count": count, "severity": severity.lower()}
    )
    print(f" Push resultado: {push_result}", file=sys.stdout, flush=True)
    logger.info(f" Resultado do push: {push_result}")
    
    # Envia notificação desktop (Windows) - aparece no monitor
    # Usa urgência crítica se for alerta crítico
    urgency = 'critical' if severity == "CRÍTICO" else 'normal'
    duration = 15 if severity == "CRÍTICO" else 10
    
    # Prepara mensagem resumida para desktop
    desktop_message = push_message
    if count > 5:
        # Se houver muitos produtos, mostra apenas os primeiros na notificação desktop
        first_products = products[:3]
        product_names = ", ".join([p.name for p in first_products])
        if count > 3:
            desktop_message = f"{product_names} e mais {count - 3} produto(s). {push_message}"
        else:
            desktop_message = f"{product_names}. {push_message}"
    
    desktop_result = send_desktop_notification(
        title=title,
        message=desktop_message,
        duration=duration,
        urgency=urgency
    )
    
    logger.info(
        f"Notificações enviadas: {notifications_created} no banco, "
        f"Email: {email_result}, Push: {push_result.get('sent', 0)} enviados, "
        f"Desktop: {'' if desktop_result.get('sent') else '❌'}"
    )
    
    desktop_status = "" if desktop_result.get('sent') else "❌"
    return f"{severity}: {count} produto(s) - Email: {email_result}, Push: {push_result.get('sent', 0)} enviados, Desktop: {desktop_status}"

def check_low_stock_and_notify(**kwargs):
    """
    Verifica produtos com estoque baixo (menos que min_quantity unidades)
    e envia notificações por e-mail, push e desktop.
    
    Args:
        min_quantity: Quantidade mínima para considerar estoque baixo (padrão: 2)
                      Pode ser passado via kwargs do schedule
    """
    import sys
    print("\n" + "="*70, file=sys.stdout, flush=True)
    print(" EXECUTANDO: check_low_stock_and_notify", file=sys.stdout, flush=True)
    print("="*70, file=sys.stdout, flush=True)
    logger.info("=" * 60)
    logger.info(" EXECUTANDO: check_low_stock_and_notify")
    logger.info("=" * 60)
    # Obtém min_quantity dos kwargs (pode vir do schedule) ou usa padrão
    min_quantity = kwargs.get('min_quantity', 2)
    print(f"📊 Min quantity: {min_quantity}", file=sys.stdout, flush=True)
    logger.info(f"📊 Min quantity: {min_quantity}")
    # Busca produtos com quantidade menor que min_quantity
    low_stock_products = Product.objects.filter(
        quantity__gt=0,  # Apenas produtos com estoque > 0
        quantity__lt=min_quantity
    ).order_by('quantity', 'name')
    
    if not low_stock_products.exists():
        msg = f"Nenhum produto com estoque baixo encontrado (menos de {min_quantity} unidades)."
        print(f"\n {msg}")
        logger.info(msg)
        return f" Nenhum produto com estoque baixo encontrado. Tudo em ordem!"
    
    count = low_stock_products.count()
    
    # Prepara mensagens
    title = f" Alerta: {count} produto(s) com estoque baixo"
    push_message = f"{count} produto(s) com menos de {min_quantity} unidade(s) em estoque!"
    
    message_lines = [f"Os seguintes produtos estão com estoque baixo (menos de {min_quantity} unidades):\n"]
    message_lines.append("=" * 60 + "\n")
    
    notifications_created = 0
    
    for product in low_stock_products:
        product_msg = (
            f"• {product.name}"
            f"{f' - Marca: {product.brand.name}' if product.brand else ''}"
            f"\n  Quantidade atual: {product.quantity} unidade(s)"
            f"\n  Preço: R$ {product.price:.2f}\n"
        )
        message_lines.append(product_msg)
        
        # Cria notificação no banco para cada produto
        if product.quantity == 0:
            notification_title = f" {product.name} - Estoque zerado!"
            notification_msg = f"ATENÇÃO! {product.name} está com estoque zerado. É necessário repor urgentemente!"
        elif product.quantity == 1:
            notification_title = f" {product.name} - Última unidade!"
            notification_msg = f"{product.name} está com apenas 1 unidade em estoque. Reposição necessária!"
        else:
            notification_title = f" {product.name} - Estoque baixo ({product.quantity} unidades)"
            notification_msg = f"{product.name} está com apenas {product.quantity} unidade(s) em estoque. Considere repor."
        
        Notification.objects.create(
            title=notification_title,
            message=notification_msg,
            notification_type='low_stock',
            product=product
        )
        notifications_created += 1
    
    message = "\n".join(message_lines)
    message += "\n" + "=" * 60
    message += f"\n\nTotal de produtos com estoque baixo: {count}"
    message += f"\nLimite configurado: menos de {min_quantity} unidades"
    message += f"\nData da verificação: {timezone.now().date().strftime('%d/%m/%Y')}\n"
    
    # Envia e-mail
    email_result = _send_email_notification(title, message)
    
    # Envia push notifications
    import sys
    print(f"\n{'='*70}", file=sys.stdout, flush=True)
    print(f"🚀 ENVIANDO PUSH NOTIFICATION - Estoque Baixo", file=sys.stdout, flush=True)
    print(f"{'='*70}", file=sys.stdout, flush=True)
    logger.info(f" Chamando send_push_notification para estoque baixo...")
    push_result = send_push_notification(
        title=title,
        message=push_message,
        data={"type": "low_stock", "count": count, "min_quantity": min_quantity}
    )
    print(f" Push resultado: {push_result}", file=sys.stdout, flush=True)
    logger.info(f" Resultado do push: {push_result}")
    
    # Envia notificação desktop (Windows)
    urgency = 'critical' if any(p.quantity == 0 for p in low_stock_products) else 'normal'
    duration = 15 if any(p.quantity <= 1 for p in low_stock_products) else 10
    
    # Prepara mensagem resumida para desktop
    desktop_message = push_message
    if count > 5:
        first_products = low_stock_products[:3]
        product_names = ", ".join([p.name for p in first_products])
        if count > 3:
            desktop_message = f"{product_names} e mais {count - 3} produto(s). {push_message}"
        else:
            desktop_message = f"{product_names}. {push_message}"
    
    desktop_result = send_desktop_notification(
        title=title,
        message=desktop_message,
        duration=duration,
        urgency=urgency
    )
    
    logger.info(
        f"Notificações de estoque baixo enviadas: {notifications_created} no banco, "
        f"Email: {email_result}, Push: {push_result.get('sent', 0)} enviados, "
        f"Desktop: {'' if desktop_result.get('sent') else '❌'}"
    )
    
    desktop_status = "" if desktop_result.get('sent') else "❌"
    return f"Estoque Baixo: {count} produto(s) - Email: {email_result}, Push: {push_result.get('sent', 0)} enviados, Desktop: {desktop_status}"


def _send_email_notification(subject, message):
    """Helper para enviar e-mail de notificação com timeout"""
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@yourdomain.com')
    recipient_list = getattr(settings, 'NOTIFICATION_EMAILS', ['admin@example.com'])
    
    # Se não houver emails configurados, retorna sem enviar
    if not recipient_list or recipient_list == ['admin@example.com']:
        logger.warning("NOTIFICATION_EMAILS não configurado. E-mail não enviado.")
        return "Email não configurado"
    
    try:
        # Usa send_mail com timeout configurado em settings (EMAIL_TIMEOUT)
        # O Django já aplica o timeout automaticamente se EMAIL_TIMEOUT estiver configurado
        send_mail(subject, message, from_email, recipient_list, fail_silently=False)
        logger.info(f"E-mail de alerta enviado para {recipient_list}")
        return f"Enviado para {len(recipient_list)} destinatário(s)"
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Falha ao enviar e-mail de alerta: {error_msg}")
        
        # Log específico para erros de rede
        if "Network is unreachable" in error_msg or "Errno 101" in error_msg:
            logger.warning("Rede não acessível - Render.com pode estar bloqueando conexões SMTP")
            logger.warning("Verifique configurações de firewall ou use serviço de email alternativo")
        
        # Retorna mensagem de erro mas não quebra a task
        # A task continua e pode enviar push notifications mesmo se email falhar
        return f"Erro ao enviar email: {error_msg[:100]}"
