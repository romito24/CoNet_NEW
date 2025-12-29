const API_URL = '/api/events';

document.addEventListener('DOMContentLoaded', async () => {
    // ============================================================
    // חלק 1: טיפול בפרטי המרחב (הועבר מה-HTML)
    // ============================================================
    
    // 1. שליפת הנתונים מהכתובת (URL)
    const params = new URLSearchParams(window.location.search);
    
    const spaceId = params.get('spaceId');
    const spaceName = params.get('spaceName');
    const spaceAddress = params.get('spaceAddress');

    // 2. בדיקת תקינות ראשונית - אם אין מזהה מרחב, אין טעם להמשיך
    if (!spaceId) {
        alert("לא נבחר מרחב לאירוע. חוזר לחיפוש...");
        window.location.href = 'search.html';
        return; // עוצר את ריצת הסקריפט
    }

    // 3. הצגה של המידע בדף
    const nameEl = document.getElementById('spaceName');
    if (nameEl) {
        nameEl.innerText = spaceName || "לא נבחר מרחב";
    }

    const addrEl = document.getElementById('spaceAddress');
    if (addrEl) {
        addrEl.innerText = spaceAddress || "";
    }

    // 4. מילוי השדה הנסתר (כדי שיישלח בטופס או שיהיה זמין ב-JS)
    const spaceIdInput = document.getElementById('spaceId');
    if (spaceIdInput) {
        spaceIdInput.value = spaceId;
    }

    // ============================================================
    // חלק 2: טעינת נתונים והגדרת הטופס
    // ============================================================

    // 5. טעינת הקהילות שהמשתמש מנהל (עבור ה-Select)
    await loadManagedCommunities();

    // 6. האזנה לשליחת הטופס
    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventSubmit);
    }
});

// --- פונקציה לטעינת הקהילות ל-Dropdown ---
async function loadManagedCommunities() {
    const token = localStorage.getItem('token');
    const select = document.getElementById('communityId');
    
    if (!select) return; // הגנה למקרה שהאלמנט לא קיים

    if (!token) {
        // אופציונלי: אפשר להפנות ללוגין כבר כאן אם רוצים
        return;
    }

    try {
        // שים לב: וודאי שיש לך את ה-Route הזה בשרת שמחזיר קהילות בניהול המשתמש
        const response = await fetch('/api/communities/my-managing', { 
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const communities = await response.json();
            
            // איפוס ה-Select
            select.innerHTML = '<option value="" disabled selected>בחר קהילה...</option>';
            
            if (communities.length === 0) {
                const option = document.createElement('option');
                option.text = "אין לך קהילות בניהולך";
                select.appendChild(option);
                select.disabled = true;
                return;
            }

            // הוספת הקהילות לרשימה
            communities.forEach(c => {
                const option = document.createElement('option');
                option.value = c.community_id;
                option.text = c.community_name;
                select.appendChild(option);
            });
        } else {
            select.innerHTML = '<option value="" disabled>שגיאה בטעינת קהילות</option>';
            console.error('Failed to load communities');
        }
    } catch (error) {
        console.error('Error loading communities:', error);
        select.innerHTML = '<option value="" disabled>שגיאה בתקשורת</option>';
    }
}

// --- פונקציה לטיפול בשליחת הטופס ---
async function handleEventSubmit(e) {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
        alert('עליך להתחבר מחדש');
        window.location.href = 'login.html';
        return;
    }

    // 1. תפיסת הכפתור ושינוי המראה שלו (הוספת חיווי טעינה)
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML; // שומרים את הטקסט המקורי ("יצירת אירוע")

    // משנים ל"טוען..." ומוסיפים ספינר של בוטסטראפ, ונועלים את הכפתור
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> מעבד נתונים...';
    submitBtn.disabled = true; 

    // איסוף הנתונים
    const spaceId = document.getElementById('spaceId').value;
    const communityId = document.getElementById('communityId').value;
    const eventName = document.getElementById('eventName').value;
    const eventDate = document.getElementById('eventDate').value;
    const startHour = document.getElementById('startHour').value;
    const finishHour = document.getElementById('finishHour').value;
    const maxParticipants = document.getElementById('maxParticipants').value;

    // ולידציה
    if (!spaceId) {
        alert('שגיאה: חסר מזהה מרחב');
        resetButton(submitBtn, originalBtnText); // החזרת הכפתור למצב רגיל
        return;
    }
    if (!communityId) {
        alert('חובה לבחור קהילה עבור האירוע');
        resetButton(submitBtn, originalBtnText);
        return;
    }

    const payload = {
        event_name: eventName,
        event_date: eventDate,
        start_hour: startHour,
        finish_hour: finishHour,
        space_id: spaceId,
        community_id: communityId,
        max_participants: parseInt(maxParticipants) || 10
    };

    try {
        const response = await fetch(`${API_URL}/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            // אם הצליח - משנים לירוק או הודעה חיובית רגע לפני המעבר
            submitBtn.innerHTML = '✅ נוצר בהצלחה!';
            submitBtn.classList.remove('btn-primary'); // או המחלקה המקורית שלך
            submitBtn.classList.add('btn-success');
            
            setTimeout(() => {
                 alert('✅ האירוע נוצר בהצלחה!');
                 window.location.href = 'Holistic_profile.html'; 
            }, 100); // דילאיי ממש קצר כדי שהמשתמש יראה שהכפתור השתנה
            
        } else {
            alert(`שגיאה ביצירת האירוע: ${data.message || 'נסה שנית מאוחר יותר'}`);
            resetButton(submitBtn, originalBtnText); // החזרת הכפתור למצב רגיל במקרה שגיאה
        }

    } catch (error) {
        console.error('Error creating event:', error);
        alert('שגיאה בתקשורת עם השרת');
        resetButton(submitBtn, originalBtnText); // החזרת הכפתור למצב רגיל במקרה שגיאה
    }
}

// פונקציית עזר להחזרת הכפתור לקדמותו (למקרה של שגיאה)
function resetButton(btn, originalText) {
    btn.innerHTML = originalText;
    btn.disabled = false;
}