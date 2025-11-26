require('dotenv').config(); 
const express = require('express');
const app = express(); 

// 1. ייבוא קבצי ה-Routes
const authRoutes = require('./routes/auth'); 
const spaceRoutes = require('./routes/spaces'); // <-- חדש: חיפוש מרחבים
const orderRoutes = require('./routes/orders'); // <-- חדש: ניהול הזמנות

app.use(express.json()); 

// 2. הגדרת הנתיבים (Mounting)
app.use('/api/auth', authRoutes);
app.use('/api/spaces', spaceRoutes); // כל הבקשות ל-/api/spaces יגיעו ל-spaces.js
app.use('/api/orders', orderRoutes); // כל הבקשות ל-/api/orders יגיעו ל-orders.js

// נתיב ברירת מחדל לבדיקה שהשרת חי
app.get('/', (req, res) => {
    res.send('CONET Server is running correctly!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});