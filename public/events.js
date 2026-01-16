const API_URL = '/api';
let allEvents = []; // שמירת כל האירועים לסינון מקומי

// בעת טעינת הדף
document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
});

// טעינת אירועים מהשרת
async function loadEvents() {
    const loader = document.getElementById('loading');
    const grid = document.getElementById('events-grid');
    
    try {
        const response = await fetch(`${API_URL}/events/all`);
        if (!response.ok) throw new Error('Failed to fetch events');
        
        allEvents = await response.json();
        loader.style.display = 'none';
        
        renderEvents(allEvents);

    } catch (error) {
        console.error('Error:', error);
        loader.innerText = 'שגיאה בטעינת האירועים. נסה שנית מאוחר יותר.';
    }
}

// הצגת האירועים על המסך
function renderEvents(eventsToRender) {
    const grid = document.getElementById('events-grid');
    const noResults = document.getElementById('no-results');
    
    grid.innerHTML = ''; // ניקוי

    if (eventsToRender.length === 0) {
        noResults.style.display = 'block';
        return;
    }
    noResults.style.display = 'none';

    eventsToRender.forEach(event => {
        // המרת תאריך לפורמט קריא
        const dateObj = new Date(event.event_date);
        const dateStr = dateObj.toLocaleDateString('he-IL');
        const timeStr = event.start_hour.substring(0, 5); // הסרת שניות

        // תמונת ברירת מחדל אם אין לקהילה תמונה
        const imageUrl = event.community_image || 'https://via.placeholder.com/300x160?text=CoNet+Event';

        // יצירת האירוע
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="card-image" style="background-image: url('${imageUrl}')">
                <span class="community-badge">${event.community_name}</span>
            </div>
            <div class="card-content">
                <h3>${event.event_name}</h3>
                <div class="info-row">📅 ${dateStr} | ⏰ ${timeStr}</div>
                <div class="info-row">📍 ${event.address || event.space_name}</div>
                
                <div class="participants-count">
                    👥 רשומים: ${event.current_participants} 
                    ${event.max_participants ? `/ ${event.max_participants}` : ''}
                </div>

                <button class="register-btn" onclick="handleRegistration(this, ${event.event_id}, '${event.event_name}')">
                    הרשמה לאירוע
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// טיפול בלחיצה על הרשמה
async function handleRegistration(btnElement, eventId, eventName) {
    // שליפת הטוקן
    const token = localStorage.getItem('token'); 

    // בדיקה ראשונה אם משתמש לא מחובר
    if (!token) {
        alert('עליך להתחבר למערכת כדי להירשם לאירוע.');
        window.location.href = 'login';
        return;
    }

    // מצב טעינה של כפתור הרשמה
    const originalText = btnElement.innerHTML; 
    btnElement.innerHTML = 'מבצע הרשמה...'; 
    btnElement.disabled = true; 
    btnElement.style.opacity = '0.7'; 

    // בדיקה שנייה אם משתמש מחובר ומנסה לבצע הרשמה מול השרת
    try {
        const response = await fetch(`${API_URL}/events/${eventId}/register`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            // הצלחה (201)
            btnElement.innerHTML = '✅ נרשמת!';
            btnElement.style.backgroundColor = 'var(--accent-green)';

        setTimeout(() => {
                alert(`נרשמת בהצלחה לאירוע "${eventName}"! נשלח אליך אישור במייל.`);
                loadEvents(); 
            }, 100);
        }
        else if (response.status === 403) {
            resetButton(btnElement, originalText);
            if (confirm(data.message + "\n\nהאם תרצה לעבור לדף הקהילות כעת?")) {
                window.location.href = '/communities'; 
            }
        } 
        else if (response.status === 409) {
            // אירוע מלא או כבר רשום
            resetButton(btnElement, originalText);
            alert(data.message);
        } 
        else {
            resetButton(btnElement, originalText);
            alert('שגיאה: ' + data.message);
        }

    } catch (error) {
        console.error('Registration error:', error);
        resetButton(btnElement, originalText);
        alert('אירעה שגיאה בתקשורת עם השרת.');
    }
}

function resetButton(btn, originalText) {
    btn.innerHTML = originalText;
    btn.disabled = false;
    btn.style.opacity = '1';
}

// אפשרויות פילטור
function filterEvents() {
    const searchText = document.getElementById('search-input').value.toLowerCase();
    const dateValue = document.getElementById('date-input').value;

    const filtered = allEvents.filter(event => {
        // חיפוש טקסט בשם האירוע או בשם הקהילה
        const matchText = event.event_name.toLowerCase().includes(searchText) || 
                          event.community_name.toLowerCase().includes(searchText);
        
        // סינון תאריך (אם נבחר)
        let matchDate = true;
        if (dateValue) {
            const selectedDate = new Date(dateValue);
            const eventDate = new Date(event.event_date);
        
            matchDate =
                eventDate.getFullYear() === selectedDate.getFullYear() &&
                eventDate.getMonth() === selectedDate.getMonth() &&
                eventDate.getDate() === selectedDate.getDate();
        }

        return matchText && matchDate;
    });

    renderEvents(filtered);
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('date-input').value = '';
    renderEvents(allEvents);
}
