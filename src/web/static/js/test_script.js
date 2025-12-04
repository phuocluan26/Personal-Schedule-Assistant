// src/web/static/js/test_script.js

let myChart = null;
let currentData = []; // Lưu dữ liệu để export

// 1. Hàm hiển thị Toast thông báo
function showToast(title, message, isError = false) {
    const toastEl = document.getElementById('liveToast');
    const toastTitleEl = document.getElementById('toastTitle');
    const toastBodyEl = document.getElementById('toastBody');
    const bellIcon = toastEl.querySelector('.fas.fa-bell');

    toastTitleEl.textContent = title;
    toastBodyEl.textContent = message;

    if (isError) {
        toastTitleEl.classList.add('text-danger');
        if (bellIcon) {
            bellIcon.classList.remove('text-primary');
            bellIcon.classList.add('text-danger');
        }
        toastEl.classList.add('border-danger');
    } else {
        toastTitleEl.classList.remove('text-danger');
        if (bellIcon) {
            bellIcon.classList.remove('text-danger');
            bellIcon.classList.add('text-primary');
        }
        toastEl.classList.remove('border-danger');
    }

    const toast = new bootstrap.Toast(toastEl, {
        delay: 5000
    });
    toast.show();
}

// Hàm chính để chạy test NLP
function runNLPTest() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];

    // --- CHECK 1: Kiểm tra có file không ---
    if (!file) {
        showToast("Thiếu file", "Vui lòng chọn file CSV trước khi chạy!", true);
        return;
    }

    // --- CHECK 2: Kiểm tra đuôi file (.csv) ---
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast("Sai định dạng", "Vui lòng chỉ chọn file có đuôi .csv!", true);
        fileInput.value = '';
        return;
    }

    // --- CHECK 3: Kiểm tra cấu trúc cột bên trong file ---
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        const firstLine = content.split('\n')[0].trim();
        
        if (!firstLine) {
            showToast("File rỗng", "File CSV không có nội dung!", true);
            return;
        }

        // Tách các cột và chuẩn hóa (xóa BOM, xóa khoảng trắng, chữ thường)
        // Regex replace(/^\uFEFF/, '') để xóa ký tự BOM nếu file lưu dạng UTF-8 with BOM
        const headers = firstLine.split(',').map(h => 
            h.trim().toLowerCase().replace(/^"|"$/g, '').replace(/^\uFEFF/, '')
        );

        // Danh sách các cột bắt buộc phải có
        const requiredColumns = ['id', 'text', 'expected_time', 'expected_location', 'expected_title'];
        
        // Tìm các cột bị thiếu
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
            showToast(
                "Lỗi cấu trúc file", 
                `File không khớp yêu cầu! Thiếu các cột: ${missingColumns.join(', ')}`, 
                true
            );
            return;
        }

        uploadAndRunTest(file);
    };

    reader.onerror = function() {
        showToast("Lỗi đọc file", "Không thể đọc nội dung file!", true);
    };

    reader.readAsText(file);
}

// Hàm upload file và nhận kết quả từ server
function uploadAndRunTest(file) {
    const formData = new FormData();
    formData.append('file', file);

    const btn = document.querySelector('button[onclick="runNLPTest()"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
    btn.disabled = true;

    fetch('/api/test-nlp', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        btn.innerHTML = oldText;
        btn.disabled = false;

        if (data.success) {
            currentData = data.data;
            showDashboard(data);
            showToast("Thành công", `Đã xử lý xong ${data.total} câu test!`, false);
        } else {
            showToast("Lỗi xử lý", data.error, true);
        }
    })
    .catch(err => {
        btn.innerHTML = oldText;
        btn.disabled = false;
        console.error(err);
        showToast("Lỗi kết nối", "Không thể kết nối đến Server!", true);
    });
}

// Hàm hiển thị dashboard kết quả
function showDashboard(data) {
    document.getElementById('dashboardArea').classList.remove('d-none');
    
    document.getElementById('scoreText').innerText = data.accuracy + '%';
    document.getElementById('totalCount').innerText = data.total;
    document.getElementById('passCount').innerText = data.correct;
    document.getElementById('failCount').innerText = data.fail;

    renderChart(data.correct, data.fail);
    renderResults(data);
}

// Hàm hiển thị bảng kết quả chi tiết
function renderResults(data) {
    const tbody = document.getElementById('resultTableBody');
    tbody.innerHTML = ''; 
    
    data.data.forEach(row => {
        const statusBadge = row.status === 'PASS' 
            ? `<span class="status-pass"><i class="fas fa-check"></i> PASS</span>` 
            : `<span class="status-fail"><i class="fas fa-times"></i> FAIL</span>`;
        
        const trClass = row.status === 'FAIL' ? 'table-danger' : '';
        
        const errorMsg = row.error || ""; 
        const isTimeErr = errorMsg.includes("Giờ");
        const isLocErr = errorMsg.includes("Vị trí");
        const isTitleErr = errorMsg.includes("Tiêu đề");

        const formatCell = (exp, act, isError) => {
            const color = isError ? 'text-danger fw-bold' : 'text-dark';
            return `<div class="small text-muted">${exp}</div><div class="${color}">${act}</div>`;
        };

        const tr = `
            <tr class="${trClass}">
                <td>${row.id}</td>
                <td><small>${row.text}</small></td>
                <td>${formatCell(row.expected_time, row.actual_time, isTimeErr)}</td>
                <td>${formatCell(row.expected_loc, row.actual_loc, isLocErr)}</td>
                <td>${formatCell(row.expected_title, row.actual_title, isTitleErr)}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });
}

// Hàm vẽ biểu đồ Doughnut
function renderChart(pass, fail) {
    const ctx = document.getElementById('accuracyChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Chính xác', 'Sai sót'],
            datasets: [{
                data: [pass, fail],
                backgroundColor: ['#198754', '#dc3545'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            cutout: '70%'
        }
    });
}

// Hàm xuất kết quả ra file CSV
function exportResultCSV() {
    if (currentData.length === 0) {
        showToast("Lỗi xuất file", "Chưa có dữ liệu để xuất!", true);
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "\uFEFF"; 
    csvContent += "ID,Input Text,Expected Time,Actual Time,Expected Loc,Actual Loc,Expected Title,Actual Title,Status,Error\n";

    currentData.forEach(row => {
        const escape = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
        
        const line = [
            row.id,
            escape(row.text),
            escape(row.expected_time), escape(row.actual_time),
            escape(row.expected_loc), escape(row.actual_loc),
            escape(row.expected_title), escape(row.actual_title),
            row.status,
            escape(row.error)
        ].join(",");
        
        csvContent += line + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "nlp_test_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Thành công", "Đang tải xuống file báo cáo...", false);
}