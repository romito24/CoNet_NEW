document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");

    const greetingEl = document.getElementById("userGreeting");
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (!greetingEl) return;

    // אין התחברות
    if (!token) {
        greetingEl.textContent = "שלום, אורח";
        loginBtn.style.display = "inline-flex";
        logoutBtn.style.display = "none";
        return;
    }

    try {
        const payload = parseJwt(token);
        if (!payload) throw new Error("Invalid token");

        const now = Math.floor(Date.now() / 1000);

        // טוקן שפג תוקף
        if (payload.exp && payload.exp < now) {
            localStorage.removeItem("token");
            greetingEl.textContent = "שלום, אורח";
            loginBtn.style.display = "inline-flex";
            logoutBtn.style.display = "none";
            return;
        }

        // משתמש מחובר
        greetingEl.textContent = `שלום, ${payload.first_name || "משתמש"}`;
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-flex";

    } catch (e) {
        console.error("Invalid token format", e);
        localStorage.removeItem("token");
    }
});

// התנתקות
function logoutUser() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
