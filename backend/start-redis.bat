@echo off
title ReachInbox Redis Server
echo Starting Redis Server on port 6379...
cd /d "%~dp0redis"
redis-server.exe
pause
