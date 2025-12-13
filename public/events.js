const API_URL = '/api';
let allEvents = []; // שמירת כל האירועים לסינון מקומי

// בעת טעינת הדף
document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
});

// 1. טעינת אירועים מהשרת
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

// 2. הצגת האירועים על המסך
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

        // יצירת הכרטיס
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

                <button class="register-btn" onclick="handleRegistration(${event.event_id}, '${event.event_name}')">
                    הרשמה לאירוע
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// 3. טיפול בלחיצה על הרשמה (הלוגיקה המורכבת)
async function handleRegistration(eventId, eventName) {
    // שליפת הטוקן (הנחה: הטוקן נשמר ב-localStorage בעת התחברות)
    const token = localStorage.getItem('token'); 

    // תנאי 1: משתמש לא מחובר
    if (!token) {
        // שמירת ה-URL הנוכחי או ה-ID כדי לחזור אליו אחרי התחברות (אופציונלי)
        alert('עליך להתחבר למערכת כדי להירשם לאירוע.');
        window.location.href = 'login.html'; // הפניה לדף התחברות (טרם מומש)
        return;
    }

    // תנאי 2: משתמש מחובר - ניסיון הרשמה מול השרת
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
            alert(`נרשמת בהצלחה לאירוע "${eventName}"! נשלח אליך אישור במייל.`);
            loadEvents(); // רענון הדף לעדכון מונה המשתתפים
        } 
        else if (response.status === 403) {
            // תנאי 3: לא חבר בקהילה (הודעת שגיאה ספציפית מהשרת)
            // ההודעה מהשרת היא: "על מנת שנוכל לאשר את הגעתך עליך להירשם לקהילה"
            if (confirm(data.message + "\n\n על מנת שנוכל לאשר את הגעתך עליך להירשם לקהילה ")) {
                window.location.href = 'join-community.html'; // דף שטרם מומש
            }
        } 
        else if (response.status === 409) {
            // אירוע מלא או כבר רשום
            alert(data.message);
        } 
        else {
            alert('שגיאה: ' + data.message);
        }

    } catch (error) {
        console.error('Registration error:', error);
        alert('אירעה שגיאה בתקשורת עם השרת.');
    }
}

// 4. פונקציות פילטור
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
            // המרת התאריך מה-DB לפורמט YYYY-MM-DD להשוואה
            const eventDateStr = new Date(event.event_date).toISOString().split('T')[0];
            matchDate = eventDateStr === dateValue;
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