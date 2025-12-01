# src/nlp/rules.py
import re

class RuleBasedExtractor:
    def __init__(self):
        self.patterns = {
            # 1. Bắt Giờ (HH:MM, HHhMM, HHgMM, AM/PM)
            "time_absolute": [
                r"(\d{1,2})\s*[:hg]\s*(\d{2})",       
                r"(\d{1,2})\s*giờ\s*(\d{1,2})",      
                r"(\d{1,2})\s*h",                    
                r"(\d{1,2})\s*giờ",                  
                r"(\d{1,2})\s*(am|pm)"               
            ],
            
            # 2. Bắt Ngày/Tháng (dd/mm)
            "date_absolute": [
                r"(\d{1,2})\s*[/-]\s*(\d{1,2})",             
                r"ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})"      
            ],

            # 3. Bắt Thứ + Tuần (Nâng cấp quan trọng!)
            # Bắt: "thứ 3 tuần sau", "chủ nhật tuần tới", "thứ hai tuần này"
            "weekday": [
                r"(?:thứ\s+(?:\d+|hai|ba|tư|năm|sáu|bảy)|chủ\s+nhật)\s+tuần\s+(?:sau|tới|này|trước)",
                r"thứ\s+(\d+|hai|ba|tư|năm|sáu|bảy)",
                r"chủ\s+nhật"
            ],
            
            # 4. Bắt Ngày tương đối
            "date_relative": [
                r"hôm\s+nay", r"ngày\s+mai", r"ngày\s+kia", r"ngày\s+mốt",
                r"tuần\s+(sau|tới)", r"cuối\s+tuần"
            ],
            
            # 5. Buổi
            "session": [
                r"(sáng|trưa|chiều|tối|đêm)"
            ]
        }

    def extract(self, text):
        results = {
            "time_str": None, "date_str": None,
            "day_month": None, "session": None
        }
        
        # Tìm Giờ
        for p in self.patterns["time_absolute"]:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                results["time_str"] = match.group(0)
                break
        
        # Tìm Ngày/Tháng (dd/mm)
        for p in self.patterns["date_absolute"]:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                results["day_month"] = (int(match.group(1)), int(match.group(2)))
                break

        # Tìm Thứ/Ngày tương đối
        if not results["day_month"]:
            for p in self.patterns["weekday"]:
                match = re.search(p, text, re.IGNORECASE)
                if match:
                    results["date_str"] = match.group(0)
                    break
        
            if not results["date_str"]:
                for p in self.patterns["date_relative"]:
                    match = re.search(p, text, re.IGNORECASE)
                    if match:
                        results["date_str"] = match.group(0)
                        break
                    
        # Tìm Buổi
        for p in self.patterns["session"]:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                results["session"] = match.group(0)
                break
                
        return results