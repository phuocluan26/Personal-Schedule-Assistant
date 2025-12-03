import sys
import os
import csv
from datetime import datetime
import pandas as pd

# Setup đường dẫn để import được src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/src")
from nlp.engine import NLPEngine

def run_test():
    engine = NLPEngine()
    input_file = 'tests/test_cases.csv'
    output_file = 'tests/test_report_final.csv'
    
    results = []
    correct_count = 0
    total_count = 0

    print(f"🚀 Đang đọc file test: {input_file}...")

    try:
        with open(input_file, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                total_count += 1
                text = row['text']
                expected = row['expected_time'] # Giờ mong muốn (VD: 09:00)
                
                # --- CHẠY AI ---
                output = engine.process_text(text)
                
                # --- PHÂN TÍCH KẾT QUẢ ---
                actual_time_str = output.get('start_time', '')
                actual_hour_minute = "None"
                
                # Lấy giờ:phút từ kết quả thực tế để so sánh
                if actual_time_str and len(actual_time_str) > 10: # Có giờ (dạng ISO)
                    dt = datetime.fromisoformat(actual_time_str)
                    actual_hour_minute = dt.strftime("%H:%M")
                elif actual_time_str: # Chỉ có ngày (All day)
                    actual_hour_minute = "None"

                # --- SO SÁNH ---
                # Nếu mong đợi None và máy ra None -> Đúng
                # Nếu mong đợi giờ khớp với giờ máy -> Đúng
                if expected == actual_hour_minute:
                    status = "PASS"
                    correct_count += 1
                else:
                    status = "FAIL"

                # In ra màn hình console để xem ngay
                icon = "✅" if status == "PASS" else "❌"
                print(f"{icon} [{row['id']}] Input: {text}")
                print(f"   Expected: {expected} | Actual: {actual_hour_minute}")

                # Lưu vào danh sách để xuất file
                results.append({
                    "ID": row['id'],
                    "Câu lệnh (Input)": text,
                    "Mong đợi (Expected)": expected,
                    "Thực tế (Actual)": actual_hour_minute,
                    "Kết quả (Status)": status,
                    "Ghi chú": ""
                })

    except FileNotFoundError:
        print("❌ Lỗi: Không tìm thấy file 'tests/test_cases.csv'. Hãy tạo file này trước!")
        return

    # --- TÍNH ĐIỂM & XUẤT FILE ---
    accuracy = (correct_count / total_count) * 100 if total_count > 0 else 0
    
    print(f"\n==============================")
    print(f"TỔNG SỐ TEST: {total_count}")
    print(f"SỐ CÂU ĐÚNG: {correct_count}")
    print(f"ĐỘ CHÍNH XÁC: {accuracy:.2f}%")
    print(f"==============================")

    # Ghi ra file CSV báo cáo
    with open(output_file, mode='w', newline='', encoding='utf-8-sig') as f:
        fieldnames = ["ID", "Câu lệnh (Input)", "Mong đợi (Expected)", "Thực tế (Actual)", "Kết quả (Status)", "Ghi chú"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        writer.writerows(results)
        # Ghi thêm dòng tổng kết vào cuối file
        writer.writerow({})
        writer.writerow({"Câu lệnh (Input)": f"ĐỘ CHÍNH XÁC: {accuracy:.2f}%"})

    print(f"📄 Đã xuất file báo cáo tại: {output_file}")

if __name__ == "__main__":
    run_test()