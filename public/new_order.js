document.addEventListener('DOMContentLoaded', () => {

    const orderForm = document.getElementById('orderForm');
    if (!orderForm) return; // אם זה לא עמוד הזמנה – יוצאים

    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const params = new URLSearchParams(window.location.search);
        const spaceId = params.get('space_id');

        if (!spaceId) {
            alert('שגיאה: לא נמצא מזהה מרחב');
            return;
        }

        const startDate = document.getElementById('startDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime   = document.getElementById('endTime').value;

        if (!startDate || !startTime || !endTime) {
            alert('נא למלא את כל השדות');
            return;
        }

        const startDateTime = `${startDate}T${startTime}:00`;
        const endDateTime   = `${startDate}T${endTime}:00`;

        const token = localStorage.getItem('token');
        if (!token) {
            alert('יש להתחבר לפני יצירת הזמנה');
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
                    attendees_count: 1
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || 'שגיאה ביצירת ההזמנה');
                return;
            }

            alert('✅ בקשת ההזמנה נשלחה בהצלחה');
            console.log('Order created:', data);

        } catch (error) {
            console.error(error);
            alert('שגיאה בחיבור לשרת');
        }
    });
});
