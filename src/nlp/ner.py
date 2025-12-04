# src/nlp/ner.py
from underthesea import ner
import re
from processor import TextProcessor

class EntityExtractor:
    def __init__(self):
        # 1. DANH SÁCH TIỀN TỐ ĐỊA ĐIỂM (Place Prefixes)
        # Nếu thấy những từ này -> Khả năng cao là địa điểm, không cần giới từ
        self.place_prefixes = [
            "sân", "san", "rạp", "rap", "phòng", "phong", 
            "nhà hàng", "nha hang", "khách sạn", "khach san",
            "công ty", "cong ty", "trường", "truong", 
            "bệnh viện", "benh vien", "quán", "quan", 
            "siêu thị", "sieu thi", "chợ",
            "hồ", "ho", "cầu", "cau", "bến", "ben", 
            "vườn", "vuon", "công viên", "cong vien",
            "đảo", "dao", "núi", "nui", "toà", "toa",
            "chung cư", "chung cu", "shop", "cửa hàng",
            "trung tâm", "trung tam", "plaza", "gym", "yoga",
            "nhà sách", "nha sach", "sân bay", "san bay","quốc gia","quoc gia"
        ]

        # 2. DANH SÁCH ĐỊA DANH PHỔ BIẾN (Hardcoded Locations)
        # Cứu cánh cho trường hợp không dấu: "di vung tau", "di da lat"
        self.common_locations = [
            # Tên cụ thể dài
            "fpt software", "fpt soft ware", "đại học fpt", "dai hoc fpt",
            "sân bay tân sơn nhất", "san bay tan son nhat", "tân sơn nhất", "tan son nhat",
            "sân bay nội bài", "san bay noi bai", "nội bài", "noi bai",
            
            # Địa danh chung chung nhưng được chấp nhận là Location
            "công viên", "cong vien", "nhà sách", "nha sach", 
            "thư viện", "thu vien", "bể bơi", "be boi",
            
            # Tỉnh/Thành phố
            "hà nội", "ha noi", "hải phòng", "hai phong", "quảng ninh", "quang ninh",
            "sapa", "sa pa", "hà giang", "ha giang", "bắc ninh", "bac ninh",
            "đà nẵng", "da nang", "huế", "hue", "nha trang", "vinh", 
            "quy nhơn", "quy nhon", "phú yên", "phu yen", "đà lạt", "da lat",
            "buôn mê thuột", "buon me thuot", "bmt",
            "hcm", "hồ chí minh", "ho chi minh", "sài gòn", "sai gon", 
            "vũng tàu", "vung tau", "cần thơ", "can tho", "phú quốc", "phu quoc",
            "bến tre", "ben tre", "cà mau", "ca mau", "biên hòa", "bien hoa",
            "bình dương", "binh duong", "đồng nai", "dong nai","bạch mai","bach mai",
            
            # Brand/Tên ngắn
            "fpt", "fsoft", "viettel", "vinmart", "winmart", "circle k", 
            "highland", "starbucks", "cali", "lotte", "aeon","bigc"
        ]

        # 3. TỪ KHÓA CHẶN (Blocklist) - Để double check
        self.forbidden_words = [
            "ngủ", "chơi", "làm", "học", "xem", "ăn", "uống", 
            "ngu", "choi", "lam", "hoc", "xem", "an", "uong",
            "vệ sinh", "thể dục", "gym", "bóng", "banh", 
            "dạo", "dao", "bơi", "boi", "chạy", "chay",
            "siêu", "sieu", "đá", "da", "về", "ve", "nghỉ", "nghi",
            "lịch", "lich", "hẹn", "hen", "book", "đặt", "dat"
        ]

    def extract_location(self, text):
        if not text: return None
        
        # 1. Tìm bằng "Địa danh phổ biến" (Mạnh nhất với câu không dấu)
        # VD: "di vung tau" -> bắt được "vung tau"
        for loc in self.common_locations:
            if re.search(rf"\b{loc}\b", text, re.IGNORECASE):
                # Trả về text gốc khớp trong câu để giữ format
                match = re.search(rf"\b({loc})\b", text, re.IGNORECASE)
                return match.group(1).title()

        # 2. Tìm bằng "Tiền tố địa điểm" (Sân..., Rạp...)
        # VD: "da bong san my dinh" -> bắt "san my dinh" (bỏ qua "da bong")
        rule_prefix = self._extract_by_prefix(text)
        if rule_prefix: return rule_prefix.title()

        # 3. Tìm bằng giới từ mạnh (Tại/Ở/Đến)
        rule_prep = self._extract_by_preposition(text)
        if rule_prep: return rule_prep.title()
        
        # 4. Fallback: Dùng AI (Underthesea) - Chỉ hiệu quả nếu có dấu/viết hoa đúng
        ai_loc = self._extract_by_ai(text)
        if ai_loc: return ai_loc

        return None

    def _extract_by_prefix(self, text):
        prefixes = "|".join(self.place_prefixes)
        
        # Stop words: Thêm ĐỘNG TỪ để cắt chuỗi tham lam
        # Fix lỗi: "Siêu thị mua đồ" -> "Siêu thị" (rồi bị loại vì quá ngắn) -> None (Đúng ý)
        # Fix lỗi: "Công viên hóng gió" -> "Công viên" (Có trong common_locations nên sẽ được bắt ở Bước 1)
        
        verbs_to_stop = r"mua|bán|xem|ăn|uống|chơi|ngủ|hóng|dạo|tập|hẹn|gặp|về|đón|rước"
        verbs_no_accent = r"mua|ban|xem|an|uong|choi|ngu|hong|dao|tap|hen|gap|ve|don|ruoc"
        time_stops = r"lúc|luc|vào|vao|ngày|ngay|hôm|hom|sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem|để|de|bởi|bạn|với|\d"
        
        stop_words = f"(?:{time_stops}|{verbs_to_stop}|{verbs_no_accent}|$)"
        
        # Regex: Prefix + (Nội dung) + StopWord
        # Non-greedy match for content: ([^,?.!]+?)
        pattern = rf"\b({prefixes})\s+([^,?.!]+?)(?=\s+{stop_words}|\s*$)"
        
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            full_loc = match.group(0).strip()
            # Nếu regex bắt được prefix nhưng suffix rỗng hoặc bị stop word chặn ngay lập tức
            # VD: "Đi siêu thị mua" -> Bắt "Siêu thị".
            # Hàm _is_valid sẽ loại bỏ nếu nó chỉ là prefix đơn lẻ.
            if self._is_valid(full_loc):
                return full_loc
        return None
    
    def _extract_by_preposition(self, text):
        preps = r"(?:tại|ở|đến|về|qua|tai|o|den|ve|qua|trong|ngoài)" 
        # Cũng dùng list stop words đầy đủ như trên
        verbs_to_stop = r"mua|bán|xem|ăn|uống|chơi|ngủ|hóng|dạo|tập|hẹn|gặp|về|đón|rước"
        verbs_no_accent = r"mua|ban|xem|an|uong|choi|ngu|hong|dao|tap|hen|gap|ve|don|ruoc"
        time_stops = r"lúc|luc|vào|vao|ngày|ngay|hôm|hom|sáng|sang|trưa|trua|chiều|chieu|tối|toi|đêm|dem|để|de|bởi|bạn|với|\d"
        
        stop_words = f"(?:{time_stops}|{verbs_to_stop}|{verbs_no_accent}|$)"
        
        pattern = rf"\b{preps}\s+([^,?.!]+?)(?=\s+{stop_words}|\s*$)"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            loc = match.group(1).strip()
            if self._is_valid(loc):
                return loc
        return None
    
    def _extract_by_ai(self, text):
        try:
            tokens = ner(text)
            locations = []
            current = []
            for token in tokens:
                if len(token) == 4: word, pos, chunk, tag = token
                else: word, pos, tag = token
                if tag == 'B-LOC':
                    if current: locations.append(" ".join(current))
                    current = [word]
                elif tag == 'I-LOC': current.append(word)
                else:
                    if current:
                        locations.append(" ".join(current))
                        current = []
            if current: locations.append(" ".join(current))
            valid_locs = [l for l in locations if self._is_valid(l)]
            return valid_locs[0] if valid_locs else None
        except: return None

    def _is_valid(self, loc):
        if not loc: return False
        if len(loc.split()) > 10: return False 
        loc_lower = loc.lower()
        
        # Check blacklist
        first_word = loc_lower.split()[0]
        if first_word in self.forbidden_words: return False
        if loc_lower in self.forbidden_words: return False
        
        # Check Prefix đơn lẻ
        # Nếu địa điểm chỉ là "Siêu thị" (và không nằm trong whitelist Common Location), ta coi là invalid
        # Vì Common Location đã check ở Bước 1 rồi, nên xuống đây chủ yếu là check kết quả từ Regex Prefix/Prep
        if loc_lower in self.place_prefixes: return False
        
        # Check Time keywords
        if re.search(r"\b(hôm|nay|mai|mốt|giờ|phút|giây)\b", loc_lower): return False
        
        # Danh sách địa điểm được phép đứng một mình (Whitelist)
        allow_standalone = [
            "chợ", "siêu thị", "nhà sách", "sân bay", "trường", "công viên", 
            "bệnh viện", "rạp", "thư viện", "công ty", "shop", "hồ", "bể bơi",
            "cho", "sieu thi", "nha sach", "san bay", "truong", "cong vien", 
            "benh vien", "rap", "thu vien", "cong ty", "ho", "be boi"
        ]

        # Check Prefix đơn lẻ
        if loc_lower in self.place_prefixes: 
            # Nếu từ này nằm trong whitelist thì cho qua (True), còn không thì chặn
            if loc_lower not in allow_standalone:
                return False
        
        return True