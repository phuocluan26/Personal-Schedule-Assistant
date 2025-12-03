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
        
        # 1. Trích xuất thông tin thô
        raw_location = self.ner.extract_location(clean_text)
        time_info = self.rules.extract(clean_text)
        
        # 2. Xử lý logic địa điểm (QUAN TRỌNG: Lọc nhiễu)
        final_location = ""
        is_real_location = False
        
        if raw_location:
            # Danh sách từ khóa học thuật/công việc thường bị nhận nhầm
            blacklist = ["chuyên ngành", "đồ án", "tiểu luận", "báo cáo", "hạn chót", "deadline", "nộp", "nhận", "giấy"]
            
            # --- LOGIC MỚI: Check va chạm với thời gian ---
            # Nếu location chứa các từ trong chuỗi thời gian đã bắt được -> BỎ
            # Ví dụ: time_info bắt được "thứ 3", mà location là "thứ 3" -> BỎ
            collision = False
            if time_info['date_str'] and time_info['date_str'] in raw_location.lower(): collision = True
            if time_info['time_str'] and time_info['time_str'] in raw_location.lower(): collision = True
            
            # Nếu location chứa các từ chỉ thời gian (tuần, tháng, năm...) -> BỎ
            time_keywords = ["tuần", "tháng", "năm", "hôm", "mai", "mốt", "lúc", "giờ","tuan","thang","nam","hom","mai","mot","luc","gio"]
            if any(k in raw_location.lower() for k in time_keywords): collision = True

            if not collision:
                # Chỉ check blacklist nếu location dài (>1 từ) để tránh xóa tên riêng ngắn
                if len(raw_location.split()) > 1 and any(word in raw_location.lower() for word in blacklist):
                    pass # Bị dính blacklist
                else:
                    final_location = raw_location.title()
                    is_real_location = True

        # 3. Tính toán thời gian (QUAN TRỌNG: Hứng tuple trả về)
        time_obj, time_error = self.timer.parse_time(
            time_info['time_str'], 
            time_info['session'], 
            time_info.get('special_type')
        )
        date_obj, is_valid_date = self.timer.parse_date(time_info['date_str'], time_info['day_month'])

        # Bắt lỗi dữ liệu không hợp lệ
        if time_error: 
            return {"is_valid": False, "error_message": time_error}
        if not is_valid_date: 
            return {"is_valid": False, "error_message": f"Ngày không tồn tại: {time_info['day_month'][0]}/{time_info['day_month'][1]}"}

        start_time_str = ""
        end_time_str = None
        all_day = False
        event_type = self.classify_event_type(raw_text)

        if time_obj:
            # Có giờ cụ thể -> Ghép giờ vào ngày (Đảm bảo microsecond=0)
            final_dt = date_obj.replace(hour=time_obj.hour, minute=time_obj.minute, second=0, microsecond=0)
            start_time_str = final_dt.isoformat()
            
            if event_type == "EVENT":
                end_time_str = (final_dt + timedelta(hours=1)).isoformat()
            else:
                end_time_str = start_time_str
        else:
            # Không có giờ -> All day (YYYY-MM-DD)
            start_time_str = date_obj.strftime("%Y-%m-%d")
            all_day = True
            event_type = "EVENT"

        # 4. Xử lý Tiêu đề (Clean Title - Nâng cao)
        title = raw_text 
        strings_to_remove = []
        
        # A. Xóa prefix giao tiếp
        prefixes = ["tôi có hẹn", "tôi có lịch", "tôi muốn", "nhắc tôi", "nhớ là", "lên lịch", "ghi chú", "hãy thêm", "thêm sự kiện", "đặt lịch", "có hẹn", "mai", "mốt"]
        lower_title = title.lower()
        for prefix in prefixes:
            if lower_title.startswith(prefix):
                title = title[len(prefix):].strip()
                lower_title = title.lower()

        # B. Xóa Metadata
        if is_real_location and raw_location: strings_to_remove.append(raw_location)
        if time_info['time_str']: strings_to_remove.append(time_info['time_str'])
        
        if time_info['day_month']:
            d, m = time_info['day_month']
            # Regex xóa ngày tháng cụ thể (6/12, 6-12)
            matches = re.findall(rf"\b0?{d}\s*[/-]\s*0?{m}\b", title)
            strings_to_remove.extend(matches)

        if time_info['date_str']: strings_to_remove.append(time_info['date_str'])
        if time_info['session']: strings_to_remove.append(time_info['session'])

        for s in strings_to_remove:
            if s: title = re.sub(re.escape(s), '', title, flags=re.IGNORECASE)

        # C. Xóa từ nối
        connectors = ["tại", "ở", "lúc", "vào", "ngày", "lên", "đến", "về", "ra", "đi", "với", "chuyến"]
        for conn in connectors:
            title = re.sub(rf"\b{conn}\s+(?=\s|$)", "", title, flags=re.IGNORECASE)

        title = re.sub(r'\s+', ' ', title).strip().rstrip(",.-")
        if len(title) < 2: title = raw_text # Fallback nếu xóa sạch trơn

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