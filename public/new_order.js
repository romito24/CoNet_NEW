document.addEventListener('DOMContentLoaded', () => {

    const orderForm = document.getElementById('orderForm');
    if (!orderForm) return;

    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = orderForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> שולח בקשה...';
        submitBtn.disabled = true;

        const params = new URLSearchParams(window.location.search);
        const spaceId = params.get('spaceId') || params.get('space_id');

        if (!spaceId) {
            alert('שגיאה: לא נמצא מזהה מרחב');
            resetButton(submitBtn, originalBtnText);
            return;
        }

        const startDate = document.getElementById('startDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime   = document.getElementById('endTime').value;
        const attendees = document.getElementById('attendeesCount').value;

        if (!startDate || !startTime || !endTime) {
            alert('נא למלא את כל השדות');
            resetButton(submitBtn, originalBtnText);
            return;
        }

        const startDateTime = `${startDate}T${startTime}:00`;
        const endDateTime   = `${startDate}T${endTime}:00`;

        const token = localStorage.getItem('token');
        if (!token) {
            alert('יש להתחבר לפני יצירת הזמנה');
            window.location.href = 'login';
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
                resetButton(submitBtn, originalBtnText);
                return;
            }

            submitBtn.innerHTML = '✅ ההזמנה בוצעה!';
            submitBtn.classList.remove('btn-primary');
            submitBtn.classList.add('btn-success');

            setTimeout(() => {
                alert('✅ ההזמנה בוצעה בהצלחה');
                console.log('Order created:', data);
                window.location.href = 'profile';
            }, 100);

        } catch (error) {
            console.error(error);
            alert('שגיאה בחיבור לשרת');
            resetButton(submitBtn, originalBtnText);
        }
    });
});

function resetButton(btn, originalText) {
    btn.innerHTML = originalText;
    btn.disabled = false;
}