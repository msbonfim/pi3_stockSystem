@echo off
echo --- INICIANDO SERVIDOR DJANGO ---
cd /d C:\Users\Administrador\Desktop\pi2_stockSystem\backend
call .\venv\Scripts\activate
python manage.py runserver --noreload
pause
