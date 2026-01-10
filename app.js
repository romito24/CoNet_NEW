require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const http = require('http'); 
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server);

// ייבוא הראוטרים של ה-API
const authRoutes = require('./routes/auth');
const spaceRoutes = require('./routes/spaces');
const { router: orderRoutes } = require('./routes/orders');
const communityRoutes = require('./routes/communities');
const eventRoutes = require('./routes/events');
const chatModule = require('./routes/chat');

app.use(express.json());

// --- הגדרת תיקיית הקבצים הסטטיים (CSS, JS, Images) ---
app.use(express.static(path.join(__dirname, 'public')));

// --- ניתובי API (מחזירים JSON) ---
app.use('/api/auth', authRoutes);
app.use('/api/spaces', spaceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/chat', chatModule.router);

// --- הפעלת ה-Socket (חלק ה-Real Time) ---
chatModule.initSocket(io);

// --- ניתובי UI (מחזירים דפי HTML) ---

// דף הבית
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// דף האירועים
app.get('/events', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'events.html'));
});

// דף החיפוש
app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'search.html'));
});


// דף הוספת מרחב
app.get('/add_space', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'add_space.html'));
});

// דף התחברות 
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// דף הרשמה 
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// עמוד פרופיל הוליסטי
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Holistic_profile.html'));
});

// דף הקהילות
app.get('/communities', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'communities.html'));
});

// צ'אט קהילה
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// דף הזמנה
app.get('/new_order', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'new_order.html'));
});

// דף יצירת אירוע
app.get('/new_event', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'new_event.html'));
});

// דף הוספת קהילה
app.get('/add_community', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'new_community.html'));
});

// דף מרחבים
app.get('/spaces', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'search.html'));
});

// הפעלת השרת
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});