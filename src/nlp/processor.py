# src/nlp/processor.py
from underthesea import word_tokenize

class TextProcessor:
    def __init__(self):
        pass

    def normalize(self, text):
        """
        Chuẩn hóa câu đầu vào:
        1. Chuyển về chữ thường
        2. Xóa khoảng trắng thừa
        """
        if not text:
            return ""
        
        # Xóa khoảng trắng thừa đầu đuôi và giữa các từ
        text = " ".join(text.strip().split())
        
        # Chuyển về chữ thường để dễ xử lý Regex sau này
        return text.lower()

    def segment(self, text):
        """
        Tách từ tiếng Việt (Word Segmentation)
        VD: "học sinh" -> "học_sinh" (giúp nhận diện ngữ nghĩa tốt hơn)
        """
        return word_tokenize(text, format="text")

# Test nhanh
if __name__ == "__main__":
    p = TextProcessor()
    raw = "   Họp    nhóm   tại  Phòng 302   "
    clean = p.normalize(raw)
    print(f"Gốc: '{raw}'")
    print(f"Sạch: '{clean}'")