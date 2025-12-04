# src/database/db_manager.py
import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DB_PATH

class DBManager:
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self.initialize_database()

    def initialize_database(self):
        folder = os.path.dirname(self.db_path)
        if not os.path.exists(folder): os.makedirs(folder)
        if not os.path.exists(self.db_path): self._write_json([])
        else:
            try:
                with open(self.db_path, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if not content: self._write_json([])
                    else: json.loads(content)
            except:
                print("⚠️ Reset database...")
                self._write_json([])

    def _read_json(self):
        try:
            with open(self.db_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except: return []

    def _write_json(self, data):
        try:
            with open(self.db_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
        except Exception as e: print(f"Lỗi ghi: {e}")

    def add_event(self, event_data):
        events = self._read_json()
        new_id = (max(e['id'] for e in events) + 1) if events else 1
            
        new_record = {
            "id": new_id,
            "title": event_data['title'],
            "start_time": event_data['start_time'],
            "end_time": event_data.get('end_time'),
            "event_type": event_data.get('event_type', 'EVENT'),
            "all_day": event_data.get('all_day', False),
            "location": event_data.get('location', ''),
            "reminder_minutes": event_data.get('reminder_minutes', 15),
            "completed": False ,
            "raw_text": event_data.get('raw_text', '')
        }
        
        events.append(new_record)
        self._write_json(events)
        return new_id

    def get_all_events(self):
        return self._read_json()

    def update_event(self, event_id, new_data):
        """Cập nhật sự kiện"""
        events = self._read_json()
        updated = False
        
        for event in events:
            if int(event['id']) == int(event_id):
                # CẬP NHẬT CÁC TRƯỜNG THÔNG THƯỜNG
                if 'title' in new_data: event['title'] = new_data['title']
                if 'start_time' in new_data: event['start_time'] = new_data['start_time']
                if 'location' in new_data: event['location'] = new_data['location']
                if 'reminder_minutes' in new_data: event['reminder_minutes'] = new_data['reminder_minutes']
                
                # --- QUAN TRỌNG: CẬP NHẬT TRẠNG THÁI COMPLETED ---
                if 'completed' in new_data: 
                    event['completed'] = new_data['completed']
                # -------------------------------------------------

                self._write_json(events)
                updated = True
                print(f"✏️ Đã cập nhật ID {event_id}: {event['title']}")
                break
        
        return updated

    def delete_event(self, event_id):
        events = self._read_json()
        new_events = [e for e in events if int(e['id']) != int(event_id)]
        if len(new_events) < len(events):
            self._write_json(new_events)
            return True
        return False