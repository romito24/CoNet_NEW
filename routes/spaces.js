const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/verifyToken');

const buildGoogleMapsUrl = (space) => {
    if (space.google_place_id) return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${space.google_place_id}`;
    if (space.latitude && space.longitude) return `https://www.google.com/maps/search/?api=1&query=${space.latitude},${space.longitude}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(space.address)}`;
};

// ==================================================
// חיפוש מרחבים 
// ==================================================
router.post('/search', async (req, res) => {
    const { required_facilities, user_lat, user_lng, radius_km } = req.body;

    try {
        let sqlSelect = `SELECT s.*, GROUP_CONCAT(DISTINCT f.facility_name SEPARATOR ', ') AS facilities_names`;

        if (user_lat && user_lng) {
            sqlSelect += `, ( 6371 * acos( cos( radians(?) ) * cos( radians( s.latitude ) ) * cos( radians( s.longitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( s.latitude ) ) ) ) AS distance`;
        } else {
            sqlSelect += `, NULL as distance`;
        }

        let sqlFrom = ` FROM spaces s LEFT JOIN space_facilities sf ON s.space_id = sf.space_id LEFT JOIN facilities f ON sf.facility_id = f.facility_id WHERE s.space_status = 'open'`;
        
        const params = [];
        if (user_lat && user_lng) params.push(user_lat, user_lng, user_lat);

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
        if (user_lat && user_lng && radius_km) {
            havingConditions.push(`distance < ?`);
            params.push(radius_km);
        }

        if (havingConditions.length > 0) finalSql += ` HAVING ` + havingConditions.join(' AND ');

        if (user_lat && user_lng) finalSql += ` ORDER BY distance ASC`;
        else finalSql += ` ORDER BY s.space_name ASC`;

        const [rows] = await db.query(finalSql, params);

        if (rows.length === 0) {
            if (user_lat && user_lng) {
                return res.json({ message: 'לא נמצאו מרחבים בקרבתך', results: [] });
            }
            return res.json({ message: 'לא נמצאו מרחבים קיימים', results: [] });
        }

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

        res.json({ results: enrichedResults });

    } catch (error) {
        console.error("Error searching spaces:", error);
        res.status(500).json({ message: 'שגיאה בחיפוש מרחבים' });
    }
});

// ==================================================
// קבלת רשימת פיצ'רים
// ==================================================
router.get('/facilities', async (req, res) => {
    try {
        const [facilities] = await db.query('SELECT * FROM facilities ORDER BY facility_name ASC');
        res.json(facilities);
    } catch (error) {
        console.error("Error fetching facilities:", error);
        res.status(500).json({ message: 'שגיאה בשליפת פיצ\'רים' });
    }
});

// ==================================================
//  הוספת מרחב 
// ==================================================
router.post('/add', verifyToken, async (req, res) => {
    if (req.user.user_type !== 'space_manager') {
        return res.status(403).json({ message: 'אין גישה: פעולה זו מותרת למנהלי מרחב בלבד.' });
    }

    const { 
        space_name, address, description, opening_hours, closing_hours, 
        seats_available, latitude, longitude, google_place_id, facilities 
    } = req.body;

    if (!space_name || !address || !seats_available) {
        return res.status(400).json({ message: 'חסרים שדות חובה' });
    }

    try {
        let checkSql = 'SELECT space_id FROM spaces WHERE (space_name = ? AND address = ?)';
        const checkParams = [space_name, address];
        if (google_place_id) {
            checkSql += ' OR google_place_id = ?';
            checkParams.push(google_place_id);
        }
        const [existing] = await db.query(checkSql, checkParams);
        if (existing.length > 0) return res.status(409).json({ message: 'המרחב כבר קיים במערכת' });

        const insertSql = `
            INSERT INTO spaces 
            (space_name, address, description, opening_hours, closing_hours, seats_available, latitude, longitude, google_place_id, space_status, manager_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
        `;

        const [result] = await db.query(insertSql, [
            space_name, address, description, opening_hours, closing_hours, 
            seats_available, latitude, longitude, google_place_id, req.user.user_id
        ]);

        const newSpaceId = result.insertId;

        if (facilities && Array.isArray(facilities) && facilities.length > 0) {
            const facilityValues = facilities.map(fId => [newSpaceId, fId]);
            await db.query('INSERT INTO space_facilities (space_id, facility_id) VALUES ?', [facilityValues]);
        }

        res.status(201).json({ message: 'המרחב נוסף בהצלחה', spaceId: newSpaceId });

    } catch (error) {
        console.error("Error adding space:", error);
        res.status(500).json({ message: 'שגיאה בהוספת המרחב' });
    }
});

// ==================================================
//   עריכת מרחב 
// ==================================================
router.put('/:id', verifyToken, async (req, res) => {
    const spaceId = req.params.id;
    const updates = req.body;
    const userId = req.user.user_id;

    try {
        const [spaceCheck] = await db.query('SELECT manager_id FROM spaces WHERE space_id = ?', [spaceId]);
        
        if (spaceCheck.length === 0) return res.status(404).json({ message: 'המרחב לא נמצא' });
        
        if (spaceCheck[0].manager_id !== userId && req.user.user_type !== 'admin') {
            return res.status(403).json({ message: 'אין לך הרשאה לערוך מרחב זה' });
        }

        const allowedFields = ['space_name', 'address', 'description', 'opening_hours', 'closing_hours', 'seats_available', 'space_status', 'latitude', 'longitude', 'google_place_id'];
        let updateQuery = 'UPDATE spaces SET ';
        const updateParams = [];
        let hasUpdates = false;

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateQuery += `${field} = ?, `;
                updateParams.push(updates[field]);
                hasUpdates = true;
            }
        }

        if (hasUpdates) {
            updateQuery = updateQuery.slice(0, -2) + ' WHERE space_id = ?';
            updateParams.push(spaceId);
            await db.query(updateQuery, updateParams);
        }

        if (updates.facilities && Array.isArray(updates.facilities)) {
            await db.query('DELETE FROM space_facilities WHERE space_id = ?', [spaceId]);
            if (updates.facilities.length > 0) {
                const facilityValues = updates.facilities.map(fId => [spaceId, fId]);
                await db.query('INSERT INTO space_facilities (space_id, facility_id) VALUES ?', [facilityValues]);
            }
        }

        res.json({ message: 'המרחב עודכן בהצלחה' });

    } catch (error) {
        console.error("Error updating space:", error);
        res.status(500).json({ message: 'שגיאה בעדכון המרחב' });
    }
});

// ==================================================
// מרחבים בניהולי (GET /my-managing) - חדש!
// ==================================================
router.get('/my-managing', verifyToken, async (req, res) => {
    const userId = req.user.user_id;

    try {
        const sql = `
            SELECT s.*, GROUP_CONCAT(DISTINCT f.facility_name SEPARATOR ', ') AS facilities_names
            FROM spaces s
            LEFT JOIN space_facilities sf ON s.space_id = sf.space_id
            LEFT JOIN facilities f ON sf.facility_id = f.facility_id
            WHERE s.manager_id = ?
            GROUP BY s.space_id
        `;
        const [spaces] = await db.query(sql, [userId]);
        res.json(spaces);
    } catch (error) {
        console.error("Error fetching managed spaces:", error);
        res.status(500).json({ message: 'שגיאה בשליפת המרחבים בניהולך' });
    }
});

module.exports = router;