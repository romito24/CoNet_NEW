
console.log("✅ Holistic Profile JS Loaded Successfully");

const API_URL = '/api';

let currentUser = null;
let currentActionCallback = null;


document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 DOM Content Loaded");
    
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn("⚠️ No token found via localStorage. Redirecting to login.");
        window.location.href = 'login';
        return;
    }

    try {
        await loadUserDetails();
        
        const params = new URLSearchParams(window.location.search);
        const tabFromUrl = params.get('tab');
        switchTab(tabFromUrl || 'my-orders');

    } catch (error) {
        console.error("❌ Auth failed in initialization:", error);
    }
});

// טעינת פרטי משתמש
async function loadUserDetails() {
    let user = null;

    const serverUser = await fetchData('/auth/me');
    if (serverUser) {
        user = serverUser;
        localStorage.setItem('user', JSON.stringify(user));
    } else {
        console.warn("⚠️ Failed to fetch from server, trying LocalStorage fallback");
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                user = JSON.parse(storedUser);
            } catch (e) {
                console.error("⚠️ Error parsing user from storage", e);
            }
        }
    }

    if (!user) {
        throw new Error("Could not load user details (User object is null)");
    }

    currentUser = user;

    const navName = document.getElementById('nav-username');
    if (navName) navName.innerText = `שלום, ${user.first_name}`;

    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    setText('detail-name', fullName);
    setText('detail-email', user.email);
    setText('detail-phone', user.phone_number || '-');
    setText('detail-type', translateUserType(user.user_type));
    if (user.registration_date) {
        setText('detail-date', new Date(user.registration_date).toLocaleDateString('he-IL'));
    }

    console.log("🔑 User Type:", user.user_type);
    
    if (user.user_type === 'community_manager') {
        showElement('btn-managed-communities');
        showElement('btn-event-orders');
    }
    if (user.user_type === 'space_manager') {
        showElement('btn-managed-spaces');
        showElement('btn-incoming-orders');
    }
    if (user.user_type === 'admin') {
        showElement('btn-managed-communities');
        showElement('btn-managed-spaces');
        showElement('btn-incoming-orders');
        showElement('btn-event-orders');
    }
}

// --- ניווט ---
function switchTab(tabId) {
    console.log("Tab switched to:", tabId);
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active-content'));

    const btn = document.getElementById(`btn-${tabId}`);
    const content = document.getElementById(tabId);
    
    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active-content');

    if (tabId === 'my-orders') loadMyOrders();
    if (tabId === 'event-orders') loadEventOrders();
    if (tabId === 'my-events') loadMyEvents();
    if (tabId === 'my-communities') loadMyCommunities();
    if (tabId === 'managed-communities') loadManagedCommunities();
    if (tabId === 'managed-spaces') loadManagedSpaces();
    if (tabId === 'incoming-orders') loadIncomingOrders();
}

function logout() {
    console.log("👋 Logging out...");
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login';
}


// פונקציות טעינת נתונים

async function loadMyOrders() {
    const container = document.getElementById('orders-list');
    if(!container) return;
    container.innerHTML = '<div class="loading">טוען הזמנות...</div>';
    
    const orders = await fetchData('/orders/my-orders');
    const privateOrders = orders ? orders.filter(order => order.status !== 'canceled' && !order.event_id) : [];

    if (privateOrders.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-times" style="font-size:40px; margin-bottom:10px;"></i><p>אין הזמנות פעילות.</p></div>`;
        return;
    }
    container.innerHTML = privateOrders.map(order => createOrderCard(order)).join('');
}

async function loadEventOrders() {
    const container = document.getElementById('event-orders-list');
    if(!container) return;
    container.innerHTML = '<div class="loading">טוען הזמנות לאירועים...</div>';
    
    const orders = await fetchData('/orders/my-orders'); 
    
    const eventOrders = orders ? orders.filter(order => order.status !== 'canceled' && order.event_id) : [];

    if (eventOrders.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-ticket-alt" style="font-size:40px; margin-bottom:10px;"></i><p>עדיין לא יצרת אירועים.</p></div>`;
        return;
    }
    container.innerHTML = eventOrders.map(order => createOrderCard(order, true)).join('');
}

async function loadMyEvents() {
    const container = document.getElementById('events-list');
    if(!container) return;
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
    if(!container) return;
    container.innerHTML = '<div class="loading">טוען קהילות...</div>';
    
    const communities = await fetchData('/communities/my-communities');
    if (!communities || communities.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-users-slash" style="font-size:40px; margin-bottom:10px;"></i><p>אינך חבר בקהילות.</p></div>`;
        return;
    }
    container.innerHTML = communities.map(c => createCommunityCard(c, false)).join('');
}

// קהילות בניהולי

async function loadManagedCommunities() {
    const container = document.getElementById('managed-communities-list');
    if(!container) return;
    
    const createBtnHtml = `
        <div style="width: 100%; text-align: right; margin-bottom: 20px;">
            <button onclick="window.location.href='add_community'" class="auth-btn">
                <i class="fas fa-plus"></i> יצירת קהילה חדשה
            </button>
        </div>
    `;

    container.innerHTML = '<div class="loading">טוען קהילות בניהולך...</div>';
    
    const communities = await fetchData('/communities/my-managing');
    
    if (!communities || communities.length === 0) {
        container.innerHTML = `
            ${createBtnHtml}
            <div class="empty-state"><p>אינך מנהל קהילות כרגע.</p></div>
        `;
        return;
    }

    const listHtml = communities.map(c => createCommunityCard(c, true)).join('');
    container.innerHTML = createBtnHtml + listHtml;
}

// מרחבים בניהולי
async function loadManagedSpaces() {
    const container = document.getElementById('managed-spaces-list');
    if(!container) return;

    // כפתור יצירת מרחב חדש
    const createBtnHtml = `
        <div style="width: 100%; text-align: right; margin-bottom: 20px;">
            <button onclick="window.location.href='add_space'" class="auth-btn">
                <i class="fas fa-plus"></i> יצירת מרחב חדש
            </button>
        </div>
    `;

    container.innerHTML = '<div class="loading">טוען מרחבים בניהולך...</div>';
    
    const spaces = await fetchData('/spaces/my-managing');
    
    // במידה ולא קיימים מרחבים
    if (!spaces || spaces.length === 0) {
        container.innerHTML = `
            ${createBtnHtml}
            <div class="empty-state"><p>אינך מנהל מרחבים כרגע. זה הזמן להוסיף את המרחב הראשון שלך!</p></div>
        `;
        return;
    }

    // במידה וקיימים כבר מרחבים
    const listHtml = spaces.map(s => {
        const safeName = s.space_name.replace(/'/g, "\\'");
        const safeAddress = s.address ? s.address.replace(/'/g, "\\'") : '';
        const safeDesc = s.description 
            ? s.description.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "") 
            : '';

        return `
        <div class="card">
            <h3>${s.space_name}</h3>
            <div class="card-info"><i class="fas fa-map-marker-alt"></i> ${s.address}</div>
            <div class="card-info"><i class="fas fa-chair"></i> ${s.seats_available} מקומות</div>
            <button onclick="openEditSpaceModal(${s.space_id}, '${safeName}', '${safeAddress}', ${s.seats_available}, '${safeDesc}')" class="btn-secondary">
                <i class="fas fa-edit"></i> ערוך פרטים
            </button>
        </div>
        `;
    }).join('');

    container.innerHTML = createBtnHtml + listHtml;
}

async function loadIncomingOrders() {
    const container = document.getElementById('flight-board-list');
    if(!container) return;
    container.innerHTML = '<div class="loading">טוען לוח הזמנות...</div>';

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
            statusClass = 'future';
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


function createOrderCard(order, isEvent = false) { 
    const dateStr = new Date(order.start_time).toLocaleDateString('he-IL');
    const timeStart = new Date(order.start_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
    const timeEnd = new Date(order.end_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
    const canCancel = order.status !== 'declined';
    const title = isEvent && order.event_name ? `🎉 ${order.event_name}` : order.space_name;
    const subTitle = isEvent ? `<div class="card-info"><i class="fas fa-map-marker-alt"></i> במרחב: ${order.space_name}</div>` : '';
    
    return `
    <div class="card">
        <h3>${title}</h3>
        ${subTitle}
        <div class="card-info"><i class="far fa-calendar-alt"></i> ${dateStr}</div>
        <div class="card-info"><i class="far fa-clock"></i> ${timeStart} - ${timeEnd}</div>
        <div class="card-info"><i class="fas fa-map-marker-alt"></i> ${order.address}</div>
        <div class="card-info"><i class="fas fa-users"></i> כמות משתתפים: ${order.attendees_count}</div>
        <span class="status-badge status-${order.status}">${translateStatus(order.status)}</span>
        ${canCancel ? `<button onclick="confirmAction('ביטול הזמנה', 'האם לבטל?', () => cancelOrder(${order.order_id}))" class="btn-danger">ביטול הזמנה</button>` : ''}
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

    const fromTab = isManagerMode ? 'managed-communities' : 'my-communities';
    
    return `
    <div class="card">
        <h3>${c.community_name}</h3>
        <div class="card-info"><i class="fas fa-tag"></i> ${c.main_subject || 'כללי'}</div>
        ${!isManagerMode ? `<div class="card-info"><i class="fas fa-id-badge"></i> תפקיד: <strong>${translateRole(c.my_role)}</strong></div>` : ''}
        
            <button onclick="navigateToChat(${c.community_id}, '${c.community_name}', '${fromTab}')" class="btn-primary">
                <i class="fas fa-comments"></i> כניסה לצ'אט
            </button>

        ${isManagerMode ? 
            `<button onclick="openEditCommunityModal(${c.community_id}, '${c.community_name}', '${c.main_subject || ''}', '${c.image_url || ''}')" class="btn-secondary"><i class="fas fa-edit"></i> ערוך פרטים</button>` 
            : ''}
    </div>`;
}

async function fetchData(endpoint) {
    try {
        console.log(`📡 Fetching: ${endpoint}`);
        const res = await fetch(`${API_URL}${endpoint}`, { headers: getHeaders() });
        if (res.status === 401) { 
            console.error("Token invalid or expired"); 
            return null; 
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) { 
        console.error(err); 
        return null; 
    }
}

function getHeaders() { 
    return { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${localStorage.getItem('token')}` 
    }; 
}

function setText(id, text) { 
    const el = document.getElementById(id); 
    if (el) el.innerText = text; 
}

function showElement(id) {
    const el = document.getElementById(id);
    if(el) el.style.display = 'flex';
}

function translateUserType(type) { 
    const m={regular:'משתמש פרטי', community_manager:'מנהל קהילה', space_manager:'מנהל מרחב', admin:'אדמין'}; 
    return m[type]||type; 
}
function translateRole(role) { return role==='manager'?'מנהל':'חבר'; }
function translateStatus(s) { const m={approved:'מאושר', pending:'ממתין', canceled:'בוטל', declined:'נדחה', registered:'רשום'}; return m[s]||s; }

// פעולות לביצוע

async function cancelOrder(id) { 
    if((await fetch(`${API_URL}/orders/${id}/cancel`, {method:'PATCH', headers:getHeaders()})).ok) { 
        closeModal('confirmModal'); 
        loadMyOrders(); 
    } 
}
async function cancelEventRegistration(id) {
    if((await fetch(`${API_URL}/events/${id}/cancel`, {method:'PATCH', headers:getHeaders()})).ok) { 
        closeModal('confirmModal'); 
        loadMyEvents(); 
    } 
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; currentActionCallback = null; }
function confirmAction(t, txt, cb) { 
    document.getElementById('modalTitle').innerText=t; 
    document.getElementById('modalText').innerText=txt; 
    currentActionCallback=cb; 
    document.getElementById('confirmModal').style.display='block'; 
}
const confirmBtn = document.getElementById('modalConfirmBtn');
if(confirmBtn) {
    confirmBtn.onclick = () => { if(currentActionCallback) currentActionCallback(); };
}

window.onclick = (e) => { if(e.target.classList.contains('modal')) e.target.style.display='none'; };

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
        loadManagedCommunities();
    } else {
        alert('שגיאה בעדכון הקהילה');
    }
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

function navigateToChat(communityId, communityName, fromTab) {
    window.location.href = `/chat?communityId=${communityId}&name=${encodeURIComponent(communityName)}&from=${fromTab}`;
}



