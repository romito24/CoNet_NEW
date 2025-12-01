const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db'); 

// --- הרשמה ---
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, password, phone_number, user_type } = req.body;

    if (!email || !password || !first_name || !last_name) {
        return res.status(400).json({ message: 'נא למלא את כל שדות החובה' });
    }

    try {
        // בדיקה האם המשתמש כבר קיים
        const [existingUsers] = await db.execute('SELECT email FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'כתובת הדוא"ל כבר קיימת במערכת' });
        }

        // הצפנת הסיסמה
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // הגדרת נתונים נוספים
        const registrationDate = new Date(); // תאריך של היום
        const status = 'active'; // סטטוס דיפולטיבי

        // שמירה ב-DB
        // שימי לב: הסדר של סימני השאלה (?) חייב להיות תואם לסדר במערך
        const sql = `
            INSERT INTO users 
            (first_name, last_name, email, password, phone_number, user_type, status, registration_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await db.execute(sql, [
            first_name, 
            last_name, 
            email, 
            hashedPassword, 
            phone_number, 
            user_type || 'regular', // ברירת מחדל
            status, 
            registrationDate
        ]);

        res.status(201).json({ message: 'המשתמש נרשם בהצלחה' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'שגיאה בשרת בעת ההרשמה' });
    }
});

// --- התחברות ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'יש להזין דוא"ל וסיסמה' });
    }

    try {
        // חיפוש המשתמש
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ message: 'שם משתמש או סיסמה שגויים' });
        }

        const user = users[0];

        // בדיקת סיסמה
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'שם משתמש או סיסמה שגויים' });
        }

        // יצירת טוקן 
        const token = jwt.sign(
            { 
                user_id: user.user_id, 
                user_type: user.user_type,
                first_name: user.first_name 
            },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        // החזרת תשובה 
        res.json({
            message: 'התחברת בהצלחה',
            token: token,
            user: {
                id: user.user_id,
                first_name: user.first_name,
                user_type: user.user_type
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'שגיאה בשרת בעת ההתחברות' });
    }
});

module.exports = router;