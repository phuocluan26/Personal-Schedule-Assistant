# 📅 Smart Schedule AI - Trợ Lý Lịch Trình Cá Nhân

**Smart Schedule AI** là ứng dụng quản lý thời gian thông minh trên máy tính, cho phép người dùng **nhập liệu bằng ngôn ngữ tự nhiên tiếng Việt** (ví dụ: *"Họp team lúc 9h sáng mai tại phòng 302"*) thay vì phải chọn ngày giờ thủ công.

> **Tác giả:** Nguyễn Phước Luân  
> **Phiên bản:** 1.0.0

---

## ✨ Tính năng nổi bật

### 🧠 1. Xử lý ngôn ngữ tự nhiên (NLP)
* **Hiểu tiếng Việt:** Tự động nhận diện Thời gian (ngày, giờ, buổi), Địa điểm và Tên sự kiện từ câu nói.
* **Xử lý linh hoạt:** Hiểu các cụm từ như *"ngày mai"*, *"tuần sau"*, *"cuối tuần"*, *"hôm nay"*.
* **Tự động nhắc nhở:** Hỗ trợ đặt lịch nhắc (VD: *"nhắc trước 15 phút"*).

### 🗓️ 2. Quản lý lịch trình trực quan
* **Giao diện Lịch (Calendar):** Xem tổng quan theo Tháng, Tuần, Ngày.
* **Kéo thả (Drag & Drop):** Dễ dàng thay đổi giờ sự kiện bằng cách kéo thả trên lịch.
* **Danh sách (List View):** Xem danh sách công việc chi tiết bên thanh Sidebar.

### 🔍 3. Công cụ mạnh mẽ
* **Tìm kiếm thông minh:** Tìm nhanh sự kiện theo tên hoặc địa điểm. Nhấn vào kết quả để nhảy ngay đến ngày đó.
* **Test Dashboard:** Giao diện kiểm thử độ chính xác của AI với báo cáo trực quan (Biểu đồ, Pass/Fail).
* **Xuất dữ liệu:** Hỗ trợ xuất lịch trình ra file JSON để sao lưu.

---

## 🚀 Hướng dẫn Cài đặt & Sử dụng (Dành cho Người dùng)

Bạn không cần cài đặt Python hay phần mềm phức tạp. Hãy chọn 1 trong 2 cách sau:

### ✅ Cách 1: Chạy file .EXE (Khuyên dùng)
Đây là cách nhanh nhất, giống như mở một phần mềm bình thường.

1.  Truy cập thư mục **`dist/`**.
2.  Tìm file **`SmartScheduleAI.exe`**.
3.  Nhấn đúp chuột để chạy.
4.  Ứng dụng sẽ tự động mở trình duyệt Web tại địa chỉ `http://127.0.0.1:5000`.

> **Lưu ý:** Do phần mềm tự phát triển chưa có chữ ký số (Digital Signature), một số trình diệt virus hoặc Windows Defender có thể cảnh báo. Bạn hãy chọn **"Run anyway" (Chạy bằng mọi giá)** hoặc thêm vào danh sách tin cậy.

### 🛠️ Cách 2: Chạy file .BAT (Dự phòng)
Nếu máy tính chặn file `.exe`, bạn có thể dùng cách này. File này sẽ tự động cài đặt môi trường cần thiết cho bạn.

1.  Tìm file **`Start_App.bat`** ở thư mục gốc.
2.  Nhấn đúp chuột để chạy.
3.  Chương trình sẽ tự động kiểm tra, cài đặt thư viện (nếu thiếu) và khởi động ứng dụng.

---

## 📖 Hướng dẫn ra lệnh cho AI

Hãy nhập câu lệnh vào ô trống trên cùng và nhấn **Thêm (AI)** hoặc phím **Enter**.

| Loại thông tin | Ví dụ câu lệnh | Kết quả AI hiểu |
| :--- | :--- | :--- |
| **Giờ cụ thể** | "Đi xem phim lúc **19h30** tối nay" | 19:30 Hôm nay |
| **Ngày tương đối** | "Nộp báo cáo **sáng mai**" | 08:00 Ngày mai |
| **Thứ trong tuần** | "Họp team **thứ 2 tuần sau**" | Thứ 2 của tuần kế tiếp |
| **Địa điểm** | "Cafe **tại Highland** lúc 9h" | Địa điểm: Highland |
| **Nhắc nhở** | "Đi đón con **nhắc trước 30p**" | Đặt lịch nhắc trước 30 phút |
| **Kết hợp** | "**Sáng mai 8h** đi làm **ở công ty**" | 08:00 Mai - Tại: Công ty |

---

## 🏗️ Cấu trúc dự án (Dành cho Dev)

Dự án được xây dựng theo mô hình MVC sử dụng **Flask (Python)** cho Backend và **HTML/JS/Bootstrap** cho Frontend.

```text
PersonalScheduleAssistant/
│
├── data/
│   └── events.json             <-- Database lưu trữ sự kiện
│
├── src/
│   ├── database/
│   │   └── db_manager.py       <-- Quản lý đọc/ghi file JSON
│   │
│   ├── nlp/
│   │   ├── engine.py           <-- Logic chính
│   │   ├── ner.py              <-- Trích xuất địa điểm
│   │   ├── rules.py            <-- Luật Regex
│   │   ├── processor.py        <-- Chuẩn hóa văn bản
│   │   └── time_parser.py      <-- Xử lý thời gian
│   │
│   ├── web/
│   │   ├── static/
│   │   │   ├── css/
│   │   │   │   └── style.css
│   │   │   └── js/
│   │   │       ├── script.js       <-- Trang chủ
│   │   │       └── test_script.js  <-- Trang Test
│   │   │
│   │   └── templates/
│   │       ├── index.html      <-- Giao diện chính
│   │       └── test.html       <-- Giao diện Test
│   │
│   └── app.py                  <-- Server Flask
│
├── test/                       <-- Thư mục chứa dữ liệu kiểm thử
│   ├── test_cases_2.csv
│   └── test_cases.csv
│
├── dist/
│   └── SmartScheduleAI.exe       <-- File chạy chương trình
│
├── Start_App.bat               <-- File chạy dự phòng (Script tự cài môi trường)
└──  requirements.txt            <-- Danh sách thư viện
````

## 💻 Công nghệ sử dụng

  * **Ngôn ngữ:** Python 3.x
  * **Web Framework:** Flask
  * **Frontend:** HTML5, CSS3, Bootstrap 5, FullCalendar.js
  * **NLP Library:** Underthesea (Tokenize), Regex, Python-dateutil
  * **Build Tool:** PyInstaller

## ⚙️ Chạy từ mã nguồn (Source Code)

Nếu bạn muốn chỉnh sửa code, hãy làm theo các bước sau:

1.  **Clone dự án:**

    ```bash
    git clone [https://github.com/phuocluan26/Personal-Schedule-Assistant.git](https://github.com/username/PersonalScheduleAssistant.git)
    cd PersonalScheduleAssistant
    ```

2.  **Cài đặt thư viện:**

    ```bash
    pip install -r requirements.txt
    ```

3.  **Chạy ứng dụng:**

    ```bash
    python src/app.py
    ```

-----

*Đồ án chuyên ngành - Năm học 2025 - 3121410306 - Nguyễn Phước Luân*
