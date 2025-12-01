# src/nlp/engine.py
import sys
import os
import re
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from processor import TextProcessor
from ner import EntityExtractor
from rules import RuleBasedExtractor
from time_parser import TimeParser

class NLPEngine:
    def __init__(self):
        self.processor = TextProcessor()
        self.ner = EntityExtractor()
        self.rules = RuleBasedExtractor()
        self.timer = TimeParser()

    def classify_event_type(self, text):
        text_lower = text.lower()
        deadline_keywords = ['hạn', 'deadline', 'nộp', 'chót', 'kết thúc', 'hoàn thành', 'submit']
        for kw in deadline_keywords:
            if kw in text_lower: return "DEADLINE"
        return "EVENT"

    def process_text(self, raw_text):
        clean_text = self.processor.normalize(raw_text)
        
        # 1. Trích xuất
        raw_location = self.ner.extract_location(clean_text)
        time_info = self.rules.extract(clean_text)
        
        # 2. Xử lý địa điểm (Lớp bảo vệ cuối cùng)
        final_location = ""
        is_real_location = False
        
        if raw_location:
            # Blacklist nâng cao
            blacklist = ["chuyên ngành", "đồ án", "tiểu luận", "báo cáo", "hạn chót", "deadline", "nộp", "nhận", "giấy"]
            
            # --- LOGIC MỚI: Check va chạm với thời gian ---
            # Nếu location chứa các từ trong chuỗi thời gian đã bắt được -> BỎ
            # Ví dụ: time_info bắt được "thứ 3", mà location là "thứ 3" -> BỎ
            collision = False
            if time_info['date_str'] and time_info['date_str'] in raw_location.lower(): collision = True
            if time_info['time_str'] and time_info['time_str'] in raw_location.lower(): collision = True
            
            if not collision and not any(word in raw_location.lower() for word in blacklist):
                final_location = raw_location.title()
                is_real_location = True

        # 3. Tính toán thời gian
        time_obj, time_error = self.timer.parse_time(
            time_info['time_str'], 
            time_info['session'], 
            time_info.get('special_type')
        )
        date_obj, is_valid_date = self.timer.parse_date(time_info['date_str'], time_info['day_month'])

        if time_error: return {"is_valid": False, "error_message": time_error}
        if not is_valid_date: return {"is_valid": False, "error_message": f"Ngày không tồn tại"}

        start_time_str = ""
        end_time_str = None
        all_day = False
        event_type = self.classify_event_type(raw_text)

        if time_obj:
            final_dt = date_obj.replace(hour=time_obj.hour, minute=time_obj.minute, second=0, microsecond=0)
            start_time_str = final_dt.isoformat()
            if event_type == "EVENT":
                end_time_str = (final_dt + timedelta(hours=1)).isoformat()
            else:
                end_time_str = start_time_str
        else:
            start_time_str = date_obj.strftime("%Y-%m-%d")
            all_day = True
            event_type = "EVENT"

        # 4. Clean Title
        title = raw_text 
        strings_to_remove = []
        
        # Xóa prefix
        prefixes = ["tôi có hẹn", "tôi có lịch", "tôi muốn", "nhắc tôi", "nhớ là", "lên lịch", "ghi chú", "hãy thêm", "thêm sự kiện", "đặt lịch", "có hẹn", "mai", "mốt"]
        lower_title = title.lower()
        for prefix in prefixes:
            if lower_title.startswith(prefix):
                title = title[len(prefix):].strip()
                lower_title = title.lower()

        # Xóa metadata
        if is_real_location and raw_location: strings_to_remove.append(raw_location)
        if time_info['time_str']: strings_to_remove.append(time_info['time_str'])
        if time_info['day_month']:
            d, m = time_info['day_month']
            matches = re.findall(rf"\b0?{d}\s*[/-]\s*0?{m}\b", title)
            strings_to_remove.extend(matches)
        if time_info['date_str']: strings_to_remove.append(time_info['date_str'])
        if time_info['session']: strings_to_remove.append(time_info['session'])

        for s in strings_to_remove:
            if s: title = re.sub(re.escape(s), '', title, flags=re.IGNORECASE)

        connectors = ["tại", "ở", "lúc", "vào", "ngày", "lên", "đến", "về", "ra", "đi", "với"]
        for conn in connectors:
            title = re.sub(rf"\b{conn}\s+(?=\s|$)", "", title, flags=re.IGNORECASE)

        title = re.sub(r'\s+', ' ', title).strip().rstrip(",.-")
        if len(title) < 2: title = raw_text

        return {
            "title": title.capitalize(),
            "start_time": start_time_str,
            "end_time": end_time_str,
            "event_type": event_type,
            "all_day": all_day,
            "location": final_location,
            "reminder_minutes": 15,
            "is_valid": True
        }