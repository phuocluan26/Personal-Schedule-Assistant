# src/config.py
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')

# Đổi tên file từ .db sang .json
DB_PATH = os.path.join(DATA_DIR, 'events.json')

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)