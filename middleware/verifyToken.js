const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const tokenHeader = req.headers['authorization'];
    
    if (!tokenHeader) {
        return res.status(403).send({ message: 'נדרש טוקן לאימות' });
    }

    try {
        const token = tokenHeader.split(' ')[1]; 
        if (!token) return res.status(403).send({ message: 'פורמט טוקן לא תקין' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; 
        next();
    } catch (err) {
        return res.status(401).send({ message: 'טוקן לא תקין או פג תוקף' });
    }
};

module.exports = verifyToken;
//