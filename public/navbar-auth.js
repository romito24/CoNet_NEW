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

    try {
        const payload = JSON.parse(atob(token.split(".")[1]));

        // משתמש מחובר (קריאה בלבד!)
        greetingEl.textContent = `שלום, ${payload.first_name || "משתמש"}`;
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-flex";

    } catch (e) {
        console.error("Token parse failed", e);

        // לא מוחקים טוקן – רק מציגים אורח
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
