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

function filterSidebarByDate(dateStr) {
    const displayDate = new Date(dateStr).toLocaleDateString('vi-VN');
    const titleEl = document.getElementById('sidebarTitle');
    if(titleEl) titleEl.innerHTML = `<i class="fas fa-calendar-day me-2"></i>CÔNG VIỆC ${displayDate}`;
    const filteredEvents = allEventsCache.filter(e => e.start.startsWith(dateStr));
    renderSidebar(filteredEvents);
}

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

document.getElementById("cmdInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter") addEventAI();
});

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

// --- CẬP NHẬT: THÊM TOAST KHI LƯU ---
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

// --- CẬP NHẬT: DÙNG SWEETALERT THAY CONFIRM ---
function deleteCurrentEvent() {
    // Ẩn modal edit trước (nếu đang mở) để hiện SweetAlert cho đẹp
    // (Optional, nhưng UX tốt hơn)
    
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

// --- TÍNH NĂNG: XUẤT FILE JSON ---
function exportDailyTasks() {
    // currentFilterDate là biến toàn cục lưu ngày đang chọn (đã khai báo ở đầu file)
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

// --- NOTIFICATION SYSTEM ---
if (Notification.permission !== "granted") {
    Notification.requestPermission();
}

setInterval(checkReminders, 5000); 

function getNotifiedSet() {
    const stored = localStorage.getItem('notified_events');
    return new Set(stored ? JSON.parse(stored) : []);
}

function addToNotifiedSet(id) {
    const currentSet = getNotifiedSet();
    currentSet.add(String(id)); 
    localStorage.setItem('notified_events', JSON.stringify([...currentSet]));
}

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