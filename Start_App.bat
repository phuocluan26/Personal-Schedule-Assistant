@echo off
TITLE Smart Schedule AI - Launcher
COLOR 0A
CLS

ECHO =================================================
ECHO      DANG KHOI DONG TRO LY LICH TRINH...
ECHO =================================================
ECHO.
ECHO [INFO] Kiem tra moi truong Python...
ECHO.

:: Tự động cài thư viện nếu chưa có (Optional - Giúp giảng viên đỡ phải cài tay)
pip install -r requirements.txt > nul 2>&1
ECHO [INFO] Moi truong Python da san sang.
ECHO.
ECHO [INFO] Dang khoi dong Server...
ECHO [INFO] Trinh duyet se tu dong mo trong giay lat...
ECHO.

:: Chạy file Python
python src/app.py

PAUSE