# src/nlp/rules.py
import re

class RuleBasedExtractor:
    def __init__(self):
        self.patterns = {
            # 1. Bắt Giờ (Giữ nguyên các pattern đã tối ưu)
            "time_absolute": [
                r"\b(\d{1,2})\s*[:hg]\s*(\d{2})\b",
                r"\b(\d{1,2})\s*giờ\s*(\d{1,2})\b",
                r"\b(\d{1,2})\s*(?:h|g|giờ)?\s*kém\s*(\d{1,2})\b",
                r"\b(\d{1,2})\s*(?:h|g|giờ)?\s*rưỡi\b",
                r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.?|p\.m\.?)\b",
                r"\b(\d{1,2})\s*(h|g|giờ)\b"
            ],
            
            # 2. Bắt Ngày/Tháng
            "date_absolute": [
                r"\b(\d{1,2})\s*[/-]\s*(\d{1,2})\b",             
                r"ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})"      
            ],

            # 3. Bắt Thứ
            "weekday": [
                r"(?:thứ\s+(?:\d+|hai|ba|tư|năm|sáu|bảy)|chủ\s+nhật|cn|t\d)\s+tuần\s+(?:sau|tới|này|trước)",
                r"thứ\s+(\d+|hai|ba|tư|năm|sáu|bảy)",
                r"chủ\s+nhật",
                r"\b(t[2-7]|cn)\b"
            ],
            
            # 4. Ngày tương đối
            "date_relative": [
                # --- Nhóm 1: Cụm từ rõ nghĩa (Ưu tiên cao nhất) ---
                # Bắt: "tối mai", "sáng mai", "ngày mai", "hôm nay"...
                r"\b(?:sáng|trưa|chiều|tối|đêm|khuya)\s+(?:mai|mốt|kia|hôm qua|qua)\b",
                r"\b(?:ngày|ngay)\s*(?:mai|kia|mốt|mot)\b",
                r"\b(?:hôm|hom)\s*(?:nay|qua|kia|sau)\b",
                
                # --- Nhóm 2: Bắt "Mai/Mốt" đứng SAU THỜI GIAN (Lookbehind) ---
                # [MỚI] Đây là phần sửa lỗi "17h mai" hoặc "17:30 mai"
                # Logic: Chỉ bắt chữ "mai" nếu phía trước nó là số hoặc chữ h/g/phút
                
                # Case: Sau số (VD: "17 mai", "9:30 mai", "17h30 mai")
                r"(?<=\d)\s*(?:ngày|ngay)?\s*(mai|mốt|mot|kia)\b",
                
                # Case: Sau chữ h/g (VD: "17h mai", "8g mốt")
                r"(?<=[hg])\s*(?:ngày|ngay)?\s*(mai|mốt|mot|kia)\b",
                
                # Case: Sau chữ phút (VD: "30 phút nữa", "30 phút mai" - ít gặp nhưng cứ thêm)
                r"(?<=út)\s*(?:ngày|ngay)?\s*(mai|mốt|mot|kia)\b",
                r"(?<=ut)\s*(?:ngày|ngay)?\s*(mai|mốt|mot|kia)\b",

                # --- Nhóm 3: Bắt "Mai/Mốt" đứng ĐẦU CÂU hoặc TRƯỚC GIỜ ---
                # VD: "Mai 8h học", "Mốt đi chơi"
                r"^\s*(mai|mốt|mot|kia)\b",
                # VD: "học thêm mai 8h nhé"
                r"\b(mai|mốt|mot|kia)\s+(?:lúc|vào)?\s*\d",

                # --- Nhóm 4: Tuần ---
                r"\b(?:tuần|tuan)\s*(?:này|nay|sau|tới|toi)\b",
                r"\b(?:cuối tuần|cuoi tuan)\b",
            ],
            
            # 5. Buổi (CẬP NHẬT: Thêm \b để bắt chính xác từ đơn)
            "session": [
                r"\b(sáng|trưa|chiều|tối|đêm|sang|trua|chieu|toi|dem)\b"
            ]
        }

    def extract(self, text):
        results = {
            "time_str": None, "date_str": None,
            "day_month": None, "session": None,
            "special_type": None
        }
        
        for p in self.patterns["time_absolute"]:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                results["time_str"] = match.group(0)
                if "rưỡi" in results["time_str"]: results["special_type"] = "half"
                if "kém" in results["time_str"]: results["special_type"] = "less"
                break
        
        for p in self.patterns["date_absolute"]:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                results["day_month"] = (int(match.group(1)), int(match.group(2)))
                break

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
        
        # Tìm Buổi (Ưu tiên bắt buổi đứng sau giờ, ví dụ "12h đêm")
        for p in self.patterns["session"]:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                results["session"] = match.group(0)
                break
                
        return results