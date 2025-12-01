# src/nlp/time_parser.py
from datetime import datetime, timedelta
import re

class TimeParser:
    def parse_time(self, time_str, session=None, special_type=None):
        if not time_str: return None, None 
        now = datetime.now().replace(microsecond=0)
        hour, minute = 0, 0
        s_lower = time_str.lower().strip()

        try:
            if special_type == "half":
                nums = re.findall(r"\d+", s_lower)
                if nums: hour, minute = int(nums[0]), 30
            elif special_type == "less":
                nums = re.findall(r"\d+", s_lower)
                if len(nums) >= 2:
                    t = datetime(2000,1,1,int(nums[0]),0) - timedelta(minutes=int(nums[1]))
                    hour, minute = t.hour, t.minute
            else:
                is_pm = "pm" in s_lower or "p.m" in s_lower
                is_am = "am" in s_lower or "a.m" in s_lower
                clean = re.sub(r"[^\d:]", "", s_lower.replace("h",":").replace("g",":").replace("giờ",":"))
                if ':' in clean:
                    p = clean.split(':')
                    hour, minute = int(p[0]), int(p[1]) if p[1] else 0
                elif clean: hour, minute = int(clean), 0
                
                if is_pm and hour < 12: hour += 12
                elif is_am and hour == 12: hour = 0
                elif not is_pm and not is_am and session and hour < 12:
                    if session in ['chiều', 'tối', 'đêm']: hour += 12
            
            if not (0<=hour<=23 and 0<=minute<=59): return None, f"Giờ không hợp lệ: {hour}h"
            return now.replace(hour=hour, minute=minute, second=0), None
        except: return None, f"Lỗi đọc giờ: {time_str}"

    def parse_date(self, date_str, day_month_tuple=None):
        today = datetime.now().replace(microsecond=0)

        if day_month_tuple:
            d, m = day_month_tuple
            year = today.year
            try:
                target = today.replace(year=year, month=m, day=d)
                if (today - target).days > 30: target = target.replace(year=year+1)
                return target, True
            except: return None, False

        if not date_str: return today, True
        
        s = date_str.lower()
        if "hôm nay" in s: return today, True
        if "mai" in s: return today + timedelta(days=1), True
        if "mốt" in s or "kia" in s: return today + timedelta(days=2), True
        
        weekdays = {"hai": 0, "2": 0, "ba": 1, "3": 1, "tư": 2, "4": 2, 
                    "năm": 3, "5": 3, "sáu": 4, "6": 4, "bảy": 5, "7": 5, "chủ nhật": 6, "cn": 6}
        
        for key, val in weekdays.items():
            if key in s:
                current_wd = today.weekday()
                days_ahead = val - current_wd
                if days_ahead <= 0: days_ahead += 7
                
                target_date = today + timedelta(days=days_ahead)
                
                # --- LOGIC QUAN TRỌNG: TUẦN SAU ---
                # Nếu chuỗi bắt được có chữ "tuần sau", cộng thêm 7 ngày
                if "tuần sau" in s or "tuần tới" in s:
                    target_date += timedelta(days=7)
                # ----------------------------------
                
                return target_date, True
        return today, True
    
    def combine(self, *args): pass