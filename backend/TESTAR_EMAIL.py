#!/usr/bin/env python
"""
Script para testar envio de e-mail
Execute: python TESTAR_EMAIL.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sistema_gestao.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings

print("=" * 60)
print("Teste de Envio de E-mail")
print("=" * 60)
print()

# 1. Verificar configurações
print("📋 Verificando configurações...")
print()

email_backend = getattr(settings, 'EMAIL_BACKEND', 'Não configurado')
print(f"EMAIL_BACKEND: {email_backend}")

if email_backend == 'django.core.mail.backends.console.EmailBackend':
    print("✅ Modo: DESENVOLVIMENTO (e-mails aparecem no console)")
    print("   Os e-mails NÃO serão enviados, apenas impressos no terminal")
    print()
else:
    email_host = getattr(settings, 'EMAIL_HOST', None)
    email_port = getattr(settings, 'EMAIL_PORT', None)
    email_user = getattr(settings, 'EMAIL_HOST_USER', None)
    email_from = getattr(settings, 'DEFAULT_FROM_EMAIL', None)
    
    print(f"EMAIL_HOST: {email_host}")
    print(f"EMAIL_PORT: {email_port}")
    print(f"EMAIL_HOST_USER: {email_user}")
    print(f"DEFAULT_FROM_EMAIL: {email_from}")
    print()
    
    if not email_host or not email_user:
        print("⚠️ EMAIL_HOST ou EMAIL_HOST_USER não configurados!")
        print("   Configure em settings.py ou variáveis de ambiente")
        print()

notification_emails = getattr(settings, 'NOTIFICATION_EMAILS', [])
print(f"NOTIFICATION_EMAILS: {notification_emails}")
print()

if not notification_emails or notification_emails == ['admin@example.com']:
    print("⚠️ NOTIFICATION_EMAILS não configurado ou está com valor padrão!")
    print("   Configure em settings.py:")
    print("   NOTIFICATION_EMAILS = ['seu_email@exemplo.com']")
    print("   Ou via variável de ambiente: NOTIFICATION_EMAILS='email1@exemplo.com,email2@exemplo.com'")
    print()

# 2. Testar envio
print("=" * 60)
print("🧪 Testando envio de e-mail...")
print("=" * 60)
print()

if not notification_emails or notification_emails == ['admin@example.com']:
    print("❌ Não é possível testar: NOTIFICATION_EMAILS não configurado")
    print()
    print("Configure primeiro e execute novamente:")
    print("  NOTIFICATION_EMAILS = ['seu_email@exemplo.com']")
    exit(1)

try:
    result = send_mail(
        subject='📧 Teste de E-mail - StockSystem',
        message='Este é um e-mail de teste do sistema de notificações.\n\nSe você recebeu este e-mail, a configuração está funcionando! ✅',
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@stockystem.com'),
        recipient_list=notification_emails,
        fail_silently=False
    )
    
    if email_backend == 'django.core.mail.backends.console.EmailBackend':
        print("✅ E-mail 'enviado' (modo console)")
        print("   Verifique o TERMINAL onde o Django está rodando")
        print("   O e-mail deve aparecer lá!")
    else:
        print(f"✅ E-mail enviado com sucesso para {len(notification_emails)} destinatário(s)!")
        print()
        print("📬 Verifique:")
        print("   - Caixa de entrada")
        print("   - Lixo eletrônico/Spam")
        print("   - Aguarde alguns segundos/minutos")
        
except Exception as e:
    print(f"❌ Erro ao enviar e-mail: {e}")
    print()
    print("💡 Possíveis soluções:")
    print()
    print("1. Verifique as credenciais SMTP")
    print("   - Para Gmail: use senha de app, não a senha normal")
    print("   - Obtenha em: https://myaccount.google.com/apppasswords")
    print()
    print("2. Verifique o firewall")
    print("   - Porta 587 deve estar aberta")
    print()
    print("3. Teste manualmente as configurações SMTP")
    print()
    import traceback
    traceback.print_exc()

print()
print("=" * 60)

