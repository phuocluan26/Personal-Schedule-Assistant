// src/web/static/js/script.js

var calendar;
var currentEventId = null;
var allEventsCache = []; 
var currentFilterDate = new Date().toISOString().slice(0,10); 

document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Smart Schedule khởi động...");
    
    // 1. Khởi tạo Lịch
    var calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'vi',
        
        eventTimeFormat: {
            hour: '2-digit',   
            minute: '2-digit', 
            hour12: false,     
            meridiem: false
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
        events: '/api/events',
        
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

        // --- TÍNH NĂNG KÉO THẢ NGÀY ---
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
                    showToast(`👌 Đã dời lịch: ${info.event.title}`);
                    fetchEvents();
                } else {
                    info.revert();
                    alert("Lỗi cập nhật!");
                }
            });
        }
    });
    calendar.render();

    // 2. Tải dữ liệu ban đầu
    fetchEvents();
});

// --- HÀM TẢI DỮ LIỆU ---
function fetchEvents() {
    fetch('/api/events')
        .then(response => response.json())
        .then(data => {
            allEventsCache = data; 
            filterSidebarByDate(currentFilterDate);
        })
        .catch(err => {
            console.error("Lỗi tải API:", err);
            document.getElementById('taskList').innerHTML = '<div class="text-danger text-center mt-3">Lỗi kết nối Server!</div>';
        });
}

// --- HÀM LỌC SỰ KIỆN THEO NGÀY ---
function filterSidebarByDate(dateStr) {
    const displayDate = new Date(dateStr).toLocaleDateString('vi-VN');
    const titleEl = document.getElementById('sidebarTitle');
    if(titleEl) titleEl.innerHTML = `<i class="fas fa-calendar-day me-2"></i>CÔNG VIỆC ${displayDate}`;

    const filteredEvents = allEventsCache.filter(e => e.start.startsWith(dateStr));
    renderSidebar(filteredEvents);
}

// --- HÀM VẼ SIDEBAR (CẬP NHẬT: CHECKBOX) ---
function renderSidebar(events) {
    const listEl = document.getElementById('taskList');
    const countEl = document.getElementById('taskCount');
    listEl.innerHTML = ''; 
    
    if (!events || events.length === 0) {
        listEl.innerHTML = '<div class="text-center text-muted p-4"><i class="far fa-calendar-check fa-3x mb-3 text-secondary opacity-25"></i><br>Không có công việc nào.</div>';
        countEl.innerText = '0';
        return;
    }

    countEl.innerText = events.length;
    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    events.forEach(event => {
        let dateObj = new Date(event.start);
        let timeStr = dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
        if(event.allDay) timeStr = "Cả ngày";

        let location = event.extendedProps.location || '';
        let locHtml = location ? `<span class="badge bg-light text-secondary border"><i class="fas fa-map-marker-alt text-danger"></i> ${location}</span>` : '';
        let borderStyle = event.extendedProps.type === 'DEADLINE' ? 'border-left: 5px solid #dc3545;' : 'border-left: 5px solid #0d6efd;';

        // --- LOGIC CHECKBOX MỚI ---
        const completedProp = event.extendedProps.completed;
        const isDone = completedProp === true || completedProp === "true" || completedProp === 1;        
        const doneClass = isDone ? 'text-decoration-line-through opacity-50 bg-light' : '';
        const checkAttr = isDone ? 'checked' : '';
        
        // Nếu done thì đổi màu viền sang xám
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
                        <div class="mt-1">
                            ${locHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
        listEl.innerHTML += html;
    });
}

// --- LOGIC CHECKBOX UPDATE ---
function toggleTaskStatus(id, isChecked) {
    fetch('/api/update/' + id, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ completed: isChecked })
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === 'success') {
            // Cập nhật lại giao diện ngay lập tức
            fetchEvents();
            
            // Đổi màu trên Calendar luôn cho đồng bộ
            let calendarEvent = calendar.getEventById(id);
            if(calendarEvent) {
                calendarEvent.setExtendedProp('completed', isChecked);
                if(isChecked) {
                    calendarEvent.setProp('backgroundColor', '#6c757d'); // Màu xám
                    calendarEvent.setProp('borderColor', '#6c757d');
                } else {
                    // Trả lại màu cũ (Xanh hoặc Đỏ tùy type)
                    const type = calendarEvent.extendedProps.type;
                    const color = type === 'DEADLINE' ? '#dc3545' : '#3f9dff';
                    calendarEvent.setProp('backgroundColor', color);
                    calendarEvent.setProp('borderColor', color);
                }
            }
        }
    });
}

// --- XỬ LÝ THÊM SỰ KIỆN AI ---
function addEventAI() {
    let inputEl = document.getElementById('cmdInput');
    let text = inputEl.value.trim();
    if(!text) return alert("Vui lòng nhập nội dung!");

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
            showToast(`✅ Đã thêm: ${data.data.title}`);
        } else {
            alert("⚠️ " + data.message);
        }
    })
    .catch(err => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        alert("Lỗi kết nối: " + err);
    });
}

document.getElementById("cmdInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter") addEventAI();
});

function findAndOpenEvent(id) {
    let event = calendar.getEventById(id);
    if(event) openEditModal(event);
}

function openEditModal(event) {
    currentEventId = event.id;
    document.getElementById('editId').value = event.id;
    document.getElementById('editTitle').value = event.title;
    
    // Xử lý thời gian
    let start = event.start;
    if(start) {
        let isoStr = new Date(start.getTime() - (start.getTimezoneOffset() * 60000)).toISOString().slice(0,16);
        document.getElementById('editStart').value = isoStr;
    }
    
    // Đổ dữ liệu Location
    document.getElementById('editLocation').value = event.extendedProps.location || '';
    
    // --- ĐỔ DỮ LIỆU RAW TEXT (MỚI) ---
    const raw = event.extendedProps.raw_text || "(Không có dữ liệu gốc)";
    const rawInput = document.getElementById('editRawText');
    if(rawInput) rawInput.value = raw;
    // ---------------------------------
    
    var myModal = new bootstrap.Modal(document.getElementById('eventModal'));
    myModal.show();
}

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
            calendar.refetchEvents();
            fetchEvents();
        }
    });
}

function deleteCurrentEvent() {
    if(confirm("Xóa sự kiện này?")) {
        fetch('/api/delete/' + currentEventId, {method: 'DELETE'})
        .then(() => {
            document.querySelector('#eventModal .btn-close').click();
            calendar.refetchEvents();
            fetchEvents();
        });
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'position-fixed bottom-0 end-0 p-3';
    toast.style.zIndex = '11';
    toast.innerHTML = `<div class="toast show bg-success text-white"><div class="toast-body">${message}</div></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ==========================================
// HỆ THỐNG NHẮC NHỞ (FIXED LOCALSTORAGE)
// ==========================================

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
        // Chỉ nhắc nếu chưa hoàn thành (completed != true)
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