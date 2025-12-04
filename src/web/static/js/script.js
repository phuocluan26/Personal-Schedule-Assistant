// src/web/static/js/script.js

var calendar;
var currentEventId = null;
var allEventsCache = []; 
var currentFilterDate = new Date().toISOString().slice(0,10); 

document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Smart Schedule khởi động...");
    
    var calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'vi',
        eventTimeFormat: {
            hour: '2-digit', minute: '2-digit', hour12: false, meridiem: false
        },
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        buttonText: { today: 'Hôm nay', month: 'Tháng', week: 'Tuần', list: 'Danh sách' },
        height: 'auto',
        navLinks: false, 
        editable: true,
        droppable: true,
        dayMaxEvents: true, 
        
        dateClick: function(info) {
            console.log("📅 Đã chọn ngày:", info.dateStr);
            currentFilterDate = info.dateStr;
            document.querySelectorAll('.fc-daygrid-day').forEach(el => el.classList.remove('selected-day-highlight'));
            info.dayEl.classList.add('selected-day-highlight');
            filterSidebarByDate(currentFilterDate);
        },

        eventClick: function(info) {
            openEditModal(info.event);
        },

        eventDrop: function(info) {
            const newStart = info.event.start;
            const isoStart = new Date(newStart.getTime() - (newStart.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            
            fetch('/api/update/' + info.event.id, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ start_time: isoStart })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(`👌 Đã dời lịch: ${info.event.title}`, 'success');
                    fetchEvents();
                } else {
                    info.revert();
                    showToast("Lỗi cập nhật!", 'error');
                }
            });
        }
    });
    calendar.render();
    fetchEvents();
});

//Báo lỗi tải API và hiển thị thông báo
function fetchEvents() {
    fetch('/api/events')
        .then(response => response.json())
        .then(data => {
            allEventsCache = data; 
            const activeEventsForCalendar = data.filter(e => !e.extendedProps.completed);
            calendar.removeAllEvents();
            calendar.addEventSource(activeEventsForCalendar);
            filterSidebarByDate(currentFilterDate);
        })
        .catch(err => {
            console.error("Lỗi tải API:", err);
            document.getElementById('taskList').innerHTML = '<div class="text-danger text-center mt-3">Lỗi kết nối Server!</div>';
            showToast("Lỗi kết nối Server!", 'error');
        });
}

// Lọc và hiển thị sidebar theo ngày đã chọn
function filterSidebarByDate(dateStr) {
    const displayDate = new Date(dateStr).toLocaleDateString('vi-VN');
    const titleEl = document.getElementById('sidebarTitle');
    if(titleEl) titleEl.innerHTML = `<i class="fas fa-calendar-day me-2"></i>CÔNG VIỆC ${displayDate}`;
    const filteredEvents = allEventsCache.filter(e => e.start.startsWith(dateStr));
    renderSidebar(filteredEvents);
}

// Hiển thị sidebar
function renderSidebar(events) {
    const listEl = document.getElementById('taskList');
    const countEl = document.getElementById('taskCount');
    listEl.innerHTML = ''; 
    const activeCount = events.filter(e => !e.extendedProps.completed).length;
    countEl.innerText = activeCount;

    if (!events || events.length === 0) {
        listEl.innerHTML = '<div class="text-center text-muted p-4"><i class="far fa-calendar-check fa-3x mb-3 text-secondary opacity-25"></i><br>Không có công việc nào.</div>';
        return;
    }

    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    events.forEach(event => {
        let dateObj = new Date(event.start);
        let timeStr = dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        if(event.allDay) timeStr = "Cả ngày";

        let location = event.extendedProps.location || '';
        let locHtml = location ? `<span class="badge bg-light text-secondary border"><i class="fas fa-map-marker-alt text-danger"></i> ${location}</span>` : '';
        let borderStyle = event.extendedProps.type === 'DEADLINE' ? 'border-left: 5px solid #dc3545;' : 'border-left: 5px solid #0d6efd;';

        const isDone = event.extendedProps.completed === true;
        const doneClass = isDone ? 'text-decoration-line-through opacity-50 bg-light' : '';
        const checkAttr = isDone ? 'checked' : '';
        if(isDone) borderStyle = 'border-left: 5px solid #6c757d;';

        let html = `
            <div class="card task-card border-0 p-3 ${doneClass}" style="${borderStyle}">
                <div class="d-flex align-items-center">
                    <div class="me-3">
                        <input type="checkbox" class="form-check-input" style="transform: scale(1.3); cursor: pointer;" 
                            ${checkAttr} onclick="toggleTaskStatus(${event.id}, this.checked); event.stopPropagation();">
                    </div>
                    <div class="flex-grow-1" onclick="findAndOpenEvent(${event.id})">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <h6 class="fw-bold text-dark m-0" style="line-height: 1.4;">${event.title}</h6>
                            <span class="badge bg-primary bg-opacity-10 text-primary ms-2">${timeStr}</span>
                        </div>
                        <div class="mt-1">${locHtml}</div>
                    </div>
                </div>
            </div>
        `;
        listEl.innerHTML += html;
    });
}

// Cập nhật trạng thái hoàn thành công việc
function toggleTaskStatus(id, isChecked) {
    fetch('/api/update/' + id, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ completed: isChecked })
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === 'success') {
            fetchEvents(); 
            if(isChecked) showToast("Đã hoàn thành công việc!", 'success');
        }
    });
}

// Thêm công việc mới bằng AI
function addEventAI() {
    let inputEl = document.getElementById('cmdInput');
    let text = inputEl.value.trim();
    if(!text) {
        showToast("Vui lòng nhập nội dung công việc!", 'error');
        inputEl.focus();
        return;
    }

    let btn = document.querySelector('button[onclick="addEventAI()"]');
    let originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Xử lý...';
    btn.disabled = true;

    fetch('/api/add', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text: text})
    })
    .then(response => response.json())
    .then(data => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        
        if(data.status === 'success') {
            inputEl.value = '';
            calendar.refetchEvents(); 
            fetchEvents(); 
            showToast(`Đã thêm: ${data.data.title}`, 'success');
        } else {
            showToast(data.message, 'error');
        }
    })
    .catch(err => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        showToast("Lỗi kết nối đến Server!", 'error');
    });
}

// Xử lý phím Enter trong ô input
document.getElementById("cmdInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter") addEventAI();
});

// Mở modal sửa sự kiện
function findAndOpenEvent(id) {
    let eventData = allEventsCache.find(e => e.id == id);
    if(eventData) {
        let mockEvent = {
            id: eventData.id,
            title: eventData.title,
            start: eventData.start ? new Date(eventData.start) : null,
            extendedProps: eventData.extendedProps
        };
        openEditModal(mockEvent);
    }
}

function openEditModal(event) {
    currentEventId = event.id;
    document.getElementById('editId').value = event.id;
    document.getElementById('editTitle').value = event.title;
    
    let start = event.start;
    if(start) {
        let isoStr = new Date(start.getTime() - (start.getTimezoneOffset() * 60000)).toISOString().slice(0,16);
        document.getElementById('editStart').value = isoStr;
    }
    
    let props = event.extendedProps || {};
    document.getElementById('editLocation').value = props.location || '';
    
    const raw = props.raw_text || "(Không có dữ liệu gốc)";
    const rawInput = document.getElementById('editRawText');
    if(rawInput) rawInput.value = raw;
    
    var myModal = new bootstrap.Modal(document.getElementById('eventModal'));
    myModal.show();
}

// --- THÊM TOAST KHI LƯU ---
function saveEventUpdate() {
    if(!currentEventId) return;
    let data = {
        title: document.getElementById('editTitle').value,
        start_time: document.getElementById('editStart').value,
        location: document.getElementById('editLocation').value
    };
    fetch('/api/update/' + currentEventId, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    }).then(res => res.json()).then(response => {
        if(response.status === 'success') {
            document.querySelector('#eventModal .btn-close').click();
            fetchEvents();
            showToast("Đã lưu thay đổi thành công!", 'success'); // <--- Đã thêm
        } else {
            showToast("Lỗi khi lưu!", 'error');
        }
    });
}

// --- THÊM XÁC NHẬN KHI XÓA ---
function deleteCurrentEvent() {

// Xác nhận trước khi xóa
    Swal.fire({
        title: 'Bạn có chắc chắn?',
        text: "Sự kiện này sẽ bị xóa vĩnh viễn!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Xóa ngay',
        cancelButtonText: 'Hủy'
    }).then((result) => {
        if (result.isConfirmed) {
            fetch('/api/delete/' + currentEventId, {method: 'DELETE'})
            .then(() => {
                // Đóng modal chi tiết
                document.querySelector('#eventModal .btn-close').click();
                fetchEvents();
                showToast("Đã xóa sự kiện!", 'success');
            })
            .catch(() => showToast("Lỗi khi xóa!", 'error'));
        }
    });
}

// --- HỆ THỐNG TOAST ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'position-fixed bottom-0 end-0 p-3';
    toast.style.zIndex = '9999'; 
    
    let bgClass = 'bg-success'; 
    let icon = '✅';
    
    if (type === 'error') {
        bgClass = 'bg-danger'; 
        icon = '⚠️';
    }

    toast.innerHTML = `
        <div class="toast show ${bgClass} text-white shadow-lg border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-body fs-6">
                ${icon} ${message}
            </div>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = "opacity 0.5s ease";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// --- XUẤT FILE JSON ---
function exportDailyTasks() {
    if (!currentFilterDate) {
        showToast("Chưa chọn ngày để xuất!", "error");
        return;
    }

    // Kiểm tra xem ngày đó có task không (dựa vào cache)
    const tasksOfDay = allEventsCache.filter(e => e.start.startsWith(currentFilterDate));
    if (tasksOfDay.length === 0) {
        showToast("Ngày này không có công việc nào để xuất.", "error");
        return;
    }

    // Gọi đường dẫn tải về (Trình duyệt sẽ tự xử lý việc download)
    window.location.href = `/api/export?date=${currentFilterDate}`;
    
    showToast("Đang tải xuống file JSON...", "success");
}

// --- HỆ THỐNG NHẮC NHỞ ---
if (Notification.permission !== "granted") {
    Notification.requestPermission();
}

setInterval(checkReminders, 5000); 

// Lấy tập đã thông báo từ localStorage
function getNotifiedSet() {
    const stored = localStorage.getItem('notified_events');
    return new Set(stored ? JSON.parse(stored) : []);
}

// Thêm ID sự kiện vào tập đã thông báo
function addToNotifiedSet(id) {
    const currentSet = getNotifiedSet();
    currentSet.add(String(id)); 
    localStorage.setItem('notified_events', JSON.stringify([...currentSet]));
}

// Kiểm tra và hiển thị nhắc nhở
function checkReminders() {
    const now = new Date();
    const notifiedEvents = getNotifiedSet();

    if (typeof allEventsCache === 'undefined' || !allEventsCache) return;

    allEventsCache.forEach(event => {
        if (!event.allDay && event.start && !event.extendedProps.completed) {
            
            const eventTime = new Date(event.start);
            const diffMs = eventTime - now;
            const diffMinutes = diffMs / (1000 * 60); 

            const settingMinutes = event.extendedProps.reminder_minutes || 15;
            const eventID = String(event.id);

            if (diffMinutes > 0 && diffMinutes <= settingMinutes) {
                if (!notifiedEvents.has(eventID)) {
                    console.log(`🔔 TING TING: ${event.title}`);
                    showPersistentNotification(event, Math.ceil(diffMinutes));
                    playNotificationSound();
                    addToNotifiedSet(eventID);
                }
            }
        }
    });
}

// Hiển thị thông báo nhắc nhở
function showPersistentNotification(event, minutesLeft) {
    if (Notification.permission === "granted") {
        const timeStr = new Date(event.start).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        const titleLine = `${timeStr} - ${event.title}`;
        const timeStatus = minutesLeft <= 1 ? "Sắp diễn ra ngay" : `Còn ${minutesLeft} phút`;
        const locationLine = event.extendedProps.location ? `\n📍 Tại: ${event.extendedProps.location}` : "";

        const notification = new Notification(`🎗️ NHẮC NHỞ (${timeStatus})`, {
            body: titleLine + locationLine,
            icon: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png",
            requireInteraction: true,
            tag: event.id 
        });
        
        notification.onclick = function() {
            window.focus();
            this.close();
        };
    }
}

// Phát âm thanh nhắc nhở
function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = 880; 
        gain.gain.value = 0.1; 
        osc.start();
        setTimeout(() => osc.stop(), 1000); 
    } catch(e) {
        console.error("Audio error:", e);
    }
}

// --- 1. HÀM TÌM KIẾM ---
function searchTasks() {
    const keyword = document.getElementById('searchInput').value.toLowerCase().trim();
    
    // Nếu ô tìm kiếm trống -> Quay về hiển thị sự kiện của ngày đang chọn
    if (!keyword) {
        filterSidebarByDate(currentFilterDate);
        return;
    }

    // Lọc trong toàn bộ cache sự kiện
    const filtered = allEventsCache.filter(e => {
        const title = (e.title || '').toLowerCase();
        const loc = (e.extendedProps.location || '').toLowerCase();
        // Tìm theo tên hoặc địa điểm
        return title.includes(keyword) || loc.includes(keyword);
    });

    // Đổi tiêu đề sidebar
    const titleEl = document.getElementById('sidebarTitle');
    if(titleEl) titleEl.innerHTML = `<i class="fas fa-search me-2 text-danger"></i>KẾT QUẢ TÌM KIẾM`;
    
    // Gọi render với chế độ tìm kiếm = true
    renderSidebar(filtered, true);
}

// --- 2. HÀM RENDER SIDEBAR ---
function renderSidebar(events, isSearchMode = false) {
    const listEl = document.getElementById('taskList');
    const countEl = document.getElementById('taskCount');
    
    listEl.innerHTML = ''; 
    const activeCount = events.filter(e => !e.extendedProps.completed).length;
    if(countEl) countEl.innerText = activeCount;

    if (!events || events.length === 0) {
        listEl.innerHTML = '<div class="text-center text-muted p-4"><i class="far fa-calendar-times fa-3x mb-3 text-secondary opacity-25"></i><br>Không tìm thấy kết quả.</div>';
        return;
    }

    // Sắp xếp tăng dần theo thời gian
    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    events.forEach(event => {
        let dateObj = new Date(event.start);
        let timeStr = dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        if(event.allDay) timeStr = "Cả ngày";

        // Ngày dưới dạng badge (chỉ hiển thị khi ở chế độ tìm kiếm)
        let dateBadge = '';
        if (isSearchMode) {
            const dateStrDisplay = dateObj.toLocaleDateString('vi-VN');
            dateBadge = `<span class="badge bg-info text-dark me-2 mb-1"><i class="far fa-calendar-alt"></i> ${dateStrDisplay}</span>`;
        }

        let location = event.extendedProps.location || '';
        let locHtml = location ? `<span class="badge bg-light text-secondary border"><i class="fas fa-map-marker-alt text-danger"></i> ${location}</span>` : '';
        
        let borderStyle = event.extendedProps.type === 'DEADLINE' ? 'border-left: 5px solid #dc3545;' : 'border-left: 5px solid #0d6efd;';
        const isDone = event.extendedProps.completed === true;
        const doneClass = isDone ? 'text-decoration-line-through opacity-50 bg-light' : '';
        const checkAttr = isDone ? 'checked' : '';
        if(isDone) borderStyle = 'border-left: 5px solid #6c757d;';

        // Hành động khi click vào thẻ:
        // - Nếu đang tìm kiếm: Click sẽ nhảy đến ngày đó (jumpToDate)
        // - Nếu đang xem ngày: Click sẽ mở chi tiết để sửa (findAndOpenEvent)
        const clickAction = isSearchMode 
            ? `jumpToDate('${event.start}')` 
            : `findAndOpenEvent(${event.id})`;

        // Tiêu đề tooltip
        const titleTooltip = isSearchMode ? "Nhấn để đi đến ngày này" : "Nhấn để sửa";

        let html = `
            <div class="card task-card border-0 p-3 ${doneClass}" style="${borderStyle}; cursor: pointer;" onclick="${clickAction}" title="${titleTooltip}">
                <div class="d-flex align-items-center">
                    <div class="me-3">
                        <input type="checkbox" class="form-check-input" style="transform: scale(1.3); cursor: pointer;" 
                            ${checkAttr} onclick="toggleTaskStatus(${event.id}, this.checked); event.stopPropagation();">
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex flex-column align-items-start mb-1">
                            ${dateBadge}
                            <h6 class="fw-bold text-dark m-0" style="line-height: 1.4;">${event.title}</h6>
                        </div>
                        <div class="mt-1">
                            <span class="badge bg-primary bg-opacity-10 text-primary">${timeStr}</span>
                            ${locHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
        listEl.innerHTML += html;
    });
}

// --- 3. HÀM NHẢY ĐẾN NGÀY TỪ KẾT QUẢ TÌM KIẾM ---
function jumpToDate(isoDateStr) {
    // 1. Lấy ngày YYYY-MM-DD
    const targetDate = isoDateStr.slice(0, 10);
    
    console.log("🚀 Nhảy đến ngày:", targetDate);

    // 2. Điều khiển Calendar nhảy đến ngày đó
    calendar.gotoDate(targetDate);
    
    // 3. Quan trọng: Cập nhật biến toàn cục và Sidebar
    currentFilterDate = targetDate;
    
    // 4. Xóa ô tìm kiếm để người dùng thấy danh sách đầy đủ của ngày đó
    document.getElementById('searchInput').value = '';
    
    // 5. Highlight ngày trên lịch
    document.querySelectorAll('.fc-daygrid-day').forEach(el => el.classList.remove('selected-day-highlight'));
    const dayEl = document.querySelector(`.fc-day[data-date="${targetDate}"]`);
    if(dayEl) dayEl.classList.add('selected-day-highlight');

    // 6. Hiển thị lại sidebar chuẩn của ngày đó
    filterSidebarByDate(targetDate);
    
    showToast(`Đã chuyển đến ngày ${new Date(targetDate).toLocaleDateString('vi-VN')}`, 'success');
}