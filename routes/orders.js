const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const nodemailer = require('nodemailer');
const ics = require('ics');
const { google } = require('googleapis');

// --- 1. הגדרת הדוור (Transporter) עם הכתובת החדשה ---
// הקוד ימשוך מכאן את 'conetnoreply@gmail.com' שהגדרתם ב-.env
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- 2. הגדרות גוגל קלנדר ---
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL
);

// --- פונקציות עזר לזמנים ---
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function getMinutesFromDate(dateObj) {
    const date = new Date(dateObj);
    return date.getHours() * 60 + date.getMinutes();
}

// --- פונקציה לשליחת מייל עם קובץ ICS ---
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
        // המארגן יהיה המייל של המערכת (conetnoreply)
        organizer: { name: 'CoNet Team', email: process.env.EMAIL_USER }
    };

    return new Promise((resolve, reject) => {
        ics.createEvent(event, (error, value) => {
            if (error) {
                console.error('Error generating ICS:', error);
                return resolve(false);
            }

            const mailOptions = {
                // כאן יופיע השם "NoReplayconet" והכתובת conetnoreply@gmail.com
                from: `"NoReplayconet" <${process.env.EMAIL_USER}>`, 
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
                    console.log('Email sent:', info.response);
                    resolve(true);
                }
            });
        });
    });
}

// --- פונקציה לסנכרון ישיר ליומן גוגל ---
async function addEventToGoogleCalendar(userTokens, orderDetails, spaceName, address) {
    try {
        oauth2Client.setCredentials({
            access_token: userTokens.access_token,
            refresh_token: userTokens.refresh_token
        });
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const event = {
            summary: `CoNet: ${spaceName}`,
            location: address,
            description: `הזמנה מאושרת דרך CoNet.\nמספר משתתפים: ${orderDetails.attendees_count}`,
            start: { dateTime: orderDetails.start_time.toISOString(), timeZone: 'Asia/Jerusalem' },
            end: { dateTime: orderDetails.end_time.toISOString(), timeZone: 'Asia/Jerusalem' },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 60 },
                    { method: 'popup', minutes: 15 },
                ],
            },
        };
        await calendar.events.insert({ calendarId: 'primary', resource: event });
        console.log(`✅ Direct Google Calendar sync successful`);
        return true;
    } catch (error) {
        console.error('⚠️ Failed direct Google sync:', error.message);
        return false;
    }
}

// --- נתיב ראשי: יצירת הזמנה ---
router.post('/create', verifyToken, async (req, res) => {
    const { space_id, start_time, end_time, event_id, attendees_count } = req.body;
    const user_id = req.user.user_id;
    
    const requestedSeats = attendees_count && attendees_count > 0 ? attendees_count : 1;

    if (!space_id || !start_time || !end_time) return res.status(400).json({ message: 'חסרים פרטים' });

    const start = new Date(start_time);
    const end = new Date(end_time);
    const now = new Date();

    if (start >= end) return res.status(400).json({ message: 'שעת ההתחלה חייבת להיות לפני הסיום' });
    if (start < now) return res.status(400).json({ message: 'לא ניתן להזמין לעבר' });

    try {
        const [spaces] = await db.execute('SELECT * FROM spaces WHERE space_id = ?', [space_id]);
        if (spaces.length === 0) return res.status(404).json({ message: 'המרחב לא נמצא' });
        const space = spaces[0];

        if (space.space_status === 'close') return res.status(400).json({ message: 'המרחב סגור' });
        if (space.capacity === 'full') return res.status(409).json({ message: 'המרחב מלא' });
        if (requestedSeats > space.seats_available) return res.status(400).json({ message: 'אין מספיק מקום' });

        const startMinutes = getMinutesFromDate(start);
        const endMinutes = getMinutesFromDate(end);
        const openMinutes = timeToMinutes(space.opening_hours);
        const closeMinutes = timeToMinutes(space.closing_hours);

        if (startMinutes < openMinutes || endMinutes > closeMinutes) return res.status(400).json({ message: 'חריגה משעות הפתיחה' });

        const overlapSql = `SELECT SUM(attendees_count) as total_booked FROM orders WHERE space_id = ? AND status = 'approved' AND start_time < ? AND end_time > ?`;
        const [occupancyResult] = await db.execute(overlapSql, [space_id, end_time, start_time]);
        const currentOccupancy = parseInt(occupancyResult[0].total_booked) || 0;
        
        if ((currentOccupancy + requestedSeats) > space.seats_available) return res.status(409).json({ message: 'אין מספיק מקום בשעות אלו' });

        if ((currentOccupancy + requestedSeats) === space.seats_available) {
            await db.execute("UPDATE spaces SET capacity = 'full' WHERE space_id = ?", [space_id]);
        }

        const insertSql = `INSERT INTO orders (user_id, space_id, event_id, start_time, end_time, status, attendees_count) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [insertResult] = await db.execute(insertSql, [user_id, space_id, event_id || null, start_time, end_time, 'approved', requestedSeats]);

        // --- לוגיקת סנכרון חכמה ---
        let syncStatus = 'none';
        const [users] = await db.execute('SELECT email, google_access_token, google_refresh_token FROM users WHERE user_id = ?', [user_id]);
        
        if (users.length > 0) {
            const user = users[0];
            const orderDetails = { start_time: start, end_time: end, attendees_count: requestedSeats };

            if (user.google_access_token) {
                console.log('Attempting Direct Google Sync...');
                const success = await addEventToGoogleCalendar(
                    { access_token: user.google_access_token, refresh_token: user.google_refresh_token },
                    orderDetails, 
                    space.space_name, 
                    space.address
                );
                syncStatus = success ? 'direct_google' : 'failed';
            } 
            
            if ((!user.google_access_token || syncStatus === 'failed') && user.email) {
                console.log('Attempting Email Invite (ICS)...');
                // שימוש בכתובת המייל מה-env
                const emailSuccess = await sendEmailWithInvite(
                    user.email, 
                    orderDetails, 
                    space.space_name, 
                    space.address
                );
                syncStatus = emailSuccess ? 'email_sent' : 'failed';
            }
        }

        res.status(201).json({ 
            message: 'ההזמנה בוצעה בהצלחה', 
            orderId: insertResult.insertId,
            syncStatus: syncStatus 
        });

    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: 'שגיאה בביצוע ההזמנה' });
    }
});

// --- ביטול והיסטוריה (נשאר ללא שינוי) ---
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