@echo off
start "OmniRoute" cmd /k "set OMNIROUTE_SERVER_HOST=127.0.0.1 && omniroute.cmd"
start "Backend" cmd /k "cd poshanai-backend && npm run dev"
start "Frontend" cmd /k "cd poshanai-frontend && npm run dev"
echo All services started!