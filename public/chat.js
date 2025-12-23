const socket = io();

// קבלת הפרמטרים מה-URL
const urlParams = new URLSearchParams(window.location.search);
const communityId = urlParams.get('communityId');
const communityName = urlParams.get('name'); // אופציונלי: שם הקהילה לכותרת

// אלמנטים ב-DOM
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const titleEl = document.getElementById('chat-title');

// פענוח הטוקן כדי לדעת מי אני
function getUserFromToken() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
        // פענוח החלק האמצעי של ה-JWT
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

const currentUser = getUserFromToken();

// אתחול
if (!currentUser) {
    alert("אינך מחובר למערכת");
    window.location.href = '/login';
} else if (communityId) {
    
    // עדכון כותרת
    titleEl.innerText = communityName ? `צ'אט: ${communityName}` : `צ'אט קהילה ${communityId}`;

    // 1. חיבור לחדר
    socket.emit('join_community', communityId);

    // 2. טעינת היסטוריה
    fetchHistory();

    // 3. האזנה לכפתור שליחה
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // 4. האזנה להודעות חדשות בזמן אמת
    socket.on('receive_message', (data) => {
        appendMessage(data);
    });
}

// פונקציה לשליחת הודעה
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const messageData = {
        communityId: communityId,
        userId: currentUser.user_id, // שימי לב: השדה בטוקן הוא user_id
        userName: currentUser.first_name, 
        message: text
    };

    socket.emit('send_message', messageData);
    messageInput.value = '';
}

// פונקציה להוספת הודעה למסך
function appendMessage(data) {
    const div = document.createElement('div');
    div.classList.add('message');
    
    // זיהוי אם זה אני או מישהו אחר
    const isMine = (data.userId == currentUser.user_id) || (data.user_id == currentUser.user_id);
    div.classList.add(isMine ? 'mine' : 'others');

    // אם זה משתמש אחר, נציג את שמו
    let nameHtml = '';
    if (!isMine) {
        // תמיכה גם בשדה מה-DB וגם משליחה בזמן אמת
        const nameDisplay = data.user_name || data.userName || 'משתמש'; 
        nameHtml = `<span class="sender-name">${nameDisplay}</span>`;
    }

    // תמיכה גם בשדה message (socket) וגם message_text (db)
    const content = data.message || data.message_text;

    div.innerHTML = `${nameHtml}${content}`;
    
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight; // גלילה למטה
}

async function fetchHistory() {
    try {
        const res = await fetch(`/api/chat/history/${communityId}`);
        const messages = await res.json();
        messages.forEach(msg => appendMessage(msg));
    } catch (err) {
        console.error("Failed to load history", err);
    }
}