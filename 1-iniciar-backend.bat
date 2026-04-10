@echo off
echo --- INICIANDO SERVIDOR DJANGO ---
cd /d C:\Users\Administrador\Desktop\pi2_stockSystem\backend
REM Define o DATABASE_URL apenas se não estiver definido (permite override)
if "%DATABASE_URL%"=="" set "DATABASE_URL=postgresql://app:app@127.0.0.1:5432/sistema_gestao"
echo DATABASE_URL=%DATABASE_URL%
call .\venv\Scripts\activate
python manage.py runserver --noreload
pause
