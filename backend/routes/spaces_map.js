// controllers/spacesController.js
// ודאו שאתם מייבאים את מודול החיבור ל-DB שלכם (pool)
// לדוגמה:
// const db = require('../db'); 

/**
 * פונקציית עזר לבניית קישור לגוגל מפות.
 * משתמשת ב-google_place_id או ב-latitude/longitude.
 */
const buildGoogleMapsUrl = (space) => {
    // עדיפות ל-Place ID
    if (space.google_place_id) {
        // דוגמה ל-URL: https://maps.google.com/?q=place_id:ChIJ-d91n8nEHRURyN6wA7_u84w
        return `https://www.google.com/maps/search/?api=1&query=1$?q=place_id:${space.google_place_id}`;
    }
    // גיבוי לקואורדינטות
    if (space.latitude && space.longitude) {
        // דוגמה ל-URL: https://maps.google.com/?q=32.0678,34.7876
        return `https://www.google.com/maps/search/?api=1&query=0?q=${space.latitude},${space.longitude}`;
    }
    return null;
};

/**
 * GET /api/spaces
 * אחזור מרחבים למפה, עם סינון AND לפי facilities.
 * פרמטר שאילתה: facility_ids (לדוגמה: 1,3,5)
 */
exports.getSpacesForMap = async (req, res) => {
    // קליטת פרמטר הסינון מה-Query String
    const { facility_ids } = req.query; 

    try {
        let sql = `
            SELECT
                s.space_id,
                s.space_name,
                s.address,
                s.latitude,
                s.longitude,
                s.google_place_id,
                GROUP_CONCAT(DISTINCT f.facility_name SEPARATOR '$$') AS facilities_names
            FROM
                spaces s
            LEFT JOIN
                space_facilities sf ON s.space_id = sf.space_id
            LEFT JOIN
                facilities f ON sf.facility_id = f.facility_id
        `;
        
        const sqlParams = [];
        let whereClause = '';
        let havingClause = '';

        // --- לוגיקת סינון לפי facilities ---
        if (facility_ids) {
            // ממיר את המחרוזת לרשימה נקייה של מזהי מספרים שלמים
            const requiredFacilities = facility_ids.split(',')
                .map(id => parseInt(id.trim()))
                .filter(id => !isNaN(id) && id > 0);
            
            if (requiredFacilities.length > 0) {
                
                // 1. WHERE: מסנן את ה-JOIN לכל הרשומות המכילות *אחד או יותר* מהמתקנים המבוקשים
                // ה-? מונעים SQL Injection
                whereClause = `WHERE sf.facility_id IN (${requiredFacilities.map(() => '?').join(',')})`;
                sqlParams.push(...requiredFacilities);

                // 2. HAVING: מוודא שכל מרחב מכיל *את כל* המתקנים המבוקשים (סינון AND)
                havingClause = `HAVING COUNT(DISTINCT sf.facility_id) = ?`;
                sqlParams.push(requiredFacilities.length);
            }
        }
        
        // --- הרכבת וביצוע השאילתה הסופית ---
        sql += `
            ${whereClause}
            GROUP BY
                s.space_id, s.space_name, s.address, s.latitude, s.longitude, s.google_place_id
            ${havingClause}
        `;

        const [rows] = await db.query(sql, sqlParams); // השתמשו במתודת ה-DB הקיימת שלכם

        // --- עיבוד ומיפוי הנתונים לפורמט JSON סופי ---
        const spacesData = rows.map(space => {
            // הפיכת המחרוזת המאוחדת בחזרה למערך שמות
            const facilitiesNames = space.facilities_names ? space.facilities_names.split('$$') : [];

            return {
                space_id: space.space_id,
                space_name: space.space_name,
                address: space.address,
                latitude: space.latitude,
                longitude: space.longitude,
                google_maps_url: buildGoogleMapsUrl(space),
                // יצירת קישור לדף ההזמנה עם ה-ID לצורך המשך
                booking_url: `/booking.html?space_id=${space.space_id}`, 
                facilities: facilitiesNames.filter(name => name.length > 0)
            };
        });

        res.json(spacesData);

    } catch (error) {
        console.error('שגיאה באחזור וסינון מרחבים:', error);
        // שליחת תגובת שגיאה למקרה של תקלה
        res.status(500).json({ message: 'שגיאה בשרת בעת אחזור נתוני מרחבים' });
    }
};

/**
 * GET /api/spaces/facilities
 * מומלץ: אחזור רשימת כל המתקנים לצורך בניית כלי הסינון ב-Frontend
 */
exports.getFacilities = async (req, res) => {
    try {
        const sql = `SELECT facility_id, facility_name FROM facilities ORDER BY facility_name`;
        const [rows] = await db.query(sql); // השתמשו במתודת ה-DB הקיימת שלכם
        res.json(rows);
    } catch (error) {
        console.error('שגיאה באחזור מתקנים:', error);
        res.status(500).json({ message: 'שגיאה בשרת בעת אחזור נתוני מתקנים' });
    }
};