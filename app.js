require('dotenv').config(); 
const express = require('express');
const path = require('path');
const app = express(); 

const authRoutes = require('./routes/auth'); 
const spaceRoutes = require('./routes/spaces');
const { router: orderRoutes } = require('./routes/orders'); 
const communityRoutes = require('./routes/communities');
const eventRoutes = require('./routes/events'); 

app.use(express.json()); 

app.use('/api/auth', authRoutes);
app.use('/api/spaces', spaceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/events', eventRoutes); 

app.get('/', (req, res) => {
    res.send('CONET Server is running correctly!');
});

app.use(express.static(path.join(__dirname, 'public')));

const path = require('path');
// הגדרת התיקייה public כתיקייה סטטית
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});