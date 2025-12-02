const express = require('express');
const router = express.Router();
const db = require('../db');

// --- פונקציית עזר לבניית קישור לגוגל מפות ---
const buildGoogleMapsUrl = (space) => {
    // Place ID לפי
    if (space.google_place_id) {
        return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${space.google_place_id}`;
    }
    // לפי קואורדינטות
    if (space.latitude && space.longitude) {
        return `https://www.google.com/maps/search/?api=1&query=${space.latitude},${space.longitude}`;
    }
    // לפי כתובת
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(space.address)}`;
};

// --- חיפוש מרחבים ---
router.post('/search', async (req, res) => {
    const { required_facilities } = req.body; 

    try {
        let sql = `
            SELECT 
                s.*,
                GROUP_CONCAT(DISTINCT f.facility_name SEPARATOR ', ') AS facilities_names
            FROM spaces s
            LEFT JOIN space_facilities sf ON s.space_id = sf.space_id
            LEFT JOIN facilities f ON sf.facility_id = f.facility_id
            WHERE s.space_status = 'open' 
            AND s.capacity = 'not full'
        `;
        
        const params = [];

        if (required_facilities && required_facilities.length > 0) {
            
            sql += ` AND sf.facility_id IN (?)`;
            params.push(required_facilities);
        }

        sql += ` GROUP BY s.space_id`;

        if (required_facilities && required_facilities.length > 0) {
            sql += ` HAVING COUNT(DISTINCT sf.facility_id) = ?`;
            params.push(required_facilities.length);
        }

        const [rows] = await db.query(sql, params);

        const enrichedResults = rows.map(space => {
            const facilitiesList = space.facilities_names ? space.facilities_names.split(', ') : [];

            return {
                ...space, 
                facilities: facilitiesList, 
                google_maps_url: buildGoogleMapsUrl(space), 
                booking_url: `/booking.html?space_id=${space.space_id}` 
            };
        });

        res.json(enrichedResults);

    } catch (error) {
        console.error("Error searching spaces:", error);
        res.status(500).json({ message: 'שגיאה בחיפוש מרחבים' });
    }
});

// --- הצגת כל הפיצ'רים ---
router.get('/facilities', async (req, res) => {
    try {
        const [facilities] = await db.query('SELECT * FROM facilities ORDER BY facility_name ASC');
        res.json(facilities);
    } catch (error) {
        console.error("Error fetching facilities:", error);
        res.status(500).json({ message: 'שגיאה בשליפת פיצ\'רים' });
    }
});

module.exports = router;