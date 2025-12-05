const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

// ==========================================
// יצירת קהילה חדשה (POST /)
// ==========================================
router.post('/', verifyToken, async (req, res) => {
    const { community_name, main_subject, image_url, establishment_date } = req.body;
    const user_id = req.user.user_id;

    if (!community_name) {
        return res.status(400).json({ message: "חובה לשלוח שם קהילה" });
    }

    try {
        // 1. בדיקת הרשאות (רק מנהל קהילה יכול ליצור)
        const [users] = await db.query('SELECT user_type FROM users WHERE user_id = ?', [user_id]);

        if (users.length === 0) return res.status(404).json({ message: "משתמש לא נמצא" });
        if (users[0].user_type !== 'community_manager') {
            return res.status(403).json({ message: "אין לך הרשאה ליצור קהילה." });
        }

        // 2. בדיקת כפילות שם
        const [existingCommunity] = await db.query('SELECT community_id FROM communities WHERE community_name = ?', [community_name]);
        if (existingCommunity.length > 0) {
            return res.status(409).json({ message: "קהילה בשם זה כבר קיימת." });
        }

        // 3. יצירת הקהילה
        const insertQuery = `
            INSERT INTO communities (community_name, main_subject, image_url, establishment_date)
            VALUES (?, ?, ?, ?)
        `;
        
        const [result] = await db.query(insertQuery, [community_name, main_subject, image_url, establishment_date]);
        const newCommunityId = result.insertId;

        // 4. בונוס חשוב: הוספת המנהל שיצר את הקהילה כחבר בקהילה (כדי שיראה אותה ב"קהילות שלי")
        // אנחנו מגדירים לו תפקיד 'manager' (או מה שה-ENUM שלך מאפשר, אחרת member)
        const linkQuery = `INSERT INTO community_users (community_id, user_id, role) VALUES (?, ?, 'manager')`;
        await db.query(linkQuery, [newCommunityId, user_id]);

        res.status(201).json({
            message: "הקהילה נוצרה בהצלחה!",
            communityId: newCommunityId,
            name: community_name
        });

    } catch (error) {
        console.error("Error creating community:", error);
        res.status(500).json({ message: "שגיאה פנימית בשרת" });
    }
});

// ==========================================
// הקהילות שלי (GET /my-communities)
// ==========================================
router.get('/my-communities', verifyToken, async (req, res) => {
    const user_id = req.user.user_id;

    try {
        // שליפה חכמה עם JOIN:
        // אנחנו רוצים את פרטי הקהילה (מטבלת communities)
        // עבור כל שורה בטבלת הקישור (community_users) ששייכת למשתמש הנוכחי
        const query = `
            SELECT 
                c.*, 
                cu.role as my_role 
            FROM communities c
            JOIN community_users cu ON c.community_id = cu.community_id
            WHERE cu.user_id = ?
        `;
        
        const [communities] = await db.query(query, [user_id]);
        
        res.json(communities);

    } catch (error) {
        console.error("Error fetching my communities:", error);
        res.status(500).json({ message: "שגיאה בשליפת הקהילות שלי" });
    }
});

// ==========================================
// הצטרפות לקהילה (POST /join) 
// ==========================================
router.post('/join', verifyToken, async (req, res) => {
    const { community_id } = req.body;
    const user_id = req.user.user_id;

    if (!community_id) return res.status(400).json({ message: "חובה לשלוח מזהה קהילה" });

    try {
        // בדיקה אם המשתמש כבר חבר
        const [exists] = await db.query('SELECT * FROM community_users WHERE community_id = ? AND user_id = ?', [community_id, user_id]);
        if (exists.length > 0) {
            return res.status(409).json({ message: "אתה כבר חבר בקהילה זו" });
        }

        // הוספה לטבלת הקישור
        await db.query('INSERT INTO community_users (community_id, user_id, role) VALUES (?, ?, "member")', [community_id, user_id]);

        res.status(200).json({ message: "הצטרפת לקהילה בהצלחה!" });

    } catch (error) {
        console.error("Error joining community:", error);
        res.status(500).json({ message: "שגיאה בהצטרפות לקהילה" });
    }
});

module.exports = router;