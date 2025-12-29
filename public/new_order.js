document.addEventListener('DOMContentLoaded', () => {

    const orderForm = document.getElementById('orderForm');
    if (!orderForm) return; // אם זה לא עמוד הזמנה – יוצאים

    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. תפיסת הכפתור, שמירת הטקסט המקורי והפעלת מצב טעינה
        const submitBtn = orderForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;

        // שינוי לאייקון טעינה ונעילת הכפתור
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> שולח בקשה...';
        submitBtn.disabled = true;

        // 2. איסוף נתונים
        const params = new URLSearchParams(window.location.search);
        // שימוש ב-get גם לאותיות קטנות וגם לגדולות ליתר ביטחון
        const spaceId = params.get('spaceId') || params.get('space_id');

        if (!spaceId) {
            alert('שגיאה: לא נמצא מזהה מרחב');
            resetButton(submitBtn, originalBtnText); // שחרור הכפתור
            return;
        }

        const startDate = document.getElementById('startDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime   = document.getElementById('endTime').value;
        const attendees = document.getElementById('attendeesCount').value;

        if (!startDate || !startTime || !endTime) {
            alert('נא למלא את כל השדות');
            resetButton(submitBtn, originalBtnText); // שחרור הכפתור
            return;
        }

        const startDateTime = `${startDate}T${startTime}:00`;
        const endDateTime   = `${startDate}T${endTime}:00`;

        const token = localStorage.getItem('token');
        if (!token) {
            alert('יש להתחבר לפני יצירת הזמנה');
            window.location.href = 'login.html'; // הפניה ללוגין אם אין טוקן
            return;
        }

        try {
            const response = await fetch('/api/orders/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    space_id: spaceId,
                    start_time: startDateTime,
                    end_time: endDateTime,
                    attendees_count: parseInt(attendees) || 1,
                    event_id: null
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || 'שגיאה ביצירת ההזמנה');
                resetButton(submitBtn, originalBtnText); // שחרור הכפתור במקרה של כישלון
                return;
            }

            // 3. הצלחה - שינוי ויזואלי והפניה
            submitBtn.innerHTML = '✅ ההזמנה בוצעה!';
            submitBtn.classList.remove('btn-primary'); // (אופציונלי) הסרת צבע כחול
            submitBtn.classList.add('btn-success');    // (אופציונלי) הוספת צבע ירוק

            setTimeout(() => {
                alert('✅ בקשת ההזמנה נשלחה בהצלחה');
                console.log('Order created:', data);
                // מעבר לדף הפרופיל
                window.location.href = 'profile';
            }, 100);

        } catch (error) {
            console.error(error);
            alert('שגיאה בחיבור לשרת');
            resetButton(submitBtn, originalBtnText); // שחרור הכפתור במקרה של שגיאת רשת
        }
    });
});

// פונקציית עזר להחזרת הכפתור למצב רגיל
function resetButton(btn, originalText) {
    btn.innerHTML = originalText;
    btn.disabled = false;
    // אם שינינו צבעים, אפשר להחזיר גם אותם כאן (לא חובה)
}