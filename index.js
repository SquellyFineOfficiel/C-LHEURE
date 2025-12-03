const express = require('express');
const pronote = require('pronote-api-maintained');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
// ALLOW CORS so your InfinityFree site can talk to this
app.use(cors());
app.use(bodyParser.json());

app.post('/sync', async (req, res) => {
    // CAS is the specific login method for your region (e.g., ac-bordeaux)
    // Most users don't know it, so we default to 'none' or try to auto-detect in a real app
    const { url, username, password, cas } = req.body;

    try {
        const session = await pronote.login(url, username, password, cas || 'none');
        
        // Get tomorrow's date for the alarm
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const timetable = await session.timetable(today, tomorrow);

        // Filter: Keep only future classes that are NOT cancelled
        // This handles the "Absent Teacher" logic automatically
        const validClasses = timetable.filter(c => {
            const isFuture = c.from > new Date();
            const isNotCancelled = !c.isCancelled;
            return isFuture && isNotCancelled;
        });

        // Sort by time
        validClasses.sort((a, b) => a.from - b.from);

        session.logout();

        res.json({
            success: true,
            // Return the very first class available
            nextClass: validClasses.length > 0 ? validClasses[0] : null
        });

    } catch (err) {
        console.error(err);
        res.status(401).json({ success: false, error: "Login Failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));