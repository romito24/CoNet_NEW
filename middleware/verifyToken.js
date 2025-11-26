const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // הלקוח שולח את הטוקן ב-Header בצורה: "Bearer <token>"TEST
    const tokenHeader = req.headers['authorization'];
    
    if (!tokenHeader) {
        return res.status(403).send({ message: 'נדרש טוקן לאימות' });
    }

    try {
        const token = tokenHeader.split(' ')[1]; // חילוץ הטוקן נטו
        if (!token) return res.status(403).send({ message: 'פורמט טוקן לא תקין' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // שמירת פרטי המשתמש בבקשה
        next();
    } catch (err) {
        return res.status(401).send({ message: 'טוקן לא תקין או פג תוקף' });
    }
};

module.exports = verifyToken;