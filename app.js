require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

// ייבוא הראוטרים של ה-API
const authRoutes = require('./routes/auth');
const spaceRoutes = require('./routes/spaces');
const { router: orderRoutes } = require('./routes/orders');
const communityRoutes = require('./routes/communities');
const eventRoutes = require('./routes/events');

app.use(express.json());

// --- הגדרת תיקיית הקבצים הסטטיים (CSS, JS, Images) ---
app.use(express.static(path.join(__dirname, 'public')));

// --- ניתובי API (מחזירים JSON) ---
app.use('/api/auth', authRoutes);
app.use('/api/spaces', spaceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/events', eventRoutes);

// --- ניתובי UI (מחזירים דפי HTML) ---

// דף הבית
app.get('/', (req, res) => {
    res.send('CONET Server is running correctly!');
});

// דף האירועים
app.get('/events', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'events.html'));
});

// דף החיפוש
app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'search.html'));
});

// דף פרופיל אישי
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'private_user_profile.html'));
});

// דף הוספת מרחב
app.get('/add_space', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'add_space.html'));
});

// הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});