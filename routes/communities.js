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
        // בדיקת הרשאות (רק מנהל קהילה יכול ליצור)
        const [users] = await db.query('SELECT user_type FROM users WHERE user_id = ?', [user_id]);

        if (users.length === 0) return res.status(404).json({ message: "משתמש לא נמצא" });
        if (users[0].user_type !== 'community_manager') {
            return res.status(403).json({ message: "אין לך הרשאה ליצור קהילה." });
        }

        // בדיקת כפילות שם
        const [existingCommunity] = await db.query('SELECT community_id FROM communities WHERE community_name = ?', [community_name]);
        if (existingCommunity.length > 0) {
            return res.status(409).json({ message: "קהילה בשם זה כבר קיימת." });
        }

        // יצירת הקהילה
        const insertQuery = `
            INSERT INTO communities (community_name, main_subject, image_url, establishment_date)
            VALUES (?, ?, ?, ?)
        `;
        
        const [result] = await db.query(insertQuery, [community_name, main_subject, image_url, establishment_date]);
        const newCommunityId = result.insertId;

        // הוספת המנהל שיצר כחבר ומנהל בקהילה בטבלת הקישור
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
// עריכת קהילה (PUT /:id) - מתוקן!
// ==========================================
router.put('/:id', verifyToken, async (req, res) => {
    const communityId = req.params.id;
    const updates = req.body;
    const userId = req.user.user_id;

    try {
        // 1. קודם כל: האם הקהילה קיימת בכלל?
        const [communityExists] = await db.query('SELECT community_id FROM communities WHERE community_id = ?', [communityId]);
        
        if (communityExists.length === 0) {
            return res.status(404).json({ message: "הקהילה לא נמצאה" });
        }

        // 2. בדיקת הרשאות: האם המשתמש הוא מנהל של הקהילה הזו?
        const [roleCheck] = await db.query(
            'SELECT role FROM community_users WHERE community_id = ? AND user_id = ?', 
            [communityId, userId]
        );

        // שליפת התפקיד (אם קיים)
        const userRole = roleCheck.length > 0 ? roleCheck[0].role : null;

        // אם המשתמש הוא לא המנהל (גם אם הוא סתם חבר, וגם אם הוא בכלל לא בקהילה)
        if (userRole !== 'manager' && req.user.user_type !== 'admin') {
            return res.status(403).json({ message: "אין לך הרשאה לערוך את הקהילה (נדרש מנהל קהילה)" });
        }

        // 3. המשך לעדכון...
        const allowedFields = ['community_name', 'main_subject', 'image_url', 'establishment_date'];
        let updateQuery = 'UPDATE communities SET ';
        const updateParams = [];
        let hasUpdates = false;

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateQuery += `${field} = ?, `;
                updateParams.push(updates[field]);
                hasUpdates = true;
            }
        }

        if (!hasUpdates) {
            return res.status(400).json({ message: "לא נשלחו שדות לעדכון" });
        }

        updateQuery = updateQuery.slice(0, -2); 
        updateQuery += ' WHERE community_id = ?';
        updateParams.push(communityId);

        await db.query(updateQuery, updateParams);

        res.json({ message: "הקהילה עודכנה בהצלחה" });

    } catch (error) {
        console.error("Error updating community:", error);
        res.status(500).json({ message: "שגיאה בעדכון הקהילה" });
    }
});

// ==========================================
// כל הקהילות שאני חבר בהן (GET /my-communities)
// ==========================================
router.get('/my-communities', verifyToken, async (req, res) => {
    const user_id = req.user.user_id;

    try {
        const query = `
            SELECT c.*, cu.role as my_role 
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
// קהילות בניהולי בלבד (GET /my-managing)
// ==========================================
router.get('/my-managing', verifyToken, async (req, res) => {
    const user_id = req.user.user_id;

    try {
        const query = `
            SELECT c.*, cu.role as my_role 
            FROM communities c
            JOIN community_users cu ON c.community_id = cu.community_id
            WHERE cu.user_id = ? AND cu.role = 'manager'
        `;
        const [communities] = await db.query(query, [user_id]);
        res.json(communities);
    } catch (error) {
        console.error("Error fetching managed communities:", error);
        res.status(500).json({ message: "שגיאה בשליפת הקהילות בניהולי" });
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
        const [exists] = await db.query('SELECT * FROM community_users WHERE community_id = ? AND user_id = ?', [community_id, user_id]);
        if (exists.length > 0) return res.status(409).json({ message: "אתה כבר חבר בקהילה זו" });

        await db.query('INSERT INTO community_users (community_id, user_id, role) VALUES (?, ?, "member")', [community_id, user_id]);
        res.status(200).json({ message: "הצטרפת לקהילה בהצלחה!" });

    } catch (error) {
        console.error("Error joining community:", error);
        res.status(500).json({ message: "שגיאה בהצטרפות לקהילה" });
    }
});

module.exports = router;