@echo off
cd /d C:\Users\Administrador\Desktop\pi2_sistema_versao3\backend
echo Ativando ambiente virtual e rodando migrações...
call .\venv\Scripts\activate
python manage.py migrate
echo.
echo Iniciando servidor Django em http://localhost:8000
python manage.py runserver --noreload
