require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const cors = require('cors')

// ייבוא הראוטרים של ה-API
const authRoutes = require('./routes/auth');
const spaceRoutes = require('./routes/spaces');
const { router: orderRoutes } = require('./routes/orders');
const communityRoutes = require('./routes/communities');
const eventRoutes = require('./routes/events');

app.use(cors())

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
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// דף האירועים
app.get('/events', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'events.html'));
});

// דף החיפוש
app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'search.html'));
});

// דף פרופיל אישי
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'Holistic_profile.html'));
});

// דף הוספת מרחב
app.get('/add_space', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'add_space.html'));
});

// דף התחברות והרשמה
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

// דף הוספת קהילה
app.get('/add_community', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'add-community.html'));
});

// דף הזמנת מרחב
app.get('/book_space', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'book-space.html'));
});

// דף הרשמה
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'signup.html'));
});

// דף התחברות
app.get('/signin', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'signin.html'));
});

// הפעלת השרת
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});