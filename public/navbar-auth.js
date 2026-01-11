// ==========================================
// UTF-8 SAFE JWT PARSER (fixes mobile Hebrew)
// ==========================================
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("JWT parse failed", e);
        return null;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");

    const greetingEl = document.getElementById("userGreeting");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    // 🔁 מצב אורח – פונקציה מרכזית
    function setGuestState() {
        greetingEl.textContent = "שלום, אורח";
        loginBtn.style.display = "inline-flex";
        logoutBtn.style.display = "none";
        localStorage.removeItem("token");
    }

    // אין טוקן בכלל
    if (!token) {
        setGuestState();
        return;
    }

    const payload = parseJwt(token);

    // טוקן לא קריא / חסר payload / חסר exp
    if (!payload || !payload.exp) {
        setGuestState();
        return;
    }

    // בדיקת פקיעת תוקף (exp הוא בשניות)
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp < nowInSeconds) {
        setGuestState();
        return;
    }

    // ✅ טוקן תקין – משתמש מחובר
    greetingEl.textContent = `שלום, ${payload.first_name || "משתמש"}`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-flex";
});

// ==========================================
// Logout (ידני בלבד)
// ==========================================
function logoutUser() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
