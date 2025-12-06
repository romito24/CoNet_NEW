const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const { createOrderLogic } = require('./orders'); 

// ==========================================
// 1. האירועים שלי (GET /my-events)
// ==========================================
router.get('/my-events', verifyToken, async (req, res) => {
    const user_id = req.user.user_id;
    const { community_id } = req.query;

    try {
        let sql = `
            SELECT e.*, ep.status as my_status, s.space_name, c.community_name
            FROM events e
            JOIN event_participants ep ON e.event_id = ep.event_id
            JOIN spaces s ON e.space_id = s.space_id
            JOIN communities c ON e.community_id = c.community_id
            WHERE ep.user_id = ? AND ep.status = 'registered'
        `;
        
        const params = [user_id];

        if (community_id) {
            sql += ` AND e.community_id = ?`;
            params.push(community_id);
        }

        sql += ` ORDER BY e.event_date DESC, e.start_hour DESC`;

        const [events] = await db.query(sql, params);
        res.json(events);

    } catch (error) {
        console.error("Error fetching my events:", error);
        res.status(500).json({ message: "שגיאה בשליפת האירועים שלי" });
    }
});

// ==========================================
// 2. יצירת אירוע חדש (POST /create)
// ==========================================
router.post('/create', verifyToken, async (req, res) => {
    const { event_name, event_date, start_hour, finish_hour, space_id, community_id, max_participants } = req.body;
    const owner_id = req.user.user_id;

    if (!event_name || !event_date || !start_hour || !finish_hour || !space_id || !community_id) {
        return res.status(400).json({ message: "חסרים פרטים ליצירת האירוע" });
    }

    let newEventId = null;

    try {
        // א. בדיקת הרשאה (האם המשתמש הוא מנהל הקהילה?)
        const [roleCheck] = await db.query(
            'SELECT role FROM community_users WHERE community_id = ? AND user_id = ?', 
            [community_id, owner_id]
        );

        if (roleCheck.length === 0 || roleCheck[0].role !== 'manager') {
            return res.status(403).json({ message: "רק מנהל הקהילה יכול ליצור אירועים" });
        }

        // ב. יצירת האירוע בטבלת events (קודם כל יוצרים כדי לקבל ID)
        const eventParticipants = max_participants || 10;

        const insertEventSql = `
            INSERT INTO events (event_name, event_date, start_hour, finish_hour, space_id, community_id, owner_id, max_participants)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [eventResult] = await db.query(insertEventSql, [
            event_name, event_date, start_hour, finish_hour, space_id, community_id, owner_id, eventParticipants
        ]);
        newEventId = eventResult.insertId;

        // ג. יצירת הזמנה (שריון מקום) באמצעות הלוגיקה המשותפת!
        // ממירים תאריך ושעה לפורמט מלא
        const startDateTime = `${event_date}T${start_hour}`;
        const endDateTime = `${event_date}T${finish_hour}`;

        // שימוש בפונקציה מתוך orders.js
        await createOrderLogic({
            space_id: space_id,
            user_id: owner_id,          // המנהל מזמין את המקום
            start_time: startDateTime,
            end_time: endDateTime,
            attendees_count: eventParticipants, // תופסים מקום לפי כמות המשתתפים המקסימלית
            event_id: newEventId        // קישור לאירוע
        });

        // אם לא הייתה שגיאה ב-createOrderLogic, הכל הצליח
        res.status(201).json({ message: "האירוע נוצר והמקום שוריין בהצלחה!", eventId: newEventId });

    } catch (error) {
        console.error("Error creating event:", error);

        // ד. Rollback: ביטול יצירת האירוע אם ההזמנה נכשלה (למשל כי אין מקום)
        if (newEventId) {
            await db.query('DELETE FROM events WHERE event_id = ?', [newEventId]);
            console.log(`Rollback: Event ${newEventId} deleted because booking failed.`);
        }

        const status = error.status || 500;
        const message = error.message || "שגיאה ביצירת האירוע (ייתכן שאין מקום פנוי)";
        res.status(status).json({ message });
    }
});

// ==========================================
// 3. הרשמה לאירוע (POST /:eventId/register)
// ==========================================
router.post('/:eventId/register', verifyToken, async (req, res) => {
    const eventId = req.params.eventId;
    const userId = req.user.user_id;

    try {
        const [events] = await db.query('SELECT * FROM events WHERE event_id = ?', [eventId]);
        if (events.length === 0) return res.status(404).json({ message: "האירוע לא נמצא" });
        const event = events[0];

        // בדיקת חברות בקהילה
        const [membership] = await db.query(
            'SELECT * FROM community_users WHERE community_id = ? AND user_id = ?',
            [event.community_id, userId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ message: "על מנת שנוכל לאשר את הגעתך עליך להירשם לקהילה" });
        }

        // בדיקת מקום פנוי בהרשמה
        const [countResult] = await db.query(
            'SELECT COUNT(*) as current_count FROM event_participants WHERE event_id = ? AND status = "registered"',
            [eventId]
        );
        const registeredCount = countResult[0].current_count;

        if (event.max_participants && registeredCount >= event.max_participants) {
            return res.status(409).json({ message: "לצערנו, ההרשמה לאירוע הסתיימה (אין מקום פנוי)" });
        }

        // בדיקת הרשמה קיימת
        const [existing] = await db.query(
            'SELECT * FROM event_participants WHERE event_id = ? AND user_id = ?',
            [eventId, userId]
        );

        if (existing.length > 0) {
            if (existing[0].status === 'registered') {
                return res.status(409).json({ message: "אתה כבר רשום לאירוע זה" });
            } else {
                await db.query(
                    'UPDATE event_participants SET status = "registered", registration_date = NOW() WHERE event_id = ? AND user_id = ?',
                    [eventId, userId]
                );
                return res.json({ message: "ההרשמה חודשה בהצלחה!" });
            }
        }

        await db.query(
            'INSERT INTO event_participants (event_id, user_id, status) VALUES (?, ?, "registered")',
            [eventId, userId]
        );

        res.status(201).json({ message: "נרשמת לאירוע בהצלחה!" });

    } catch (error) {
        console.error("Error registering:", error);
        res.status(500).json({ message: "שגיאה בהרשמה לאירוע" });
    }
});

// ==========================================
// 4. ביטול הרשמה לאירוע (PATCH /:eventId/cancel)
// ==========================================
router.patch('/:eventId/cancel', verifyToken, async (req, res) => {
    const eventId = req.params.eventId;
    const userId = req.user.user_id;

    try {
        const [result] = await db.query(
            'UPDATE event_participants SET status = "canceled" WHERE event_id = ? AND user_id = ?',
            [eventId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "לא נמצאה הרשמה פעילה לאירוע זה" });
        }
        res.json({ message: "ההרשמה בוטלה בהצלחה" });

    } catch (error) {
        console.error("Error canceling:", error);
        res.status(500).json({ message: "שגיאה בביטול ההרשמה" });
    }
});

// ==========================================
// 5. כל האירועים (GET /all)
// ==========================================
router.get('/all', async (req, res) => {
    const { community_id } = req.query;

    try {
        let sql = `
            SELECT 
                e.*, 
                s.space_name, 
                s.address, 
                c.community_name, 
                c.image_url as community_image,
                (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.event_id AND ep.status = 'registered') as current_participants
            FROM events e
            JOIN spaces s ON e.space_id = s.space_id
            JOIN communities c ON e.community_id = c.community_id
            WHERE e.event_date >= CURDATE()
        `;
        
        const params = [];

        if (community_id) {
            sql += ` AND e.community_id = ?`;
            params.push(community_id);
        }

        sql += ` ORDER BY e.event_date ASC`;

        const [events] = await db.query(sql, params);
        res.json(events);

    } catch (error) {
        console.error("Error fetching all events:", error);
        res.status(500).json({ message: "שגיאה בשליפת האירועים" });
    }
});

module.exports = router;