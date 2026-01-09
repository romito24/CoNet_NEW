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

    // אין טוקן – אורח
    if (!token) {
        greetingEl.textContent = "שלום, אורח";
        loginBtn.style.display = "inline-flex";
        logoutBtn.style.display = "none";
        return;
    }

    const payload = parseJwt(token);

    if (payload) {
        greetingEl.textContent = `שלום, ${payload.first_name || "משתמש"}`;
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-flex";
    } else {
        // טוקן פגום / לא קריא
        greetingEl.textContent = "שלום, אורח";
        loginBtn.style.display = "inline-flex";
        logoutBtn.style.display = "none";
    }
});

// התנתקות – רק בלחיצה
function logoutUser() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
