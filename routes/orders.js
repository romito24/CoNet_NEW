const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');
const nodemailer = require('nodemailer');
const ics = require('ics');

// הגדרות מייל
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// פונקציות עזר
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function getMinutesFromDate(dateObj) {
    const date = new Date(dateObj);
    return date.getHours() * 60 + date.getMinutes();
}

// שליחת המייל עם הזימון
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

    // יצירת ICS
    return new Promise((resolve, reject) => {
        ics.createEvent(event, (error, value) => {
            if (error) {
                console.error('Error generating ICS:', error);
                return resolve(false);
            }

            // הגדרת שדות האימייל
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

            // שליחת האימייל
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

// יצירת הזמנה 
const createOrderLogic = async (orderData) => {
    const { space_id, user_id, start_time, end_time, event_id, attendees_count } = orderData;
    
    // חישוב כמות המושבים
    const requestedSeats = attendees_count && attendees_count > 0 ? attendees_count : 1;

    // חישוב תאריך ושעה
    const start = new Date(start_time);
    const end = new Date(end_time);
    const now = new Date();

    // בדיקת תקינות לתאריך ולשעה
    if (start >= end) throw { status: 400, message: 'שעת ההתחלה חייבת להיות לפני הסיום' };
    if (start < now) throw { status: 400, message: 'לא ניתן להזמין לעבר' };

    // שליפת פרטי המרחב
    const [spaces] = await db.execute('SELECT * FROM spaces WHERE space_id = ?', [space_id]);
    if (spaces.length === 0) throw { status: 404, message: 'המרחב לא נמצא' };
    const space = spaces[0];

    // בדיקת סטטוס מרחב ומקומות פנויים
    if (space.space_status === 'close') throw { status: 400, message: 'המרחב סגור כרגע להזמנות' };

    if (requestedSeats > space.seats_available) throw { status: 400, message: `אין מספיק מקום במרחב (פנוי: ${space.seats_available})` };

    // בדיקת שעות פתיחה
    const startMinutes = getMinutesFromDate(start);
    const endMinutes = getMinutesFromDate(end);
    const openMinutes = timeToMinutes(space.opening_hours);
    const closeMinutes = timeToMinutes(space.closing_hours);

    if (startMinutes < openMinutes || endMinutes > closeMinutes) {
        throw { status: 400, message: `ההזמנה חייבת להיות בתוך שעות הפתיחה: ${space.opening_hours} - ${space.closing_hours}` };
    }

    // בדיקת חפיפה ותפוסה
    const overlapSql = `
        SELECT SUM(attendees_count) as total_booked
        FROM orders 
        WHERE space_id = ? 
        AND status = 'approved' 
        AND start_time < ? 
        AND end_time > ?
    `;
    const [occupancyResult] = await db.execute(overlapSql, [space_id, end, start]);
    const currentOccupancy = parseInt(occupancyResult[0].total_booked) || 0;
    
    if ((currentOccupancy + requestedSeats) > space.seats_available) {
        const seatsLeft = space.seats_available - currentOccupancy;
        throw { status: 409, message: `אין מספיק מקום פנוי בשעות אלו. נותרו ${seatsLeft} מקומות.` };
    }

    // שמירת ההזמנה ב-DB
    const insertSql = `
        INSERT INTO orders (user_id, space_id, event_id, start_time, end_time, status, attendees_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [insertResult] = await db.execute(insertSql, [
        user_id, space_id, event_id !== undefined ? event_id : null, start, end, 'approved', requestedSeats
    ]);

    // שליחת מייל
    let emailStatus = 'skipped';
    const [users] = await db.execute('SELECT email FROM users WHERE user_id = ?', [user_id]);
    
    if (users.length > 0 && users[0].email) {
        try {
            await sendEmailWithInvite(users[0].email, { start_time: start, end_time: end, attendees_count: requestedSeats }, space.space_name, space.address);
            emailStatus = 'sent';
        } catch (e) {
            console.error("Email send failed", e);
            emailStatus = 'failed';
        }
    }

    return { 
        success: true, 
        orderId: insertResult.insertId,
        emailStatus,
        message: 'ההזמנה בוצעה בהצלחה'
    };
};

// יצירת הזמנה
router.post('/create', verifyToken, async (req, res) => {
    try {
        // שליפת ID של המשתמש מתוך הטוקן
        const userIdFromToken = req.user.id || req.user.user_id;
        if (!userIdFromToken) {
            console.error("User ID missing in token payload. User object:", req.user);
            return res.status(401).json({ message: 'שגיאת הזדהות: לא ניתן לזהות את המשתמש' });
        }
        
        // שליפת פרטי ההזמנה ושליחה לפונקציית יצירת ההזמנה
        const result = await createOrderLogic({
            user_id: userIdFromToken,
            space_id: req.body.space_id || req.body.spaceId,
            event_id: req.body.event_id || null,
            start_time: req.body.start_time,
            end_time: req.body.end_time,
            attendees_count: req.body.attendees_count || 1 
        });
        res.status(201).json(result);
    } catch (error) {
        console.error("Order creation failed:", error);
        const status = error.status || 500;
        res.status(status).json({ message: error.message || 'שגיאה ביצירת ההזמנה' });
    }
});

// ביטול הזמנה 
router.patch('/:orderId/cancel', verifyToken, async (req, res) => {
    const { orderId } = req.params;
    const user_id = req.user.user_id;
    try {
        // חיפוש ההזמנה ב-DB
        const [orders] = await db.execute('SELECT * FROM orders WHERE order_id = ?', [orderId]);
        if (orders.length === 0) return res.status(404).json({ message: 'הזמנה לא נמצאה' });
        const order = orders[0];
        // אם המשתמש הוא לא בעל ההזמנה
        if (order.user_id !== user_id) return res.status(403).json({ message: 'אין הרשאה' });
        // אם ההזמנה בסטטוס מבוטלת
        if (order.status === 'canceled') return res.status(400).json({ message: 'כבר מבוטלת' });

        // עדכון סטטוס הזמנה למבוטלת ב-DB
        await db.execute("UPDATE orders SET status = 'canceled' WHERE order_id = ?", [orderId]);
        
        res.json({ message: 'ההזמנה בוטלה בהצלחה' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'שגיאה בביטול' });
    }
});

// ההזמנות שלי
router.get('/my-orders', verifyToken, async (req, res) => {
    const user_id = req.user.user_id;
    try {
        // שליפת ההזמנות של המשתמש מתוך טבלת ההזמנות
        const sql = `
            SELECT o.*, s.space_name, s.address, e.event_name 
            FROM orders o 
            JOIN spaces s ON o.space_id = s.space_id 
            LEFT JOIN events e ON o.event_id = e.event_id
            WHERE o.user_id = ? 
            ORDER BY o.start_time DESC
        `;
        const [orders] = await db.execute(sql, [user_id]);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'שגיאה בשליפת הזמנות' });
    }
});

// הזמנות למרחבים בניהולי
router.get('/incoming', verifyToken, async (req, res) => {
    const managerId = req.user.user_id;

    try {
        // שליפת הזמנות למרחבים שאני המנהל שלהם
        const sql = `
            SELECT 
                o.order_id, o.start_time, o.end_time, o.attendees_count, o.status,
                s.space_name, s.address,
                u.first_name, u.last_name, u.phone_number, u.email
            FROM orders o
            JOIN spaces s ON o.space_id = s.space_id
            JOIN users u ON o.user_id = u.user_id
            WHERE s.manager_id = ? 
            AND o.status = 'approved'
            AND o.end_time >= NOW() 
            ORDER BY o.start_time ASC
        `;
        
        const [incomingOrders] = await db.execute(sql, [managerId]);
        res.json(incomingOrders);

    } catch (error) {
        console.error("Error fetching incoming orders:", error);
        res.status(500).json({ message: 'שגיאה בשליפת הזמנות נכנסות' });
    }
});

module.exports = { router, createOrderLogic };