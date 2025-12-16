let map;
let markers = [];
let userLocation = null;
let infoWindow;

// נתיב יחסי לשרת ה-API
const API_URL = '/api'; 

// אתחול המפה
function initMap() {
    // ברירת מחדל: תל אביב
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
    searchSpaces(); // חיפוש ראשוני
}

// טעינת הפיצ'רים ויצירת כפתורי סינון (Chips)
async function loadFacilities() {
    try {
        const response = await fetch(`${API_URL}/spaces/facilities`);
        if (!response.ok) throw new Error('Network response was not ok');
        const facilities = await response.json();
        
        const container = document.getElementById('facilities-container');
        container.innerHTML = '';

        facilities.forEach(f => {
            const label = document.createElement('label');
            label.className = 'facility-checkbox';
            // ה-Input מוחבא בתוך ה-Label, וה-CSS מעצב את זה ככפתור
            label.innerHTML = `
                <input type="checkbox" value="${f.facility_id}" class="facility-check">
                ${f.facility_name}
            `;
            container.appendChild(label);
        });
    } catch (error) {
        console.error('Error loading facilities:', error);
        document.getElementById('facilities-container').innerHTML = '<span style="color:red">שגיאה בטעינת נתונים</span>';
    }
}

// בקשת מיקום מהמשתמש
function getCurrentLocation() {
    const btn = document.querySelector('.location-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> מאתר...'; // אינדיקציה לטעינה

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
                    
                    new google.maps.Marker({
                        position: userLocation,
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: "#4f46e5",
                            fillOpacity: 1,
                            strokeColor: "white",
                            strokeWeight: 2,
                        },
                        title: "המיקום שלי"
                    });
                }
                
                btn.innerHTML = '<i class="fa-solid fa-check"></i> מיקום אותר';
                setTimeout(() => btn.innerHTML = originalText, 2000);
                searchSpaces(); // חיפוש אוטומטי
            },
            () => {
                alert("לא ניתן לאתר את המיקום שלך. בדוק הרשאות דפדפן.");
                btn.innerHTML = originalText;
            }
        );
    } else {
        alert("הדפדפן שלך לא תומך באיתור מיקום.");
        btn.innerHTML = originalText;
    }
}

// חיפוש מרחבים
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

    // אינדיקציה לטעינה ברשימת התוצאות
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
                    <p>לא נמצאו תוצאות התואמות את החיפוש</p>
                </div>`;
            // ניקוי המפה ממרקרים אם אין תוצאות
            clearMarkers();
        }

    } catch (error) {
        console.error('Search error:', error);
        listContainer.innerHTML = `<div class="empty-state" style="color:red;"><i class="fa-solid fa-triangle-exclamation"></i><p>שגיאה בחיפוש מרחבים</p></div>`;
    }
}

function clearMarkers() {
    markers.forEach(m => m.setMap(null));
    markers = [];
}

// הצגת התוצאות
function renderResults(spaces) {
    const listContainer = document.getElementById('results-container');
    listContainer.innerHTML = '';
    
    clearMarkers();

    spaces.forEach(space => {
        // יצירת כרטיס ברשימה
        const card = document.createElement('div');
        card.className = 'space-card';
        
        // יצירת תגיות
        const tagsHtml = space.facilities ? space.facilities.map(f => `<span class="tag">#${f}</span>`).join('') : '';
        
        // אייקון ומרחק
        const distanceHtml = space.distance 
            ? `<span class="distance-badge"><i class="fa-solid fa-person-walking"></i> ${space.distance}</span>` 
            : '<span></span>';

        card.innerHTML = `
            <div class="card-meta">
                ${distanceHtml}
                <span><i class="fa-solid fa-chair"></i> ${space.seats_available} פנוי</span>
            </div>
            <h3>${space.space_name}</h3>
            <div class="address"><i class="fa-solid fa-map-pin"></i> ${space.address}</div>
            <div class="tags">${tagsHtml}</div>
            <button class="book-btn" onclick="alert('מעבר לדף הזמנה עבור: ${space.space_name}')">
                הזמן מקום
            </button>
        `;

        // לחיצה על הכרטיס (לא על הכפתור) ממקדת את המפה
        card.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON' && map) { 
                map.setCenter({ lat: space.latitude, lng: space.longitude });
                map.setZoom(16);
                // אופציונלי: להקפיץ את המרקר המתאים
                const marker = markers.find(m => m.getTitle() === space.space_name);
                if (marker) {
                    google.maps.event.trigger(marker, 'click');
                }
            }
        };

        listContainer.appendChild(card);

        // הוספה למפה
        if (map && space.latitude && space.longitude) {
            const marker = new google.maps.Marker({
                position: { lat: space.latitude, lng: space.longitude },
                map: map,
                title: space.space_name,
                animation: google.maps.Animation.DROP
            });

            marker.addListener("click", () => {
                const contentString = `
                    <div style="direction: rtl; text-align: right; font-family: sans-serif;">
                        <h3 style="margin:0 0 5px; color:#4f46e5;">${space.space_name}</h3>
                        <p style="margin:0; font-size:13px;">${space.address}</p>
                        <p style="margin:5px 0 0; font-weight:bold;">${space.distance || ''}</p>
                    </div>
                `;
                infoWindow.setContent(contentString);
                infoWindow.open(map, marker);
            });

            markers.push(marker);
        }
    });
}