# src/app.py
from flask import Flask, render_template, request, jsonify,Response
import sys
import os
import json
import csv
import io # <--- Thêm thư viện này để đọc file từ bộ nhớ
from datetime import datetime
import pandas as pd
import webbrowser
from threading import Timer

# Thêm đường dẫn src vào sys.path để import module nội bộ
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database.db_manager import DBManager
from nlp.engine import NLPEngine

# Khởi tạo Flask app và các thành phần cần thiết
app = Flask(__name__, template_folder='web/templates', static_folder='web/static')
db = DBManager()
nlp = NLPEngine()

# Các route của ứng dụng
@app.route('/')
def index():
    return render_template('index.html')

# API lấy danh sách sự kiện
@app.route('/api/events', methods=['GET'])
def get_events():
    events = db.get_all_events()
    formatted_events = []
    
    for e in events:
        event_color = '#3f9dff'
        if e.get('event_type') == 'DEADLINE':
            event_color = '#dc3545'

        # Xử lý All-day (Nếu DB có lưu hoặc độ dài chuỗi ngày là 10 ký tự)
        is_all_day = e.get('all_day', False) or len(e['start_time']) == 10

        formatted_events.append({
            'id': e['id'],
            'title': e['title'],
            'start': e['start_time'],
            'end': e.get('end_time'),
            'allDay': is_all_day,
            'backgroundColor': event_color,
            'borderColor': event_color,
            'extendedProps': {
                'location': e.get('location', ''),
                'type': e.get('event_type', 'EVENT'),
                'completed': e.get('completed', False),
                'raw_text': e.get('raw_text', '')
            }
        })
    return jsonify(formatted_events)

#API thêm sự kiện mới
@app.route('/api/add', methods=['POST'])
def add_event():
    data = request.json
    # Lấy câu lệnh gốc người dùng nhập
    raw_text = data.get('text') 
    
    try:
        # 1. Gửi cho AI phân tích
        processed_data = nlp.process_text(raw_text)
        
        # 2. Kiểm tra lỗi (Ngày không hợp lệ, giờ sai...)
        if not processed_data['is_valid']:
            return jsonify({
                'status': 'error', 
                'message': processed_data.get('error_message', 'Dữ liệu không hợp lệ')
            })

        # 3.Gán nội dung gốc vào kết quả để lưu xuống DB
        # (Để sau này hiển thị lại trong popup chi tiết)
        processed_data['raw_text'] = raw_text 

        # 4. Lưu vào Database
        db.add_event(processed_data)
        
        return jsonify({'status': 'success', 'data': processed_data})
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

#API cập nhật sự kiện
@app.route('/api/update/<int:event_id>', methods=['PUT'])
def update_event(event_id):
    data = request.json
    if db.update_event(event_id, data):
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error'})

#API xóa sự kiện
@app.route('/api/delete/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    db.delete_event(event_id)
    return jsonify({'status': 'success'})

#API xuất sự kiện ra file JSON
@app.route('/api/export', methods=['GET'])
def export_events():
    """Xuất danh sách sự kiện của một ngày cụ thể ra file JSON"""
    date_str = request.args.get('date')
    
    if not date_str:
        return "Thiếu tham số ngày!", 400

    all_events = db.get_all_events()
    
    # Lọc các sự kiện thuộc ngày đó (Start time bắt đầu bằng chuỗi ngày)
    daily_events = [e for e in all_events if e['start_time'].startswith(date_str)]
    
    # Chuyển thành JSON string (ensure_ascii=False để giữ tiếng Việt)
    json_str = json.dumps(daily_events, indent=4, ensure_ascii=False)
    
    # Tạo phản hồi dạng file tải về
    return Response(
        json_str,
        mimetype='application/json',
        headers={'Content-Disposition': f'attachment;filename=tasks_{date_str}.json'}
    )
    
# Trang dashboard test NLP
@app.route('/test-dashboard')
def test_dashboard():
    return render_template('test.html')

#API xử lý file test NLP
@app.route('/api/test-nlp', methods=['POST'])
def process_test_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "Không tìm thấy file"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "Chưa chọn file"}), 400

    try:
        # Đọc file CSV
        try:
            df = pd.read_csv(file, encoding='utf-8-sig')
        except UnicodeDecodeError:
            file.seek(0)
            df = pd.read_csv(file, encoding='cp1252')

        df.columns = df.columns.str.strip().str.lower()
        
        # Kiểm tra cột bắt buộc
        required_cols = ['text', 'expected_time', 'expected_location', 'expected_title']
        for col in required_cols:
            if col not in df.columns:
                # Nếu thiếu cột nào thì tự tạo cột đó rỗng để tránh lỗi
                df[col] = ''

        results = []
        correct_count = 0
        total_count = len(df)
        
        for index, row in df.iterrows():
            # 1. LẤY INPUT
            input_text = str(row.get('text', '')).strip()
            
            # 2. LẤY EXPECTED (Mong đợi)
            exp_time = str(row.get('expected_time', '')).strip()
            if pd.isna(row.get('expected_time')) or exp_time in ['', 'nan', 'NAN']: exp_time = "None"
            
            exp_loc = str(row.get('expected_location', '')).strip()
            if pd.isna(row.get('expected_location')) or exp_loc in ['', 'nan', 'NAN']: exp_loc = "None"
            
            exp_title = str(row.get('expected_title', '')).strip()

            # 3. CHẠY NLP (Thực tế)
            output = nlp.process_text(input_text)
            
            # 4. CHUẨN HÓA DỮ LIỆU THỰC TẾ ĐỂ SO SÁNH
            # - Thời gian
            act_raw_time = output.get('start_time', '')
            act_time = "None"
            if act_raw_time and len(act_raw_time) > 10:
                act_time = datetime.fromisoformat(act_raw_time).strftime("%H:%M")
            
            # - Địa điểm (Nếu rỗng thì là None)
            act_loc = output.get('location', '').strip()
            if not act_loc: act_loc = "None"
            
            # - Tiêu đề
            act_title = output.get('title', '').strip()

            # 5. SO SÁNH CHI TIẾT (Logic chấm điểm 3 lớp)
            # Hàm chuẩn hóa giờ
            def norm_time(t):
                if t == "None": return "None"
                try: return datetime.strptime(t, "%H:%M").strftime("%H:%M")
                except: return t

            check_time = norm_time(exp_time) == norm_time(act_time)
            # Địa điểm: So sánh không phân biệt hoa thường
            check_loc = exp_loc.lower() == act_loc.lower()
            # Tiêu đề: So sánh tương đối (chứa nhau là được, hoặc giống 80%)
            check_title = exp_title.lower() in act_title.lower() or act_title.lower() in exp_title.lower()

            # Đánh giá cuối cùng: Cả 3 phải đúng mới là PASS
            status = "FAIL"
            if check_time and check_loc and check_title:
                status = "PASS"
                correct_count += 1
            
            # Ghi chú lỗi sai ở đâu để hiển thị
            error_detail = []
            if not check_time: error_detail.append(f"Giờ sai ({act_time})")
            if not check_loc: error_detail.append(f"Vị trí sai ({act_loc})")
            if not check_title: error_detail.append(f"Tiêu đề sai ({act_title})")
            
            error_msg = ", ".join(error_detail) if status == "FAIL" else ""
            # 6. LƯU KẾT QUẢ
            results.append({
                "id": str(row.get('id', index + 1)),
                "text": input_text,
                "expected_time": exp_time,
                "actual_time": act_time,
                "expected_loc": exp_loc,
                "actual_loc": act_loc,
                "expected_title": exp_title,
                "actual_title": act_title,
                "status": status,
                "error": error_msg
            })

        accuracy = round((correct_count / total_count * 100), 2) if total_count > 0 else 0
        # Trả về kết quả
        return jsonify({
            "success": True,
            "accuracy": accuracy,
            "total": total_count,
            "correct": correct_count,
            "fail": total_count - correct_count,
            "data": results
        })

    except Exception as e:
        print(f"❌ LỖI SERVER: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# Hàm mở trình duyệt tự động khi chạy app
def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000")
    
if __name__ == '__main__':
    Timer(1, open_browser).start()
    app.run(debug=False, port=5000, use_reloader=False)