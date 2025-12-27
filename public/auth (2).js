document.addEventListener("DOMContentLoaded", () => {
    
    // הגדרת כתובת ה-API. 
    const API_BASE_URL = '/api/auth'; 

    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    
    // כפתורי הטאבים (למעבר אוטומטי אחרי הרשמה)
    const loginTabBtn = document.getElementById("login-tab-btn");
    const signupTabBtn = document.getElementById("signup-tab-btn");

    // ==========================================
    // לוגיקה להתחברות (Login)
    // ==========================================
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                showPopup(data.message, true); // הצגת שגיאה
                return;
            }

            // שמירת הטוקן ופרטי המשתמש בדפדפן
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            // מעבר לדף הבית
            window.location.href = "/home.html";

        } catch (error) {
            console.error("Login Error:", error);
            showPopup("שגיאת תקשורת בחיבור לשרת.", true);
        }
    });

    // ==========================================
    // לוגיקה להרשמה (Signup)
    // ==========================================
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // איסוף הנתונים מהטופס
        // שימי לב: המפתחות (Keys) חייבים להתאים למה שכתוב ב-auth.js
        const payload = {
            first_name: document.getElementById("firstName").value,
            last_name: document.getElementById("lastName").value,
            email: document.getElementById("signupEmail").value,
            password: document.getElementById("signupPassword").value,
            phone_number: document.getElementById("signupPhone").value,
            user_type: "regular" // ברירת מחדל
        };

        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                // אם המייל כבר קיים או שיש שגיאה אחרת
                showPopup(data.message, true);
                return;
            }

            // הרשמה הצליחה!
            alert("ההרשמה בוצעה בהצלחה! אנא התחברי.");
            
            // איפוס הטופס
            signupForm.reset();
            
            // מעבר לטאב התחברות
            const loginTab = new bootstrap.Tab(loginTabBtn);
            loginTab.show();

        } catch (error) {
            console.error("Signup Error:", error);
            showPopup("שגיאה בעת ההרשמה. נסי שוב מאוחר יותר.", true);
        }
    });

    // ==========================================
    // פונקציה להצגת הודעות (Error/Info Popup)
    // ==========================================
    function showPopup(message, isError = false) {
        const modalEl = document.getElementById("errorModal");
        const msgEl = document.getElementById("errorModalMessage");
        const actionBtn = document.getElementById("modalActionBtn");
        const titleEl = modalEl.querySelector("h5");

        msgEl.textContent = message;

        if (isError) {
            titleEl.style.color = "#d9534f"; // אדום
            titleEl.textContent = "שגיאה";
            
            // אם זו שגיאת התחברות ספציפית, אפשר להציע מעבר להרשמה
            if (message.includes("לא נמצא") || message.includes("שגויים")) {
                actionBtn.textContent = "נסה שוב";
            } else {
                actionBtn.textContent = "סגור";
            }
        } else {
            titleEl.style.color = "#5cb85c"; // ירוק
            titleEl.textContent = "הצלחה";
            actionBtn.textContent = "אישור";
        }

        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
});
