const API_URL = 'http://vmedu436.mtacloud.co.il:3000/api';

let currentUser = null;
let currentActionCallback = null;

// --- אתחול ---
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn("No token found.");
        // window.location.href = 'login.html';
        return;
    }

    try {
        await loadUserDetails(); // זה קריטי - כאן נקבע איזה טאבים להציג
        switchTab('my-orders');
    } catch (error) {
        console.error("Auth failed", error);
        logout();
    }
});

// --- Auth & User Details ---
async function loadUserDetails() {
    const user = await fetchData('/auth/me');
    if (!user) return;

    currentUser = user;
    document.getElementById('nav-username').innerText = `שלום, ${user.first_name}`;

    // מילוי פרטים אישיים
    setText('detail-name', `${user.first_name} ${user.last_name}`);
    setText('detail-email', user.email);
    setText('detail-phone', user.phone_number || '-');
    setText('detail-type', translateUserType(user.user_type));
    if (user.registration_date) {
        setText('detail-date', new Date(user.registration_date).toLocaleDateString('he-IL'));
    }

    // --- לוגיקה להצגת טאבים לפי הרשאה ---
    if (user.user_type === 'community_manager') {
        document.getElementById('btn-managed-communities').style.display = 'flex';
    }
    if (user.user_type === 'space_manager') {
        document.getElementById('btn-managed-spaces').style.display = 'flex';
        document.getElementById('btn-incoming-orders').style.display = 'flex';
    }
    if (user.user_type === 'admin') {
        // אדמין רואה הכל (לצורך הדגמה)
        document.getElementById('btn-managed-communities').style.display = 'flex';
        document.getElementById('btn-managed-spaces').style.display = 'flex';
        document.getElementById('btn-incoming-orders').style.display = 'flex';
    }
}

// --- Navigation ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${tabId}`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active-content'));
    document.getElementById(tabId).classList.add('active-content');

    // טעינת מידע לפי דרישה
    if (tabId === 'my-orders') loadMyOrders();
    if (tabId === 'my-events') loadMyEvents();
    if (tabId === 'my-communities') loadMyCommunities();
    
    // טעינת מידע לטאבים של מנהלים
    if (tabId === 'managed-communities') loadManagedCommunities();
    if (tabId === 'managed-spaces') loadManagedSpaces();
    if (tabId === 'incoming-orders') loadIncomingOrders();
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

// ==========================================
// 1. נתונים בסיסיים (לכולם)
// ==========================================
async function loadMyOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="loading">טוען הזמנות...</div>';
    const orders = await fetchData('/orders/my-orders');
    const activeOrders = orders ? orders.filter(order => order.status !== 'canceled') : [];

    if (activeOrders.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-times" style="font-size:40px; margin-bottom:10px;"></i><p>אין הזמנות פעילות.</p></div>`;
        return;
    }
    container.innerHTML = activeOrders.map(order => createOrderCard(order)).join('');
}

async function loadMyEvents() {
    const container = document.getElementById('events-list');
    container.innerHTML = '<div class="loading">טוען אירועים...</div>';
    const events = await fetchData('/events/my-events');
    if (!events || events.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-ticket-alt" style="font-size:40px; margin-bottom:10px;"></i><p>לא נרשמת לאירועים.</p></div>`;
        return;
    }
    container.innerHTML = events.map(event => createEventCard(event)).join('');
}

async function loadMyCommunities() {
    const container = document.getElementById('communities-list');
    container.innerHTML = '<div class="loading">טוען קהילות...</div>';
    const communities = await fetchData('/communities/my-communities');
    if (!communities || communities.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-users-slash" style="font-size:40px; margin-bottom:10px;"></i><p>אינך חבר בקהילות.</p></div>`;
        return;
    }
    container.innerHTML = communities.map(c => createCommunityCard(c, false)).join('');
}

// ==========================================
// 2. פונקציות למנהלי קהילה
// ==========================================
async function loadManagedCommunities() {
    const container = document.getElementById('managed-communities-list');
    container.innerHTML = '<div class="loading">טוען קהילות בניהולך...</div>';
    
    // קריאה לנתיב החדש שיצרנו/וידאנו ב-Backend
    const communities = await fetchData('/communities/my-managing');
    
    if (!communities || communities.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>אינך מנהל קהילות כרגע.</p></div>`;
        return;
    }
    // הפרמטר true אומר: תוסיף כפתור עריכה
    container.innerHTML = communities.map(c => createCommunityCard(c, true)).join('');
}

function openEditCommunityModal(id, name, subject, image) {
    document.getElementById('edit-community-id').value = id;
    document.getElementById('edit-community-name').value = name;
    document.getElementById('edit-community-subject').value = subject;
    document.getElementById('edit-community-image').value = image || '';
    document.getElementById('editCommunityModal').style.display = 'block';
}

async function saveCommunityChanges() {
    const id = document.getElementById('edit-community-id').value;
    const body = {
        community_name: document.getElementById('edit-community-name').value,
        main_subject: document.getElementById('edit-community-subject').value,
        image_url: document.getElementById('edit-community-image').value
    };

    const res = await fetch(`${API_URL}/communities/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(body)
    });

    if (res.ok) {
        alert('הקהילה עודכנה בהצלחה');
        closeModal('editCommunityModal');
        loadManagedCommunities(); // ריענון
    } else {
        alert('שגיאה בעדכון הקהילה');
    }
}

// ==========================================
// 3. פונקציות למנהלי מרחב
// ==========================================
async function loadManagedSpaces() {
    const container = document.getElementById('managed-spaces-list');
    container.innerHTML = '<div class="loading">טוען מרחבים בניהולך...</div>';
    
    // קריאה לנתיב החדש שיצרנו ב-Backend
    const spaces = await fetchData('/spaces/my-managing');

    if (!spaces || spaces.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>אינך מנהל מרחבים כרגע.</p></div>`;
        return;
    }

    container.innerHTML = spaces.map(s => `
        <div class="card">
            <h3>${s.space_name}</h3>
            <div class="card-info"><i class="fas fa-map-marker-alt"></i> ${s.address}</div>
            <div class="card-info"><i class="fas fa-chair"></i> ${s.seats_available} מקומות</div>
            <button onclick="openEditSpaceModal(${s.space_id}, '${s.space_name}', '${s.address}', ${s.seats_available}, '${s.description || ''}')" class="btn-action btn-edit">
                <i class="fas fa-edit"></i> ערוך פרטים
            </button>
        </div>
    `).join('');
}

function openEditSpaceModal(id, name, address, seats, desc) {
    document.getElementById('edit-space-id').value = id;
    document.getElementById('edit-space-name').value = name;
    document.getElementById('edit-space-address').value = address;
    document.getElementById('edit-space-seats').value = seats;
    document.getElementById('edit-space-desc').value = desc;
    document.getElementById('editSpaceModal').style.display = 'block';
}

async function saveSpaceChanges() {
    const id = document.getElementById('edit-space-id').value;
    const body = {
        space_name: document.getElementById('edit-space-name').value,
        address: document.getElementById('edit-space-address').value,
        seats_available: document.getElementById('edit-space-seats').value,
        description: document.getElementById('edit-space-desc').value
    };

    const res = await fetch(`${API_URL}/spaces/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(body)
    });

    if (res.ok) {
        alert('המרחב עודכן בהצלחה');
        closeModal('editSpaceModal');
        loadManagedSpaces();
    } else {
        alert('שגיאה בעדכון המרחב');
    }
}

// --- לוח טיסות (Incoming Orders) ---
async function loadIncomingOrders() {
    const container = document.getElementById('flight-board-list');
    container.innerHTML = '<div class="loading">טוען לוח הזמנות...</div>';

    // קריאה לנתיב החדש שיצרנו ב-Backend
    const orders = await fetchData('/orders/incoming');

    if (!orders || orders.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-plane-slash" style="font-size:40px;"></i><p>אין הזמנות נכנסות בקרוב.</p></div>`;
        return;
    }

    const today = new Date().setHours(0,0,0,0);
    const tomorrow = new Date(today + 86400000).setHours(0,0,0,0);

    container.innerHTML = orders.map(order => {
        const orderDate = new Date(order.start_time).setHours(0,0,0,0);
        let statusClass = 'future';
        let badgeText = 'עתידי';
        let badgeClass = 'badge-future';

        if (orderDate === today) {
            statusClass = 'today';
            badgeText = 'היום';
            badgeClass = 'badge-today';
        } else if (orderDate === tomorrow) {
            statusClass = 'future'; // צהוב גם למחר
            badgeText = 'מחר';
        } else {
            badgeText = new Date(order.start_time).toLocaleDateString('he-IL');
        }

        const start = new Date(order.start_time).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
        const end = new Date(order.end_time).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});

        return `
        <div class="flight-card ${statusClass}">
            <div class="time-row">
                <span class="time">${start} - ${end}</span>
                <span class="badge-time ${badgeClass}">${badgeText}</span>
            </div>
            <h3 style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
                📍 ${order.space_name}
            </h3>
            <div class="details-row">👤 <strong>${order.first_name} ${order.last_name}</strong></div>
            <div class="details-row">📞 <a href="tel:${order.phone_number}" class="phone-link">${order.phone_number}</a></div>
            <div class="details-row">👥 ${order.attendees_count} משתתפים</div>
        </div>
        `;
    }).join('');
}

// ==========================================
// Helpers & Generators
// ==========================================
function createOrderCard(order) {
    const dateStr = new Date(order.start_time).toLocaleDateString('he-IL');
    const timeStart = new Date(order.start_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
    const timeEnd = new Date(order.end_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
    const canCancel = order.status !== 'declined';
    
    return `
    <div class="card">
        <h3>${order.space_name}</h3>
        <div class="card-info"><i class="far fa-calendar-alt"></i> ${dateStr}</div>
        <div class="card-info"><i class="far fa-clock"></i> ${timeStart} - ${timeEnd}</div>
        <div class="card-info"><i class="fas fa-map-marker-alt"></i> ${order.address}</div>
        <span class="status-badge status-${order.status}">${translateStatus(order.status)}</span>
        ${canCancel ? `<button onclick="confirmAction('ביטול הזמנה', 'האם לבטל?', () => cancelOrder(${order.order_id}))" class="btn-action btn-danger">ביטול הזמנה</button>` : ''}
    </div>`;
}

function createEventCard(event) {
    const dateStr = new Date(event.event_date).toLocaleDateString('he-IL');
    const start = event.start_hour.substring(0, 5);
    const end = event.finish_hour.substring(0, 5);
    
    return `
    <div class="card">
        <h3>${event.event_name}</h3>
        <div class="card-info"><i class="far fa-calendar-alt"></i> ${dateStr}</div>
        <div class="card-info"><i class="far fa-clock"></i> ${start} - ${end}</div>
        <div class="card-info"><i class="fas fa-map-marker-alt"></i> ${event.space_name}</div>
        <div class="card-info"><i class="fas fa-users"></i> קהילה: ${event.community_name}</div>
        <span class="status-badge status-${event.my_status}">${translateStatus(event.my_status)}</span>
        ${event.my_status === 'registered' ? `<button onclick="confirmAction('ביטול הרשמה', 'האם לבטל?', () => cancelEventRegistration(${event.event_id}))" class="btn-action btn-danger">ביטול הרשמה</button>` : ''}
    </div>`;
}

function createCommunityCard(c, isManagerMode) {
    return `
    <div class="card">
        <h3>${c.community_name}</h3>
        <div class="card-info"><i class="fas fa-tag"></i> ${c.main_subject || 'כללי'}</div>
        ${!isManagerMode ? `<div class="card-info"><i class="fas fa-id-badge"></i> תפקיד: <strong>${translateRole(c.my_role)}</strong></div>` : ''}
        ${isManagerMode ? 
            `<button onclick="openEditCommunityModal(${c.community_id}, '${c.community_name}', '${c.main_subject || ''}', '${c.image_url || ''}')" class="btn-action btn-edit"><i class="fas fa-edit"></i> ערוך פרטים</button>` 
            : ''}
    </div>`;
}

// --- Utils ---
async function fetchData(endpoint) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
        if (res.status === 401) { console.error("Token invalid"); return null; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) { console.error(err); return null; }
}

function getHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }; }
function setText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function translateUserType(type) { const m={regular:'משתמש פרטי', community_manager:'מנהל קהילה', space_manager:'מנהל מרחב', admin:'אדמין'}; return m[type]||type; }
function translateRole(role) { return role==='manager'?'מנהל':'חבר'; }
function translateStatus(s) { const m={approved:'מאושר', pending:'ממתין', canceled:'בוטל', declined:'נדחה', registered:'רשום'}; return m[s]||s; }

async function cancelOrder(id) { 
    if((await fetch(`${API_URL}/orders/${id}/cancel`, {method:'PATCH', headers:getHeaders()})).ok) { closeModal('confirmModal'); loadMyOrders(); } 
}
async function cancelEventRegistration(id) {
    if((await fetch(`${API_URL}/events/${id}/cancel`, {method:'PATCH', headers:getHeaders()})).ok) { closeModal('confirmModal'); loadMyEvents(); }
}

// Modal Handling
function closeModal(id) { document.getElementById(id).style.display = 'none'; currentActionCallback = null; }
function confirmAction(t, txt, cb) { document.getElementById('modalTitle').innerText=t; document.getElementById('modalText').innerText=txt; currentActionCallback=cb; document.getElementById('confirmModal').style.display='block'; }
document.getElementById('modalConfirmBtn').onclick = () => { if(currentActionCallback) currentActionCallback(); };
window.onclick = (e) => { if(e.target.classList.contains('modal')) e.target.style.display='none'; };