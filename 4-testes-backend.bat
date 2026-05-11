@echo off
echo --- TESTES BACKEND (unittest) ---
cd /d C:\Users\Administrador\Desktop\pi2_stockSystem\backend
call .\venv\Scripts\activate
python -m unittest discover -s core/tests -p "test_*.py" -v
pause
