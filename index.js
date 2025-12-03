const express = require('express');
const pronote = require('pronote-api-maintained');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
// CRITICAL: Enables cross-origin requests from your InfinityFree domain
app.use(cors()); 
app.use(bodyParser.json());

// Helper function to get the date range (Today and Tomorrow)
const getTodayAndTomorrowRange = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1); // Look ahead for the next day's schedule
    return { from: now, to: tomorrow };
};

app.post('/sync', async (req, res) => {
    const { url, username, password, cas } = req.body;

    try {
        // 1. Attempt Pronote connection
        const session = await pronote.login(url, username, password, cas || 'none');
        
        // 2. Fetch Timetable for the next 24 hours
        const { from, to } = getTodayAndTomorrowRange();
        const timetable = await session.timetable(from, to);

        // 3. Filter: Keep only future classes that are NOT cancelled (Absent Teacher Logic)
        const validClasses = timetable.filter(c => {
            const isFuture = c.from > new Date();
            const isNotCancelled = !c.isCancelled;
            // Also skip if it's a duplicate entry (common Pronote issue)
            const isNotDuplicate = !c.hasDuplicate;
            return isFuture && isNotCancelled && isNotDuplicate;
        });

        // 4. Sort to find the very first class
        validClasses.sort((a, b) => a.from - b.from);

        session.logout();

        res.json({
            success: true,
            // Return the very first valid class
            nextClass: validClasses.length > 0 ? validClasses[0] : null
        });

    } catch (err) {
        console.error("Pronote Login/Sync Error:", err.message);
        // Send a 401 response for clearer debugging on the client side
        res.status(401).json({ 
            success: false, 
            error: "Login Failed or API Error",
            message: err.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`C'LHEURE API running on port ${PORT}`));