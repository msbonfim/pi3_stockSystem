@echo off
echo --- DOCKER: Postgres + Metabase ---
cd /d C:\Users\Administrador\Desktop\pi2_stockSystem
docker compose up -d
echo.
echo Metabase: http://localhost:3000
echo Postgres: localhost:5432 (app / app, DB sistema_gestao + metabase)
pause
