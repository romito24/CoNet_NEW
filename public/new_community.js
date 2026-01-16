document.addEventListener('DOMContentLoaded', () => {
    // 1. בדיקת התחברות
    const token = localStorage.getItem('token');
    if (!token) {
        alert("עליך להתחבר כדי ליצור קהילה.");
        window.location.href = 'login.html';
        return;
    }

    // 2. הצגת שם המשתמש למעלה + בדיקת הרשאה ראשונית
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        const navUser = document.getElementById('nav-username');
        if (navUser) navUser.innerText = `שלום, ${user.first_name}`;
        
        // אם המשתמש הוא לא מנהל קהילה - נזרוק אותו החוצה
        if (user.user_type !== 'community_manager' && user.user_type !== 'admin') {
            alert("אין לך הרשאה ליצור קהילות (נדרש חשבון מנהל קהילה).");
            window.location.href = 'Holistic_profile.html';
            return;
        }
    }

    // 3. טיפול בשליחת הטופס
    const form = document.getElementById('newCommunityForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        
        // נעילת הכפתור למניעת לחיצות כפולות
        submitBtn.innerText = "יוצר קהילה...";
        submitBtn.disabled = true;

        // איסוף הנתונים (תואם בדיוק לשדות שהשרת מצפה להם)
        const payload = {
            community_name: document.getElementById('communityName').value,
            main_subject: document.getElementById('communitySubject').value,
            establishment_date: document.getElementById('communityDate').value,
            image_url: document.getElementById('communityImage').value || ''
        };

        try {
            // שליחה לשרת
            const response = await fetch('/api/communities', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                // הצלחה!
                alert("הקהילה נוצרה בהצלחה! מעביר אותך לפרופיל...");
                window.location.href = 'Holistic_profile.html';
            } else {
                // כישלון (למשל: שם קהילה תפוס)
                alert("שגיאה: " + (data.message || "אירעה תקלה ביצירת הקהילה"));
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }

        } catch (error) {
            console.error("Error creating community:", error);
            alert("שגיאת תקשורת עם השרת.");
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });

    function addRequiredStars() {
      const requiredFields = document.querySelectorAll(
        "input[required], select[required], textarea[required]"
      );
    
      requiredFields.forEach((field) => {
        if (!field.id) return;
    
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label) label.classList.add("required");
      });
    }
    addRequiredStars(); 

});

