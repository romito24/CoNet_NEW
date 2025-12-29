let map;
let markers = [];
let userLocation = null;
let userMarker = null; // משתנה גלובלי לשמירת סמן המשתמש
let infoWindow;

const API_URL = '/api'; 

function initMap() {
    const defaultLocation = { lat: 32.0853, lng: 34.7818 };
    
    try {
        map = new google.maps.Map(document.getElementById("map"), {
            zoom: 13,
            center: defaultLocation,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
        });

        infoWindow = new google.maps.InfoWindow();
    } catch (e) {
        console.error("Google Maps API failed to load", e);
    }

    loadFacilities();
    searchSpaces();
}

// טעינת שירותים לתוך Dropdown
async function loadFacilities() {
    try {
        const response = await fetch(`${API_URL}/spaces/facilities`);
        if (!response.ok) throw new Error('Network response was not ok');
        const facilities = await response.json();
        
        const container = document.getElementById('checkboxes');
        container.innerHTML = '';

        facilities.forEach(f => {
            const label = document.createElement('label');
            // onclick="updateSelectionText()" כדי לעדכן טקסט בכל לחיצה
            label.innerHTML = `
                <input type="checkbox" value="${f.facility_id}" class="facility-check" onchange="updateSelectionText()">
                ${f.facility_name}
            `;
            container.appendChild(label);
        });
    } catch (error) {
        console.error('Error loading facilities:', error);
        document.getElementById('checkboxes').innerHTML = '<div style="padding:10px; color:red;">שגיאה בטעינה</div>';
    }
}

// עדכון טקסט "נבחרו X שירותים"
function updateSelectionText() {
    const checkedCount = document.querySelectorAll('.facility-check:checked').length;
    const summaryDiv = document.getElementById('selection-summary');
    const selectBoxText = document.querySelector('.selectBox select option');
    
    if (checkedCount > 0) {
        selectBoxText.innerText = `נבחרו ${checkedCount} שירותים`;
        summaryDiv.innerText = `(סנן לפי ${checkedCount} שירותים שנבחרו)`;
    } else {
        selectBoxText.innerText = 'בחר שירותים...';
        summaryDiv.innerText = '';
    }
}

// בקשת מיקום + תיקון הבאג של כפילות סמנים
function getCurrentLocation() {
    const btn = document.querySelector('.location-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מאתר...';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                if (map) {
                    map.setCenter(userLocation);
                    map.setZoom(14);
                    
                    // בדיקה: האם כבר יש סמן?
                    if (userMarker) {
                        // אם כן, רק נעדכן את המיקום שלו
                        userMarker.setPosition(userLocation);
                    } else {
                        // אם לא, ניצור חדש
                        userMarker = new google.maps.Marker({
                            position: userLocation,
                            map: map,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 8,
                                fillColor: "#4a90e2",
                                fillOpacity: 1,
                                strokeColor: "white",
                                strokeWeight: 2,
                            },
                            title: "המיקום שלי"
                        });
                    }
                }
                
                btn.innerHTML = '<i class="fa-solid fa-check"></i> מיקום אותר';
                setTimeout(() => btn.innerHTML = originalText, 2000);
                searchSpaces();
            },
            () => {
                alert("לא ניתן לאתר מיקום.");
                btn.innerHTML = originalText;
            }
        );
    } else {
        alert("הדפדפן לא תומך במיקום.");
        btn.innerHTML = originalText;
    }
}

async function searchSpaces() {
    const checkedBoxes = document.querySelectorAll('.facility-check:checked');
    const selectedFacilities = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    const radius = document.getElementById('radius').value;

    const payload = {
        required_facilities: selectedFacilities,
        radius_km: radius
    };

    if (userLocation) {
        payload.user_lat = userLocation.lat;
        payload.user_lng = userLocation.lng;
    }

    const listContainer = document.getElementById('results-container');
    listContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i><p>מחפש...</p></div>';

    try {
        const response = await fetch(`${API_URL}/spaces/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderResults(data.results);
        } else {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-magnifying-glass-minus"></i>
                    <p>לא נמצאו תוצאות</p>
                </div>`;
            clearMarkers();
        }

    } catch (error) {
        console.error('Search error:', error);
        listContainer.innerHTML = `<div class="empty-state" style="color:red;">שגיאה בחיפוש</div>`;
    }
}

function clearMarkers() {
    markers.forEach(m => m.setMap(null));
    markers = [];
}

function renderResults(spaces) {
    const listContainer = document.getElementById('results-container');
    listContainer.innerHTML = '';
    
    clearMarkers();

    spaces.forEach(space => {
        // --- 1. יצירת הכרטיס ברשימה בצד ---
        const card = document.createElement('div');
        card.className = 'space-card';
        
        const tagsHtml = space.facilities ? space.facilities.map(f => `<span class="tag">#${f}</span>`).join('') : '';
        
        const distanceHtml = space.distance 
            ? `<span class="distance-badge"><i class="fa-solid fa-person-walking"></i> ${space.distance}</span>` 
            : '<span></span>';
        
        // יצירת מחרוזות בטוחות לשימוש ב-onclick
        const safeName = space.space_name.replace(/'/g, "\\'");
        const safeAddress = space.address ? space.address.replace(/'/g, "\\'") : '';

        // ה-HTML המעודכן
        card.innerHTML = `
            <div class="card-meta">
                ${distanceHtml}
                <span><i class="fa-solid fa-chair"></i> ${space.seats_available} פנוי</span>
            </div>
            <h3>${space.space_name}</h3>
            <div class="address"><i class="fa-solid fa-map-pin"></i> ${space.address}</div>
            <div class="tags">${tagsHtml}</div>
            
            <div class="card-actions">
                <button class="book-btn" onclick="navigateToOrder(${space.space_id}, '${safeName}', '${safeAddress}')">
                    הזמן מקום
                </button>
                <button class="event-btn" onclick="navigateToCreateEvent(${space.space_id}, '${safeName}', '${safeAddress}')">
                    צור אירוע
                </button>
            </div>
        `;

        // לחיצה על הכרטיס (שאינה על כפתור) מתמקדת במפה
        card.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON') { 
                if(map) {
                    map.setCenter({ lat: space.latitude, lng: space.longitude });
                    map.setZoom(16);
                    const marker = markers.find(m => m.getTitle() === space.space_name);
                    if (marker) google.maps.event.trigger(marker, 'click');
                }
            }
        };

        listContainer.appendChild(card);

        // --- 2. יצירת הסמן במפה ---
        if (map && space.latitude && space.longitude) {
            const marker = new google.maps.Marker({
                position: { lat: space.latitude, lng: space.longitude },
                map: map,
                title: space.space_name,
                animation: google.maps.Animation.DROP
            });

            const facilitiesStr = space.facilities ? space.facilities.join(', ') : 'ללא שירותים מיוחדים';

            // HTML של הפופ-אפ
            marker.addListener("click", () => {
                const contentString = `
                    <div class="info-window-content">
                        <h3 class="info-window-title">${space.space_name}</h3>
                        <p class="info-window-address">${space.address}</p>
                        
                        <div class="info-window-facilities">
                            <strong>שירותים:</strong> ${facilitiesStr}
                        </div>

                        <div class="info-window-actions">
                            <button class="info-btn book" onclick="navigateToOrder(${space.space_id}, '${safeName}', '${safeAddress}')">
                                הזמן מקום
                            </button>
                            <button class="info-btn event" onclick="navigateToCreateEvent(${space.space_id}, '${safeName}', '${safeAddress}')">
                                צור אירוע
                            </button>
                        </div>
                    </div>
                `;
                infoWindow.setContent(contentString);
                infoWindow.open(map, marker);
            });
            markers.push(marker);
        }
    });
} 

// ==========================================
// פונקציות ניווט ואימות
// ==========================================

// פונקציית עזר לבדיקת תקינות הטוקן
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
        // פיענוח ה-Payload 
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // בדיקת תוקף 
        const now = Math.floor(Date.now() / 1000);
        
        if (payload.exp && payload.exp < now) {
            // הטוקן פג תוקף
            localStorage.removeItem('token'); // ניקוי טוקן ישן
            return false;
        }
        
        return true;
    } catch (e) {
        console.error("Invalid token format", e);
        return false;
    }
}


// יצירת הזמנה עם אימות
window.navigateToOrder = function(spaceId, spaceName, spaceAddress) {
    // 1. בדיקת התחברות לפני המעבר
    if (!checkAuth()) {
        alert("עליך להתחבר למערכת כדי להזמין מקום.");
        window.location.href = 'login';
        return;
    }

    // 2. אם מחובר - המשך כרגיל
    const addr = spaceAddress || '';
    const url = `new_order.html?spaceId=${spaceId}&spaceName=${encodeURIComponent(spaceName)}&spaceAddress=${encodeURIComponent(addr)}`;
    window.location.href = url;
};

// יצירת אירוע עם אימות ובדיקת הרשאות
window.navigateToCreateEvent = function(spaceId, spaceName, spaceAddress) {
    // 1. בדיקת התחברות בסיסית (האם קיים טוקן והוא בתוקף)
    if (!checkAuth()) {
        alert("עליך להתחבר למערכת כדי ליצור אירוע.");
        window.location.href = 'login.html';
        return;
    }

    // 2. בדיקת הרשאות (Role Check) - התוספת שביקשת
    const token = localStorage.getItem('token');
    if (token) {
        try {
            // פענוח ה-Payload כדי לבדוק את סוג המשתמש
            const payload = JSON.parse(atob(token.split('.')[1]));
            
            // בדיקה: האם המשתמש הוא מנהל קהילה?
            if (payload.user_type !== 'community_manager') {
                alert("אין לך הרשאה ליצור אירועים.\nפעולה זו מותרת למנהלי קהילות בלבד.");
                return; // עוצר כאן ולא עובר לדף הבא
            }
        } catch (e) {
            console.error("Error parsing token for role check", e);
            // במקרה של שגיאה בפענוח, נחמיר ונמנע מעבר
            return;
        }
    }

    // 3. אם הכל תקין (מחובר + מנהל קהילה) - מעבר לדף היצירה
    const addr = spaceAddress || '';
    const url = `new_event.html?spaceId=${spaceId}&spaceName=${encodeURIComponent(spaceName)}&spaceAddress=${encodeURIComponent(addr)}`;
    window.location.href = url;
};