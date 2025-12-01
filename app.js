require('dotenv').config(); 
const express = require('express');
const app = express(); 

const authRoutes = require('./routes/auth'); 
const spaceRoutes = require('./routes/spaces'); 
const orderRoutes = require('./routes/orders'); 
const communityRoutes = require('./routes/communities');

app.use(express.json()); 

app.use('/api/auth', authRoutes);
app.use('/api/spaces', spaceRoutes); 
app.use('/api/orders', orderRoutes); 
app.use('/api/communities', communityRoutes);

app.get('/', (req, res) => {
    res.send('CONET Server is running correctly!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
//