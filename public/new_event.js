const API_URL = '/api/events';

document.addEventListener('DOMContentLoaded', async () => {
    
    // טיפול בפרטי המרחב 

    // שליפת נתונים על המרחב עצמו
    const params = new URLSearchParams(window.location.search);
    
    const spaceId = params.get('spaceId');
    const spaceName = params.get('spaceName');
    const spaceAddress = params.get('spaceAddress');

    // 2. בדיקת תקינות ראשונית - אם אין מזהה מרחב, עוצר
    if (!spaceId) {
        alert("לא נבחר מרחב לאירוע. חוזר לחיפוש...");
        window.location.href = 'search.html';
        return; 
    }

    // הצגה של המידע בדף
    const nameEl = document.getElementById('spaceName');
    if (nameEl) {
        nameEl.innerText = spaceName || "לא נבחר מרחב";
    }

    const addrEl = document.getElementById('spaceAddress');
    if (addrEl) {
        addrEl.innerText = spaceAddress || "";
    }

    
    const spaceIdInput = document.getElementById('spaceId');
    if (spaceIdInput) {
        spaceIdInput.value = spaceId;
    }

    
    // טעינת נתונים והגדרת הטופס
    

    // טעינת הקהילות שהמשתמש מנהל
    await loadManagedCommunities();

    // שליחת הטופס
    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventSubmit);
    }
});

// טעינה והצגת הקהילות
async function loadManagedCommunities() {
    const token = localStorage.getItem('token');
    const select = document.getElementById('communityId');
    
    if (!select) return; 

    if (!token) {
        
        return;
    }

    try {
        
        const response = await fetch('/api/communities/my-managing', { 
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const communities = await response.json();
            
            
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

// פונקציה לטיפול בשליחת הטופס
async function handleEventSubmit(e) {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (!token) {
        alert('עליך להתחבר מחדש');
        window.location.href = 'login.html';
        return;
    }

    
    const submitBtn = document.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML; 

    
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> מעבד נתונים...';
    submitBtn.disabled = true; 

    
    const spaceId = document.getElementById('spaceId').value;
    const communityId = document.getElementById('communityId').value;
    const eventName = document.getElementById('eventName').value;
    const eventDate = document.getElementById('eventDate').value;
    const startHour = document.getElementById('startHour').value;
    const finishHour = document.getElementById('finishHour').value;
    const maxParticipants = document.getElementById('maxParticipants').value;

    
    if (!spaceId) {
        alert('שגיאה: חסר מזהה מרחב');
        resetButton(submitBtn, originalBtnText); 
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
            submitBtn.classList.remove('btn-primary');
            submitBtn.classList.add('btn-success');
            
            setTimeout(() => {
                 alert('✅ האירוע נוצר בהצלחה!');
                 window.location.href = 'profile'; 
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
