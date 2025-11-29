const express = require('express');
const router = express.Router();
const db = require('../db'); // ייבוא החיבור ל-DB מהקובץ הקיים שלך

// נתיב ליצירת קהילה חדשה (POST /api/communities)
router.post('/', async (req, res) => {
    // 1. חילוץ הנתונים מהבקשה
    const { user_id, community_name, main_subject, image_url, establishment_date } = req.body;

    // ולידציה בסיסית
    if (!user_id || !community_name) {
        return res.status(400).json({ message: "חובה לשלוח מזהה משתמש ושם קהילה" });
    }

    try {
        // 2. בדיקת הרשאות: האם המשתמש הוא 'community_manager'?
        const [users] = await db.query('SELECT user_type FROM users WHERE user_id = ?', [user_id]);

        if (users.length === 0) {
            return res.status(404).json({ message: "משתמש לא נמצא" });
        }

        if (users[0].user_type !== 'community_manager') {
            return res.status(403).json({ message: "אין לך הרשאה ליצור קהילה. פעולה זו מותרת למנהלי קהילה בלבד." });
        }

        // 3. בדיקת כפילות: האם שם הקהילה כבר קיים?
        const [existingCommunity] = await db.query('SELECT community_id FROM communities WHERE community_name = ?', [community_name]);

        if (existingCommunity.length > 0) {
            return res.status(409).json({ message: "שגיאה: קהילה בשם זה כבר קיימת במערכת." });
        }

        // 4. יצירת הקהילה ב-DB
        const query = `
            INSERT INTO communities (community_name, main_subject, image_url, establishment_date)
            VALUES (?, ?, ?, ?)
        `;
        
        const [result] = await db.query(query, [community_name, main_subject, image_url, establishment_date]);

        // 5. החזרת תשובה ללקוח
        res.status(201).json({
            message: "הקהילה נוצרה בהצלחה!",
            communityId: result.insertId,
            name: community_name
        });

    } catch (error) {
        console.error("Error creating community:", error);
        res.status(500).json({ message: "שגיאה פנימית בשרת" });
    }
});

module.exports = router;