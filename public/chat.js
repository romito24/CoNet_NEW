const socket = io();

// קבלת הפרמטרים מה-URL
const urlParams = new URLSearchParams(window.location.search);
const communityId = urlParams.get('communityId');
const communityName = urlParams.get('name');
const fromTab = urlParams.get('from'); // my-communities / managed-communities

// אלמנטים
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const titleEl = document.getElementById('chat-title');
const backBtn = document.getElementById('backBtn');

//כפתור חזור לפרופיל לפי יציאה מטאב של מנהל קהילה או משתמש פרטי בקהילות שלי
if (backBtn) {
    backBtn.addEventListener('click', () => {
        if (fromTab === 'managed-communities') {
            window.location.href = '/profile?tab=managed-communities';
        } else {
            window.location.href = '/profile?tab=my-communities';
        }
    });
}

// פענוח טוקן
function getUserFromToken() {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) { return null; }
}

const currentUser = getUserFromToken();


if (!currentUser) {
    alert("אינך מחובר למערכת");
    window.location.href = '/login';
} else if (communityId) {
    titleEl.innerText = communityName ? communityName : `צ'אט קהילה ${communityId}`;

    socket.emit('join_community', communityId);
    fetchHistory();

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    socket.on('receive_message', (data) => {
        appendMessage(data);
    });
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const messageData = {
        communityId: communityId,
        userId: currentUser.user_id,
        userName: currentUser.first_name,
        message: text,
        created_at: new Date().toISOString() // הוספנו את הזמן הנוכחי לשליחה המיידית
    };

    socket.emit('send_message', messageData);
    messageInput.value = '';
}

// פונקציית עזר לבניית הודעה בפורמט
function formatMessageTime(dateString) {
    if (!dateString) return new Date().toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
    
    const msgDate = new Date(dateString);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    
    if (msgDate.toDateString() === now.toDateString()) {
        return msgDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    }
    
    if (msgDate.toDateString() === yesterday.toDateString()) {
        return 'אתמול';
    }
    // תאריך ישן יותר
    return msgDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// פונקציה מעודכנת להצגת ההודעה
function appendMessage(data) {
    // זיהוי אם זה אני
    const isMine = (data.userId == currentUser.user_id) || (data.user_id == currentUser.user_id);
    
    // שליפת שם ותוכן (תמיכה גם במידע מה-DB וגם מ-Socket)
    const name = data.user_name || data.userName || 'אורח';
    const content = data.message || data.message_text;
    const timeStr = formatMessageTime(data.created_at);
    
    
    const initial = name.charAt(0);

    const rowDiv = document.createElement('div');
    rowDiv.classList.add('message-row');
    rowDiv.classList.add(isMine ? 'mine' : 'others');

    
    rowDiv.innerHTML = `
        <div class="user-avatar">${initial}</div>
        <div class="message-bubble">
            ${!isMine ? `<div class="sender-name">${name}</div>` : ''}
            <div class="message-text">${content}</div>
            <div class="message-time">${timeStr}</div>
        </div>
    `;
    
    messagesContainer.appendChild(rowDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
