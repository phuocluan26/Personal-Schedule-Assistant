# src/app.py
from flask import Flask, render_template, request, jsonify
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database.db_manager import DBManager
from nlp.engine import NLPEngine

app = Flask(__name__, template_folder='web/templates', static_folder='web/static')
db = DBManager()
nlp = NLPEngine()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/events', methods=['GET'])
def get_events():
    events = db.get_all_events()
    formatted_events = []
    
    for e in events:
        # Xử lý màu sắc
        event_color = '#3f9dff' # Xanh (Default)
        if e.get('event_type') == 'DEADLINE':
            event_color = '#dc3545' # Đỏ

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

        # 3. QUAN TRỌNG: Gán nội dung gốc vào kết quả để lưu xuống DB
        # (Để sau này hiển thị lại trong popup chi tiết)
        processed_data['raw_text'] = raw_text 

        # 4. Lưu vào Database
        db.add_event(processed_data)
        
        return jsonify({'status': 'success', 'data': processed_data})
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

@app.route('/api/update/<int:event_id>', methods=['PUT'])
def update_event(event_id):
    data = request.json
    if db.update_event(event_id, data):
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error'})

@app.route('/api/delete/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    db.delete_event(event_id)
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)