const API_URL = "/api";

// --- ניהול משתנים גלובליים ---
let currentUser = null;
let currentActionCallback = null;

// --- אתחול בעת טעינת הדף ---
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    
    // בדיקה אם המשתמש מחובר
    if (!token) {
        // במצב רגיל היינו שולחים ל-login, אבל בבדיקות כרגע נשאיר הודעה בקונסול
        console.warn("No token found. Please inject token via Developer Tools.");
        // window.location.href = 'login.html'; 
        return;
    }

    try {
        await loadUserDetails(); // טעינת פרטי משתמש (הכרחי לכותרת)
        switchTab('my-orders'); // טאב ברירת מחדל
    } catch (error) {
        console.error("Auth failed", error);
        logout();
    }
});

// --- פונקציות ניווט ומערכת ---
function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html'; // אפשר לשנות לדף אחר אם אין login.html כרגע
}

function switchTab(tabId) {
    // עדכון כפתורים
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${tabId}`).classList.add('active');

    // עדכון תוכן
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active-content'));
    document.getElementById(tabId).classList.add('active-content');

    // טעינת מידע לפי הטאב
    if (tabId === 'my-orders') loadMyOrders();
    if (tabId === 'my-events') loadMyEvents();
    if (tabId === 'my-communities') loadMyCommunities();
    // personal-details כבר נטען בהתחלה
}

// ==========================================
// 1. פרטים אישיים (GET /auth/me)
// ==========================================
async function loadUserDetails() {
    const user = await fetchData('/auth/me');
    if (!user) return; // FetchData כבר מטפל בשגיאות

    currentUser = user;
    
    // עדכון Navbar
    document.getElementById('nav-username').innerText = `שלום, ${user.first_name}`;

    // מילוי טאב פרטים אישיים
    setText('detail-name', `${user.first_name} ${user.last_name}`);
    setText('detail-email', user.email);
    setText('detail-phone', user.phone_number || '-');
    setText('detail-type', translateUserType(user.user_type));
    
    // אם יש תאריך הרשמה (לא תמיד חוזר, תלוי ב-SELECT, שמנו אופציונלי)
    if (user.registration_date) {
        setText('detail-date', new Date(user.registration_date).toLocaleDateString('he-IL'));
    }
}

// ==========================================
// 2. ההזמנות שלי (GET /orders/my-orders)
// ==========================================
async function loadMyOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="loading">טוען הזמנות...</div>';

    const orders = await fetchData('/orders/my-orders');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <i class="fas fa-calendar-times" style="font-size: 40px; margin-bottom: 10px;"></i>
            <p>עדיין לא ביצעת הזמנות למרחבים.</p>
        </div>`;
        return;
    }

    container.innerHTML = orders.map(order => {
        const dateStr = new Date(order.start_time).toLocaleDateString('he-IL');
        const timeStart = new Date(order.start_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
        const timeEnd = new Date(order.end_time).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
        const canCancel = order.status !== 'canceled' && order.status !== 'declined';

        return `
        <div class="card">
            <h3>${order.space_name}</h3>
            <div class="card-info"><i class="far fa-calendar-alt"></i> ${dateStr}</div>
            <div class="card-info"><i class="far fa-clock"></i> ${timeStart} - ${timeEnd}</div>
            <div class="card-info"><i class="fas fa-map-marker-alt"></i> ${order.address}</div>
            
            <span class="status-badge status-${order.status}">${translateStatus(order.status)}</span>
            
            ${canCancel ? 
                `<button onclick="confirmAction('ביטול הזמנה', 'האם לבטל את ההזמנה?', () => cancelOrder(${order.order_id}))" class="btn-action btn-danger">
                    ביטול הזמנה
                </button>` : ''
            }
        </div>
        `;
    }).join('');
}

async function cancelOrder(orderId) {
    const res = await fetch(`${API_URL}/orders/${orderId}/cancel`, {
        method: 'PATCH',
        headers: getHeaders()
    });

    if (res.ok) {
        closeModal();
        loadMyOrders(); // ריענון
    } else {
        alert('שגיאה בביטול ההזמנה');
    }
}

// ==========================================
// 3. האירועים שלי (GET /events/my-events)
// ==========================================
async function loadMyEvents() {
    const container = document.getElementById('events-list');
    container.innerHTML = '<div class="loading">טוען אירועים...</div>';

    const events = await fetchData('/events/my-events');

    if (!events || events.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <i class="fas fa-ticket-alt" style="font-size: 40px; margin-bottom: 10px;"></i>
            <p>לא נרשמת לאירועים עדיין.</p>
        </div>`;
        return;
    }

    container.innerHTML = events.map(event => {
        const dateStr = new Date(event.event_date).toLocaleDateString('he-IL');
        const start = event.start_hour.substring(0, 5); 
        const end = event.finish_hour.substring(0, 5);
        const canCancel = event.my_status === 'registered';

        return `
        <div class="card">
            <h3>${event.event_name}</h3>
            <div class="card-info"><i class="far fa-calendar-alt"></i> ${dateStr}</div>
            <div class="card-info"><i class="far fa-clock"></i> ${start} - ${end}</div>
            <div class="card-info"><i class="fas fa-map-marker-alt"></i> ${event.space_name}</div>
            <div class="card-info"><i class="fas fa-users"></i> קהילה: ${event.community_name}</div>

            <span class="status-badge status-${event.my_status}">${translateStatus(event.my_status)}</span>

            ${canCancel ? 
                `<button onclick="confirmAction('ביטול הרשמה', 'האם לבטל את ההרשמה לאירוע?', () => cancelEventRegistration(${event.event_id}))" class="btn-action btn-danger">
                    ביטול הרשמה
                </button>` : ''
            }
        </div>
        `;
    }).join('');
}

async function cancelEventRegistration(eventId) {
    const res = await fetch(`${API_URL}/events/${eventId}/cancel`, {
        method: 'PATCH',
        headers: getHeaders()
    });

    if (res.ok) {
        closeModal();
        loadMyEvents(); // ריענון
    } else {
        alert('שגיאה בביטול ההרשמה');
    }
}

// ==========================================
// 4. הקהילות שלי (GET /communities/my-communities)
// ==========================================
async function loadMyCommunities() {
    const container = document.getElementById('communities-list');
    container.innerHTML = '<div class="loading">טוען קהילות...</div>';

    const communities = await fetchData('/communities/my-communities');

    if (!communities || communities.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <i class="fas fa-users-slash" style="font-size: 40px; margin-bottom: 10px;"></i>
            <p>אינך חבר באף קהילה כרגע.</p>
        </div>`;
        return;
    }

    container.innerHTML = communities.map(c => `
        <div class="card">
            <h3>${c.community_name}</h3>
            <div class="card-info">
                <i class="fas fa-tag"></i> ${c.main_subject || 'כללי'}
            </div>
            <div class="card-info">
                <i class="fas fa-id-badge"></i> תפקיד: <strong>${translateRole(c.my_role)}</strong>
            </div>
            ${c.image_url ? `<img src="${c.image_url}" alt="Community" style="width:100%; height:120px; object-fit:cover; border-radius:8px; margin-top:10px;">` : ''}
        </div>
    `).join('');
}

// ==========================================
// פונקציות עזר (Utils)
// ==========================================

async function fetchData(endpoint) {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            headers: getHeaders()
        });
        
        if (res.status === 401 || res.status === 403) {
            console.error("Token invalid or expired");
            // logout(); // מבוטל זמנית לצורך בדיקות
            return null;
        }
        
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error(`Fetch error for ${endpoint}:`, err);
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

function translateUserType(type) {
    const map = {
        'regular': 'משתמש פרטי',
        'community_manager': 'מנהל קהילה',
        'space_manager': 'מנהל מרחב',
        'admin': 'אדמין'
    };
    return map[type] || type;
}

function translateRole(role) {
    return role === 'manager' ? 'מנהל' : 'חבר';
}

function translateStatus(status) {
    const map = {
        'approved': 'מאושר',
        'pending': 'ממתין',
        'canceled': 'בוטל',
        'declined': 'נדחה',
        'registered': 'רשום',
        'attended': 'השתתף'
    };
    return map[status] || status;
}

// --- ניהול מודאל (חלון קופץ) ---
function confirmAction(title, text, action) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalText').innerText = text;
    currentActionCallback = action;
    document.getElementById('confirmModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('confirmModal').style.display = 'none';
    currentActionCallback = null;
}

// סגירה בלחיצה על "אישור"
document.getElementById('modalConfirmBtn').onclick = () => {
    if (currentActionCallback) currentActionCallback();
};

// סגירה בלחיצה מחוץ למודאל
window.onclick = function(event) {
    const modal = document.getElementById('confirmModal');
    if (event.target == modal) {
        closeModal();
    }
}