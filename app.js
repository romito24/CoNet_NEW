require('dotenv').config(); 
const express = require('express');
const app = express(); 
const db = require('./db'); // ייבוא החיבור מהקובץ החדש
const authRoutes = require('./routes/auth'); // ייבוא קובץ ה-API שיצרנו

app.use(express.json()); 

// חיבור ה-Routes של האותנטיקציה
// כל הנתיבים בתוך auth.js יתחילו ב- /api/auth
// לדוגמה: /api/auth/register, /api/auth/login
app.use('/api/auth', authRoutes);

// בדיקת שרת פשוטה
app.get('/', (req, res) => {
    res.send('CONET Server is running');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});