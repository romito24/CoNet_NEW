
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

    // מצב אורח
    function setGuestState() {
        greetingEl.textContent = "שלום, אורח";
        loginBtn.style.display = "inline-flex";
        logoutBtn.style.display = "none";
        localStorage.removeItem("token");
    }

    // במידה ולא קיים טוקן בכלל
    if (!token) {
        setGuestState();
        return;
    }

    const payload = parseJwt(token);

    // בדיקת תקינות פורמט הטוקן
    if (!payload || !payload.exp) {
        setGuestState();
        return;
    }

    // בדיקת פקיעת תוקף 
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp < nowInSeconds) {
        setGuestState();
        return;
    }

    // טוקן תקין – משתמש מחובר
    greetingEl.textContent = `שלום, ${payload.first_name || "משתמש"}`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-flex";
});


// התנתקות

function logoutUser() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
