const API_URL = '/api';
let autocomplete;

document.addEventListener('DOMContentLoaded', () => {
    checkPermissions();
    loadFacilities();
});

// 1. בדיקת הרשאות (Client Side Security)
function checkPermissions() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert('עליך להתחבר כדי לגשת לדף זה');
        window.location.href = '/login.html'; // נתיב לדף התחברות
        return;
    }

    // פענוח ה-Payload של הטוקן (Base64)
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const userData = JSON.parse(jsonPayload);

        // בדיקה קריטית: האם המשתמש הוא מנהל מרחב?
        if (userData.user_type !== 'space_manager' && userData.user_type !== 'admin') {
            alert('אין לך הרשאה לגשת לדף זה. הדף מיועד למנהלי מרחב בלבד.');
            window.location.href = '/'; // החזרה לדף הבית
        }

    } catch (e) {
        console.error('Error decoding token', e);
        window.location.href = '/login.html';
    }
}

// 2. אתחול השלמה אוטומטית של כתובות (Google Maps)
function initAutocomplete() {
    const input = document.getElementById("address");
    
    // הגבלה לחיפוש כתובות בישראל בלבד (אופציונלי)
    const options = {
        componentRestrictions: { country: "il" },
        fields: ["address_components", "geometry", "place_id", "formatted_address"],
        types: ["address"],
    };

    autocomplete = new google.maps.places.Autocomplete(input, options);

    // האזנה לאירוע בחירת כתובת
    autocomplete.addListener("place_changed", fillInAddress);
}

function fillInAddress() {
    const place = autocomplete.getPlace();

    if (!place.geometry || !place.geometry.location) {
        alert("לא נמצאו פרטים על המיקום שנבחר");
        return;
    }

    // שמירת הנתונים הגיאוגרפיים בשדות נסתרים
    document.getElementById("latitude").value = place.geometry.location.lat();
    document.getElementById("longitude").value = place.geometry.location.lng();
    document.getElementById("google_place_id").value = place.place_id;
    document.getElementById("address").value = place.formatted_address; // הכתובת המלאה והמפורמטת
}

// 3. טעינת רשימת הפיצ'רים
async function loadFacilities() {
    try {
        const response = await fetch(`${API_URL}/spaces/facilities`);
        const facilities = await response.json();
        
        const container = document.getElementById('facilities-container');
        container.innerHTML = '';

        facilities.forEach(f => {
            const div = document.createElement('div');
            div.className = 'facility-item';
            div.innerHTML = `
                <input type="checkbox" id="fac_${f.facility_id}" value="${f.facility_id}" name="facilities">
                <label for="fac_${f.facility_id}">${f.facility_name}</label>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading facilities:', error);
    }
}

// 4. שליחת הטופס (יצירת המרחב)
document.getElementById('add-space-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    
    // איסוף הפיצ'רים שנבחרו
    const selectedFacilities = Array.from(document.querySelectorAll('input[name="facilities"]:checked'))
        .map(cb => parseInt(cb.value));

    // בניית האובייקט לשליחה
    const payload = {
        space_name: document.getElementById('space_name').value,
        address: document.getElementById('address').value,
        description: document.getElementById('description').value,
        seats_available: parseInt(document.getElementById('seats_available').value),
        opening_hours: document.getElementById('opening_hours').value,
        closing_hours: document.getElementById('closing_hours').value,
        latitude: document.getElementById('latitude').value || null,
        longitude: document.getElementById('longitude').value || null,
        google_place_id: document.getElementById('google_place_id').value || null,
        facilities: selectedFacilities
    };

    try {
        const response = await fetch(`${API_URL}/spaces/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            alert('המרחב נוסף בהצלחה!');
            window.location.href = '/search'; // מעבר לדף המפה כדי לראות את המרחב החדש
        } else {
            alert('שגיאה: ' + data.message);
        }

    } catch (error) {
        console.error('Error adding space:', error);
        alert('אירעה תקלה בתקשורת עם השרת');
    }
});