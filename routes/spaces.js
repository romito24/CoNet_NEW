const express = require('express');
const router = express.Router();
const db = require('../db');

// --- חיפוש מרחבים (כולל סינון פיצ'רים) --
router.post('/search', async (req, res) => {
    const { required_facilities } = req.body; // ציפייה למערך ID, למשל: [1, 2]

    try {
        let sql = `
            SELECT s.* FROM spaces s
            WHERE s.space_status = 'open' 
            AND s.capacity = 'not full'
        `;
        
        const params = [];

        if (required_facilities && required_facilities.length > 0) {
            // שליפת מרחבים שיש להם את *כל* הפיצ'רים המבוקשים
            sql = `
                SELECT s.* FROM spaces s
                JOIN space_facilities sf ON s.space_id = sf.space_id
                WHERE s.space_status = 'open' 
                AND s.capacity = 'not full'
                AND sf.facility_id IN (?)
                GROUP BY s.space_id
                HAVING COUNT(DISTINCT sf.facility_id) = ?
            `;
            params.push(required_facilities);
            params.push(required_facilities.length);
        }

        const [results] = await db.query(sql, params);
        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'שגיאה בחיפוש מרחבים' });
    }
});

router.get('/facilities', async (req, res) => {
    try {
        const [facilities] = await db.query('SELECT * FROM facilities');
        res.json(facilities);
    } catch (error) {
        res.status(500).json({ message: 'שגיאה בשליפת פיצ\'רים' });
    }
});

module.exports = router;