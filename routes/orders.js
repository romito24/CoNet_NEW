const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const nodemailer = require('nodemailer');
const ics = require('ics');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function getMinutesFromDate(dateObj) {
    const date = new Date(dateObj);
    return date.getHours() * 60 + date.getMinutes();
}

async function sendEmailWithInvite(userEmail, orderDetails, spaceName, address) {
    const startArr = [
        orderDetails.start_time.getFullYear(),
        orderDetails.start_time.getMonth() + 1,
        orderDetails.start_time.getDate(),
        orderDetails.start_time.getHours(),
        orderDetails.start_time.getMinutes()
    ];
    
    const endArr = [
        orderDetails.end_time.getFullYear(),
        orderDetails.end_time.getMonth() + 1,
        orderDetails.end_time.getDate(),
        orderDetails.end_time.getHours(),
        orderDetails.end_time.getMinutes()
    ];

    const event = {
        start: startArr,
        end: endArr,
        title: `CoNet: הזמנה ל-${spaceName}`,
        description: `פרטי ההזמנה ב-CoNet.\nכתובת: ${address}\nמספר משתתפים: ${orderDetails.attendees_count}`,
        location: address,
        status: 'CONFIRMED',
        busyStatus: 'BUSY',
        organizer: { name: 'CoNet Team', email: process.env.EMAIL_USER }
    };

    return new Promise((resolve, reject) => {
        ics.createEvent(event, (error, value) => {
            if (error) {
                console.error('Error generating ICS:', error);
                return resolve(false);
            }

            const mailOptions = {
                from: `"NoReplyconet" <${process.env.EMAIL_USER}>`, 
                to: userEmail,
                subject: `אישור הזמנה: ${spaceName}`,
                text: 'היי, ההזמנה שלך אושרה בהצלחה! מצורף קובץ זימון ליומן.',
                icalEvent: {
                    filename: 'invite.ics',
                    method: 'request',
                    content: value
                }
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    console.error('Error sending email:', err);
                    resolve(false);
                } else {
                    console.log('Email sent successfully:', info.response);
                    resolve(true);
                }
            });
        });
    });
}

// ==========================================
// יצירת הזמנה
// ==========================================
router.post('/create', verifyToken, async (req, res) => {
    const { space_id, start_time, end_time, event_id, attendees_count } = req.body;
    const user_id = req.user.user_id;
    
    const requestedSeats = attendees_count && attendees_count > 0 ? attendees_count : 1;

    if (!space_id || !start_time || !end_time) return res.status(400).json({ message: 'חסרים פרטים ליצירת ההזמנה' });

    const start = new Date(start_time);
    const end = new Date(end_time);
    const now = new Date();

    if (start >= end) return res.status(400).json({ message: 'שעת ההתחלה חייבת להיות לפני הסיום' });
    if (start < now) return res.status(400).json({ message: 'לא ניתן להזמין לעבר' });

    try {
        const [spaces] = await db.execute('SELECT * FROM spaces WHERE space_id = ?', [space_id]);
        if (spaces.length === 0) return res.status(404).json({ message: 'המרחב לא נמצא' });
        const space = spaces[0];

        if (space.space_status === 'close') return res.status(400).json({ message: 'המרחב סגור כרגע להזמנות' });
        if (space.capacity === 'full') return res.status(409).json({ message: 'המרחב מסומן כמלא (Full)' });
        if (requestedSeats > space.seats_available) return res.status(400).json({ message: `אין מספיק מקום במרחב (פנוי: ${space.seats_available})` });

        const startMinutes = getMinutesFromDate(start);
        const endMinutes = getMinutesFromDate(end);
        const openMinutes = timeToMinutes(space.opening_hours);
        const closeMinutes = timeToMinutes(space.closing_hours);

        if (startMinutes < openMinutes || endMinutes > closeMinutes) {
            return res.status(400).json({ message: `ההזמנה חייבת להיות בתוך שעות הפתיחה: ${space.opening_hours} - ${space.closing_hours}` });
        }

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
        
        if ((currentOccupancy + requestedSeats) > space.seats_available) {
            return res.status(409).json({ message: `אין מספיק מקום פנוי בשעות אלו. נותרו ${seatsLeft} מקומות.` });
        }

        // עדכון סטטוס המרחב אם התמלא
        if ((currentOccupancy + requestedSeats) === space.seats_available) {
            await db.execute("UPDATE spaces SET capacity = 'full' WHERE space_id = ?", [space_id]);
        }

        // יצירת ההזמנה ב-DB
        const insertSql = `
            INSERT INTO orders (user_id, space_id, event_id, start_time, end_time, status, attendees_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [insertResult] = await db.execute(insertSql, [user_id, space_id, event_id || null, start_time, end_time, 'approved', requestedSeats]);

        // ============================================================
        // שליחת מייל עם זימון
        // ============================================================
        
        let emailStatus = 'skipped';

        const [users] = await db.execute('SELECT email FROM users WHERE user_id = ?', [user_id]);
        
        if (users.length > 0 && users[0].email) {
            const orderDetails = { start_time: start, end_time: end, attendees_count: requestedSeats };
            
            // שליחת המייל
            console.log(`Sending ICS invite to: ${users[0].email}`);
            const emailSuccess = await sendEmailWithInvite(
                users[0].email, 
                orderDetails, 
                space.space_name, 
                space.address
            );
            emailStatus = emailSuccess ? 'sent' : 'failed';
        }

        // החזרת תשובה ללקוח
        res.status(201).json({ 
            message: 'ההזמנה בוצעה בהצלחה', 
            orderId: insertResult.insertId,
            emailStatus: emailStatus
        });

    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: 'שגיאה בביצוע ההזמנה' });
    }
});

// --- ביטול והיסטוריה  ---
router.patch('/:orderId/cancel', verifyToken, async (req, res) => {
    const { orderId } = req.params;
    const user_id = req.user.user_id;
    try {
        const [orders] = await db.execute('SELECT * FROM orders WHERE order_id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'הזמנה לא נמצאה' });
        const order = orders[0];
        if (order.user_id !== user_id) return res.status(403).json({ message: 'אין הרשאה' });
        if (order.status === 'canceled') return res.status(400).json({ message: 'כבר מבוטלת' });

        await db.execute("UPDATE orders SET status = 'canceled' WHERE order_id = ?", [orderId]);
        const space_id = order.space_id;
        const [spaces] = await db.execute('SELECT capacity FROM spaces WHERE space_id = ?', [space_id]);
        if (spaces.length > 0 && spaces[0].capacity === 'full') {
            await db.execute("UPDATE spaces SET capacity = 'not full' WHERE space_id = ?", [space_id]);
        }
        res.json({ message: 'ההזמנה בוטלה בהצלחה' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'שגיאה בביטול' });
    }
});

router.get('/my-orders', verifyToken, async (req, res) => {
    const user_id = req.user.user_id;
    try {
        const sql = `SELECT o.*, s.space_name, s.address FROM orders o JOIN spaces s ON o.space_id = s.space_id WHERE o.user_id = ? ORDER BY o.start_time DESC`;
        const [orders] = await db.execute(sql, [user_id]);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'שגיאה בשליפת הזמנות' });
    }
});

module.exports = router;
//