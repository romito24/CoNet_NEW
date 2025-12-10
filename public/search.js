let map;
let markers = [];
let userLocation = null;
let infoWindow;

// שינוי חשוב: שימוש בנתיב יחסי. השרת והלקוח באותו דומיין.
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
            streetViewControl: false
        });

        infoWindow = new google.maps.InfoWindow();
    } catch (e) {
        console.error("Google Maps API failed to load", e);
    }

    loadFacilities();
    searchSpaces(); // חיפוש ראשוני
}

// טעינת הפיצ'רים מהשרת
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
            label.innerHTML = `
                <input type="checkbox" value="${f.facility_id}" class="facility-check">
                ${f.facility_name}
            `;
            container.appendChild(label);
        });
    } catch (error) {
        console.error('Error loading facilities:', error);
        document.getElementById('facilities-container').innerHTML = 'שגיאה בטעינת נתונים';
    }
}

// בקשת מיקום מהמשתמש
function getCurrentLocation() {
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
                        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                        title: "המיקום שלי"
                    });
                }

                searchSpaces(); // חיפוש אוטומטי סביב המיקום החדש
            },
            () => {
                alert("לא ניתן לאתר את המיקום שלך. בדוק הרשאות דפדפן.");
            }
        );
    } else {
        alert("הדפדפן שלך לא תומך באיתור מיקום.");
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

    try {
        const response = await fetch(`${API_URL}/spaces/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        
        if (data.results) {
            renderResults(data.results);
            if (data.results.length === 0) {
                document.getElementById('results-container').innerHTML = `<div class="empty-state">${data.message || 'לא נמצאו תוצאות'}</div>`;
            }
        } else {
            renderResults([]);
        }

    } catch (error) {
        console.error('Search error:', error);
        document.getElementById('results-container').innerHTML = `<div class="empty-state" style="color:red;">שגיאה בחיפוש מרחבים. ודא שהשרת רץ.</div>`;
    }
}

// הצגת התוצאות
function renderResults(spaces) {
    const listContainer = document.getElementById('results-container');
    listContainer.innerHTML = '';
    
    // ניקוי סמנים
    if (markers.length > 0) {
        markers.forEach(m => m.setMap(null));
        markers = [];
    }

    spaces.forEach(space => {
        // יצירת כרטיס ברשימה
        const card = document.createElement('div');
        card.className = 'space-card';
        
        const tagsHtml = space.facilities.map(f => `<span class="tag">${f}</span>`).join('');
        const distanceHtml = space.distance ? `<span class="distance">${space.distance}</span>` : '';

        card.innerHTML = `
            <div class="details">
                <span>${distanceHtml}</span>
                <span>${space.seats_available} מקומות</span>
            </div>
            <h3>${space.space_name}</h3>
            <div class="address">${space.address}</div>
            <div class="tags">${tagsHtml}</div>
            <button class="book-btn" onclick="alert('מעבר לדף הזמנה (יש לממש): ${space.space_id}')">הזמן מקום</button>
        `;

        card.onclick = (e) => {
            if(e.target.tagName !== 'BUTTON' && map) { 
                map.setCenter({ lat: space.latitude, lng: space.longitude });
                map.setZoom(16);
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
                    <div style="direction: rtl; text-align: right;">
                        <h3 style="margin:0">${space.space_name}</h3>
                        <p>${space.address}</p>
                        <p><strong>מרחק:</strong> ${space.distance || '--'}</p>
                    </div>
                `;
                infoWindow.setContent(contentString);
                infoWindow.open(map, marker);
            });

            markers.push(marker);
        }
    });
}