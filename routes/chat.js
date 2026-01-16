const express = require('express');
const router = express.Router();
const db = require('../db'); 

// שליפת היסטוריה
router.get('/history/:communityId', async (req, res) => {
    const { communityId } = req.params;
    
    const sql = `
        SELECT m.*, u.first_name, u.last_name 
        FROM community_messages m
        JOIN users u ON m.user_id = u.user_id
        WHERE m.community_id = ? 
        ORDER BY m.created_at ASC
    `;
    
    try {
        const [rows] = await db.execute(sql, [communityId]);
        res.json(rows);
    } catch (err) {
        console.error("Error fetching chat history:", err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Socket.io Real-Time
function initSocket(io) {
    io.on('connection', (socket) => {
        console.log('User connected to chat namespace:', socket.id);

        // הצטרפות לחדר
        socket.on('join_community', (communityId) => {
            socket.join(communityId);
            console.log(`Socket ${socket.id} joined room ${communityId}`);
        });

        // שליחת הודעה
        socket.on('send_message', async (data) => {
            const { communityId, userId, userName, message } = data;
            
            // שמירה ב-DB
            const insertQuery = `INSERT INTO community_messages (community_id, user_id, user_name, message_text) VALUES (?, ?, ?, ?)`;
            try {
                await db.execute(insertQuery, [communityId, userId, userName, message]);
                
                // שידור לכולם בחדר
                io.to(communityId).emit('receive_message', data);
            } catch (err) {
                console.error("Error saving message via socket:", err);
            }
        });
    });
}


module.exports = { router, initSocket };