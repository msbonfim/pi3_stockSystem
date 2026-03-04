@echo off
echo --- INICIANDO QCLUSTER (TAREFAS) ---
cd /d C:\Users\Administrador\Desktop\pi2_stockSystem\backend
call .\venv\Scripts\activate
python manage.py qcluster
pause
