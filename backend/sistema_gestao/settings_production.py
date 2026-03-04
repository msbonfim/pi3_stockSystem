"""
Django settings for sistema_gestao project - Production settings for Render.com
"""

import os
import dj_database_url
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-change-this-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'pi2-stocksystem-backend.onrender.com').split(',') if os.environ.get('ALLOWED_HOSTS') else ['pi2-stocksystem-backend.onrender.com']

# Application definition
INSTALLED_APPS = [
    'django_q.apps.DjangoQConfig',  # DEVE VIR ANTES do admin para que a tradução funcione
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'core',
    'rest_framework',
    'django_filters',
    'import_export',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Para servir arquivos estáticos
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.AdminModernizationMiddleware',  # Middleware para modernização do admin
]

ROOT_URLCONF = 'sistema_gestao.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'core' / 'templates'],
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
            'debug': DEBUG,
            'loaders': [
                ('django.template.loaders.cached.Loader', [
                    'django.template.loaders.filesystem.Loader',
                    'django.template.loaders.app_directories.Loader',
                ]),
            ],
        },
    },
]

WSGI_APPLICATION = 'sistema_gestao.wsgi.application'

X_FRAME_OPTIONS = 'SAMEORIGIN'

# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

DATABASES = {
    'default': dj_database_url.parse(
        os.environ.get('DATABASE_URL', 'sqlite:///db.sqlite3')
    )
}

# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

USE_I18N = True
LANGUAGE_CODE = 'pt-br'
LANGUAGES = [
    ('pt-br', 'Português (Brasil)'),
    ('en', 'English'),
]
LOCALE_PATHS = [
    BASE_DIR / 'locale',
    BASE_DIR / 'sistema_gestao' / 'locale',
]
TIME_ZONE = 'America/Sao_Paulo'
USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/
STATICFILES_DIRS = [
    BASE_DIR / "static",
    BASE_DIR / "core" / "static",  # Static files from core app
]
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Configuração do WhiteNoise
# Usando CompressedStaticFilesStorage (sem manifest) para evitar problemas com arquivos não encontrados
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# Configurações adicionais do WhiteNoise
# Habilitar finders como fallback caso os arquivos não estejam coletados
WHITENOISE_USE_FINDERS = True  # Permitir encontrar arquivos mesmo se não coletados
WHITENOISE_AUTOREFRESH = False  # Desabilitar auto-refresh em produção
WHITENOISE_INDEX_FILE = False  # Não gerar index.html
WHITENOISE_ROOT = STATIC_ROOT  # Diretório raiz dos arquivos estáticos

# Media files (Arquivos de Upload)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    "https://pi2-stock-system.vercel.app",
    # Adicione outros domínios do frontend em produção aqui
]

# Não permitir todas as origens em produção
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
}

# django-q2 Configuration
Q_CLUSTER = {
    'name': 'stock_notifications_prod',
    'workers': 1,
    'timeout': 180,  # Aumentado para 180s (3 minutos) para dar tempo ao envio de email
    'retry': 120,
    'queue_limit': 50,
    'bulk': 10,
    'orm': 'default',
}

# Configuração de E-mail (Produção)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
EMAIL_TIMEOUT = 10  # Timeout de 10 segundos para conexão SMTP

# Configuração de Logging para produção
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'core': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'core.tasks': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'core.push_utils': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Lista de emails para receber notificações
notification_emails_env = os.environ.get('NOTIFICATION_EMAILS', '')
if notification_emails_env:
    NOTIFICATION_EMAILS = [email.strip() for email in notification_emails_env.split(',') if email.strip()]
else:
    NOTIFICATION_EMAILS = []

# Configurações VAPID para Push Notifications
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_CLAIMS = {
    "sub": os.environ.get('VAPID_EMAIL', "mailto:admin@stockystem.com")
}

# Security settings for production
if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_SSL_REDIRECT = False  # Render.com gerencia SSL, então False aqui
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
