# src/nlp/ner.py
from underthesea import ner
import re

class EntityExtractor:
    def __init__(self):
        # Danh sách từ khóa CHẮC CHẮN không bao giờ nằm trong địa điểm
        self.forbidden_words = [
            "hôm", "mai", "mốt", "kia", "qua", "nay",
            "tuần", "tháng", "năm", "quý",
            "lúc", "giờ", "phút", "giây",
            "sau", "trước", "tới", "nữa",
            "sáng", "trưa", "chiều", "tối", "đêm",
            "thứ" # thứ 2, thứ 3...
        ]

    def extract_location(self, text):
        # 1. Thử dùng AI
        ai_loc = self._extract_by_ai(text)
        if ai_loc and self._is_valid_location(ai_loc):
            return ai_loc
            
        # 2. Thử dùng Rule
        rule_loc = self._extract_by_rules(text)
        if rule_loc and self._is_valid_location(rule_loc):
            return rule_loc
            
        return None

    def _is_valid_location(self, loc):
        """Kiểm tra xem địa điểm có hợp lệ không"""
        if not loc: return False
        loc_lower = loc.lower()
        
        # 1. Nếu chứa từ cấm -> SAI
        # (Dùng word boundary \b để tránh bắt nhầm chữ trong từ khác)
        for word in self.forbidden_words:
            if re.search(rf"\b{word}\b", loc_lower):
                return False
                
        # 2. Nếu chỉ toàn số -> SAI (VD: "2025")
        if loc.replace(" ", "").isdigit():
            return False
            
        # 3. Nếu bắt đầu bằng số nhưng không có chữ cái (VD: "3 20") -> SAI
        if re.match(r"^\d+[\s\d]*$", loc):
            return False

        return True

    def _extract_by_ai(self, text):
        try:
            tokens = ner(text)
            locations = []
            current_loc = []
            for token in tokens:
                if len(token) == 4: word, pos, chunk, tag = token
                else: word, pos, tag = token

                if tag == 'B-LOC': 
                    if current_loc: locations.append(" ".join(current_loc))
                    current_loc = [word]
                elif tag == 'I-LOC': current_loc.append(word)
                else:
                    if current_loc:
                        locations.append(" ".join(current_loc))
                        current_loc = []
            if current_loc: locations.append(" ".join(current_loc))
            return locations[0] if locations else None
        except: return None

    def _extract_by_rules(self, text):
        prepositions = r"(?:tại|ở|đến|lên|về|ra|trong|ngoài)"
        stop_words = r"(?:lúc|vào|ngày|hôm|sáng|trưa|chiều|tối|để|nhận|lấy|gặp|mua|làm)"
        
        pattern = rf"{prepositions}\s+(.*?)(?=\s+{stop_words}|\s*$)"
        match = re.search(pattern, text, re.IGNORECASE)
        
        if match:
            return match.group(1).strip()
        return None