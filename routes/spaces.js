const express = require('express');
const router = express.Router();
const db = require('../db');

// --- פונקציית עזר לבניית קישור לגוגל מפות ---
const buildGoogleMapsUrl = (space) => {
    // Place ID 
    if (space.google_place_id) {
        return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${space.google_place_id}`;
    }
    //  לקואורדינטות 
    if (space.latitude && space.longitude) {
        return `https://www.google.com/maps/search/?api=1&query=${space.latitude},${space.longitude}`;
    }
    //  לפי הכתובת
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(space.address)}`;
};

// --- חיפוש מרחבים ---
router.post('/search', async (req, res) => {
    const { required_facilities, user_lat, user_lng, radius_km } = req.body;

    try {
        let sqlSelect = `
            SELECT 
                s.*,
                GROUP_CONCAT(DISTINCT f.facility_name SEPARATOR ', ') AS facilities_names
        `;

        // חישוב מרחק 
        if (user_lat && user_lng) {
            sqlSelect += `,
                ( 6371 * acos( cos( radians(?) ) *
                  cos( radians( s.latitude ) ) *
                  cos( radians( s.longitude ) - radians(?) ) +
                  sin( radians(?) ) *
                  sin( radians( s.latitude ) ) )
                ) AS distance
            `;
        } else {
            sqlSelect += `, NULL as distance`;
        }

        let sqlFrom = `
            FROM spaces s
            LEFT JOIN space_facilities sf ON s.space_id = sf.space_id
            LEFT JOIN facilities f ON sf.facility_id = f.facility_id
            WHERE s.space_status = 'open' 
            AND s.capacity = 'not full'
        `;

        const params = [];

        if (user_lat && user_lng) {
            params.push(user_lat, user_lng, user_lat);
        }

        if (required_facilities && required_facilities.length > 0) {
            sqlFrom += ` AND sf.facility_id IN (?)`;
            params.push(required_facilities);
        }

        let finalSql = sqlSelect + sqlFrom + ` GROUP BY s.space_id`;

        const havingConditions = [];

        if (required_facilities && required_facilities.length > 0) {
            havingConditions.push(`COUNT(DISTINCT sf.facility_id) = ?`);
            params.push(required_facilities.length);
        }

        // סינון לפי רדיוס)
        if (user_lat && user_lng && radius_km) {
            havingConditions.push(`distance < ?`);
            params.push(radius_km);
        }

        if (havingConditions.length > 0) {
            finalSql += ` HAVING ` + havingConditions.join(' AND ');
        }

        //  מיון התוצאות
        if (user_lat && user_lng) {
            finalSql += ` ORDER BY distance ASC`; // הכי קרוב למעלה
        } else {
            finalSql += ` ORDER BY s.space_name ASC`;
        }

        const [rows] = await db.query(finalSql, params);

        const enrichedResults = rows.map(space => {
            const facilitiesList = space.facilities_names ? space.facilities_names.split(', ') : [];

            return {
                ...space,
                latitude: space.latitude ? parseFloat(space.latitude) : null,
                longitude: space.longitude ? parseFloat(space.longitude) : null,
                distance: space.distance ? parseFloat(space.distance).toFixed(1) + ' km' : null,
                
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