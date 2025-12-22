document.addEventListener("DOMContentLoaded", () => {
  const API_BASE_URL = "https://conet-backend.onrender.com/api/auth";
  const signupForm = document.getElementById("signupForm");

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      first_name: document.getElementById("firstName").value,
      last_name: document.getElementById("lastName").value,
      email: document.getElementById("signupEmail").value,
      password: document.getElementById("signupPassword").value,
      phone_number: document.getElementById("signupPhone").value,
      user_type: "regular"
    };

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Signup failed");
        return;
      }

      alert("Signup successful! Please login.");
      window.location.href = "/signin.html";

    } catch (err) {
      console.error("Signup error:", err);
      alert("Server connection error");
    }
  });
});
