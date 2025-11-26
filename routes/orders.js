const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken'); // <-- עודכן לשם החדש

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function getMinutesFromDate(dateObj) {
    const date = new Date(dateObj);
    return date.getHours() * 60 + date.getMinutes();
}

// --- יצירת הזמנה חדשה ---
router.post('/create', verifyToken, async (req, res) => {
    const { space_id, start_time, end_time, event_id, attendees_count } = req.body;
    const user_id = req.user.user_id;
    
    // ברירת מחדל: אם לא הוזן מספר, נחשב כאדם אחד
    const requestedSeats = attendees_count && attendees_count > 0 ? attendees_count : 1;

    if (!space_id || !start_time || !end_time) {
        return res.status(400).json({ message: 'חסרים פרטים ליצירת ההזמנה' });
    }

    const start = new Date(start_time);
    const end = new Date(end_time);
    const now = new Date();

    if (start >= end) return res.status(400).json({ message: 'שעת ההתחלה חייבת להיות לפני הסיום' });
    if (start < now) return res.status(400).json({ message: 'לא ניתן להזמין לעבר' });

    try {
        // 1. שליפת פרטי המרחב
        const [spaces] = await db.execute('SELECT * FROM spaces WHERE space_id = ?', [space_id]);
        if (spaces.length === 0) return res.status(404).json({ message: 'המרחב לא נמצא' });
        
        const space = spaces[0];

        // 2. בדיקת סטטוס כללית של המרחב
        if (space.space_status === 'close') {
            return res.status(400).json({ message: 'המרחב סגור כרגע להזמנות' });
        }
        if (space.capacity === 'full') {
            return res.status(409).json({ message: 'המרחב מסומן כמלא (Full) ולא ניתן להזמין בו מקום' });
        }

        // בדיקה שהבקשה עצמה לא גדולה מהמקום הפיזי
        if (requestedSeats > space.seats_available) {
            return res.status(400).json({ 
                message: `ביקשת ${requestedSeats} מקומות, אך המרחב מכיל רק ${space.seats_available} מקומות.` 
            });
        }

        // 3. בדיקת שעות פתיחה
        const startMinutes = getMinutesFromDate(start);
        const endMinutes = getMinutesFromDate(end);
        const openMinutes = timeToMinutes(space.opening_hours);
        const closeMinutes = timeToMinutes(space.closing_hours);

        if (startMinutes < openMinutes || endMinutes > closeMinutes) {
            return res.status(400).json({ 
                message: `ההזמנה חייבת להיות בתוך שעות הפתיחה: ${space.opening_hours} - ${space.closing_hours}` 
            });
        }

        // 4. בדיקת תפוסה (Capacity Check)
        const overlapSql = `
            SELECT SUM(attendees_count) as total_booked
            FROM orders 
            WHERE space_id = ? 
            AND status = 'approved' 
            AND start_time < ? 
            AND end_time > ?
        `;

        const [occupancyResult] = await db.execute(overlapSql, [space_id, end_time, start_time]);
        const currentOccupancy = parseInt(occupancyResult[0].total_booked) || 0;
        const newTotalOccupancy = currentOccupancy + requestedSeats;

        if (newTotalOccupancy > space.seats_available) {
            const seatsLeft = space.seats_available - currentOccupancy;
            return res.status(409).json({ 
                message: `אין מספיק מקום פנוי בשעות אלו. נותרו ${seatsLeft} מקומות.` 
            });
        }

        // 5. עדכון סטטוס המרחב ל-FULL (אם התמלא בדיוק)
        if (newTotalOccupancy === space.seats_available) {
            await db.execute("UPDATE spaces SET capacity = 'full' WHERE space_id = ?", [space_id]);
            console.log(`Space ${space_id} marked as FULL automatically.`);
        }

        // 6. יצירת ההזמנה
        const insertSql = `
            INSERT INTO orders (user_id, space_id, event_id, start_time, end_time, status, attendees_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        await db.execute(insertSql, [
            user_id, space_id, event_id || null, 
            start_time, end_time, 'approved', requestedSeats
        ]);

        res.status(201).json({ message: 'ההזמנה בוצעה ואושרה בהצלחה' });

    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: 'שגיאה בביצוע ההזמנה' });
    }
});

// --- ביטול הזמנה ---
router.patch('/:orderId/cancel', verifyToken, async (req, res) => {
    const { orderId } = req.params;
    const user_id = req.user.user_id;

    try {
        const [orders] = await db.execute('SELECT * FROM orders WHERE order_id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'הזמנה לא נמצאה' });
        
        const order = orders[0];

        if (order.user_id !== user_id) {
            return res.status(403).json({ message: 'אין הרשאה לבטל הזמנה זו' });
        }

        if (order.status === 'canceled') {
            return res.status(400).json({ message: 'ההזמנה כבר מבוטלת' });
        }

        await db.execute("UPDATE orders SET status = 'canceled' WHERE order_id = ?", [orderId]);

        // שחרור סטטוס FULL אם המרחב היה מלא
        const space_id = order.space_id;
        const [spaces] = await db.execute('SELECT capacity FROM spaces WHERE space_id = ?', [space_id]);
        
        if (spaces.length > 0 && spaces[0].capacity === 'full') {
            await db.execute("UPDATE spaces SET capacity = 'not full' WHERE space_id = ?", [space_id]);
        }

        res.json({ message: 'ההזמנה בוטלה בהצלחה' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'שגיאה בביטול ההזמנה' });
    }
});

// --- היסטוריית הזמנות ---
router.get('/my-orders', verifyToken, async (req, res) => {
    const user_id = req.user.user_id;
    try {
        const sql = `
            SELECT o.*, s.space_name, s.address 
            FROM orders o
            JOIN spaces s ON o.space_id = s.space_id
            WHERE o.user_id = ?
            ORDER BY o.start_time DESC
        `;
        const [orders] = await db.execute(sql, [user_id]);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'שגיאה בשליפת הזמנות' });
    }
});

module.exports = router;