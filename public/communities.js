const API_URL = '/api';
let allCommunities = []; // שמירה מקומית

document.addEventListener('DOMContentLoaded', () => {
    loadCommunities();
});

// 1. שליפת כל הקהילות
async function loadCommunities() {
    const loader = document.getElementById('loading');
    
    try {
        const response = await fetch(`${API_URL}/communities/all`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        allCommunities = await response.json();
        
        loader.style.display = 'none';
        renderCommunities(allCommunities);

    } catch (error) {
        console.error('Error loading communities:', error);
        loader.innerText = 'שגיאה בטעינת הקהילות.';
    }
}

// 2. הצגת הכרטיסים
function renderCommunities(communities) {
    const grid = document.getElementById('communities-grid');
    const noResults = document.getElementById('no-results');
    
    grid.innerHTML = '';

    if (communities.length === 0) {
        noResults.style.display = 'block';
        return;
    }
    noResults.style.display = 'none';

    communities.forEach(comm => {
        // עיבוד תאריך הקמה
        let dateStr = 'לא צוין';
        if (comm.establishment_date) {
            const dateObj = new Date(comm.establishment_date);
            dateStr = dateObj.toLocaleDateString('he-IL');
        }

        const image = comm.image_url || 'https://via.placeholder.com/300x180?text=Community';

        const card = document.createElement('div');
        card.className = 'community-card';
        card.innerHTML = `
            <div class="card-image" style="background-image: url('${image}')"></div>
            <div class="card-content">
                <h3>${comm.community_name}</h3>
                <div class="subject">נושא: ${comm.main_subject || 'כללי'}</div>
                <div class="est-date">נוסדה ב: ${dateStr}</div>

                    <button class="join-btn" onclick="handleJoin(${comm.community_id}, '${comm.community_name}')">
                        הצטרפות לקהילה
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ==========================================
//  פונקציית עזר לבדיקת תוקף הטוקן
// ==========================================
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) return false; // אין טוקן בכלל

    try {
        // פיענוח ה-Payload של הטוקן (החלק האמצעי)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000); // הזמן הנוכחי בשניות
        
        // בדיקה: האם זמן התפוגה (exp) עבר?
        if (payload.exp && payload.exp < now) {
            localStorage.removeItem('token'); // הטוקן פג תוקף - נמחק אותו
            return false;
        }
        return true; // הטוקן תקין ובתוקף
    } catch (e) {
        console.error("Invalid token format", e);
        return false; // הטוקן שבור
    }
}

// 3. לוגיקת הצטרפות
    async function handleJoin(communityId, communityName) {
    
    // שינוי: שימוש בבדיקה החכמה במקום רק בדיקת קיום טוקן
    if (!checkAuth()) {
        if(confirm("עליך להתחבר למערכת כדי להצטרף לקהילה. לעבור לדף התחברות?")) {
            // בונוס: שמירת הכתובת הנוכחית כדי לחזור לפה אחרי הלוגין
            localStorage.setItem('returnUrl', window.location.href);
            window.location.href = 'login.html'; 
        }
        return;
    }

    // אם עברנו את הבדיקה, הטוקן בטוח קיים ותקין
    const token = localStorage.getItem('token'); 

    try {
        const response = await fetch(`${API_URL}/communities/join`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ community_id: communityId })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`ברכות! הצטרפת בהצלחה לקהילת "${communityName}".`);
        } 
        else if (response.status === 409) {
            alert(`אתה כבר חבר בקהילה זו.`);
        } 
        else {
            alert('שגיאה: ' + (data.message || 'תקלה בהצטרפות'));
        }

    } catch (error) {
        console.error('Join request failed:', error);
        alert('שגיאת תקשורת עם השרת.');
    }
}

// 4. פילטור קהילות
function filterCommunities() {
    const searchText = document.getElementById('search-input').value.toLowerCase();

    const filtered = allCommunities.filter(c => {
        const nameMatch = c.community_name.toLowerCase().includes(searchText);
        const subjectMatch = c.main_subject && c.main_subject.toLowerCase().includes(searchText);
        return nameMatch || subjectMatch;
    });

    renderCommunities(filtered);
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    renderCommunities(allCommunities);
}

