document.addEventListener("DOMContentLoaded", () => {
    
    // הגדרת כתובת ה-API. 
    const API_BASE_URL = '/api/auth'; 

    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    
    // כפתורי הטאבים (קיימים רק אם יש טאבים)
    const loginTabBtn = document.getElementById("login-tab-btn");
    const signupTabBtn = document.getElementById("signup-tab-btn");

    // ==========================================
    // לוגיקה להתחברות (Login)
    // ==========================================
    if (loginForm) {
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
                    showPopup(data.message, true);
                    return;
                }

                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));

                const returnUrl = localStorage.getItem('returnUrl');

                if (returnUrl) {
                    localStorage.removeItem('returnUrl');
                    window.location.href = returnUrl;
                } else {
                    window.location.href = 'profile';
                }

            } catch (error) {
                console.error("Login Error:", error);
                showPopup("שגיאת תקשורת בחיבור לשרת.", true);
            }
        });
    }

    // ==========================================
    // לוגיקה להרשמה (Signup)
    // ==========================================
    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const payload = {
                first_name: document.getElementById("firstName").value,
                last_name: document.getElementById("lastName").value,
                email: document.getElementById("signupEmail").value,
                password: document.getElementById("signupPassword").value,
                phone_number: document.getElementById("signupPhone").value,
                user_type: document.getElementById("userType").value,
            };

            try {
                const response = await fetch(`${API_BASE_URL}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok) {
                    showPopup(data.message, true);
                    return;
                }

                alert("ההרשמה בוצעה בהצלחה! אנא התחברי.");
                signupForm.reset();

                // אם יש טאבים – נחזור להתחברות
                if (loginTabBtn) {
                    const loginTab = new bootstrap.Tab(loginTabBtn);
                    loginTab.show();
                } else {
                    // אחרת – מעבר רגיל לדף התחברות
                    window.location.href = "login";
                }

            } catch (error) {
                console.error("Signup Error:", error);
                showPopup("שגיאה בעת ההרשמה. נסי שוב מאוחר יותר.", true);
            }
        });
    }

    // ==========================================
    // פונקציה להצגת הודעות (Error/Info Popup)
    // ==========================================
    function showPopup(message, isError = false) {
        const modalEl = document.getElementById("errorModal");

        // אם אין modal בדף – ניפול חזרה ל-alert (בטוח)
        if (!modalEl) {
            alert(message);
            return;
        }

        const msgEl = document.getElementById("errorModalMessage");
        const actionBtn = document.getElementById("modalActionBtn");
        const titleEl = modalEl.querySelector("h5");

        msgEl.textContent = message;

        if (isError) {
            titleEl.style.color = "#d9534f";
            titleEl.textContent = "שגיאה";
            actionBtn.textContent = "סגור";
        } else {
            titleEl.style.color = "#5cb85c";
            titleEl.textContent = "הצלחה";
            actionBtn.textContent = "אישור";
        }

        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
});
