const express = require('express');
const router = express.Router();
const db = require('./db');
const auth = require('./middleware/auth');

// --- BARBER MANAGEMENT ---
router.get('/barbers', auth, async (req, res) => {
    try {
        const shopId = req.shop.id;
        const { rows } = await db.query('SELECT id, name, image_url FROM barbers WHERE shop_id = $1 ORDER BY name', [shopId]);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.post('/barbers', auth, async (req, res) => {
    const { name, image_url } = req.body;
    const shopId = req.shop.id;
    if (!name) return res.status(400).json({ error: 'Barber name is required.' });
    try {
        const query = `INSERT INTO barbers (name, shop_id, image_url) VALUES ($1, $2, $3) RETURNING *;`;
        const { rows } = await db.query(query, [name, shopId, image_url]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- NEW ---
// PUT /api/dashboard/barbers/:id - Updates a barber's details
router.put('/barbers/:id', auth, async (req, res) => {
    const { id } = req.params;
    const { name, image_url } = req.body;
    const shopId = req.shop.id;

    if (!name) {
        return res.status(400).json({ error: 'Barber name is required.' });
    }

    try {
        const query = `
            UPDATE barbers 
            SET name = $1, image_url = $2 
            WHERE id = $3 AND shop_id = $4 
            RETURNING *;
        `;
        const { rows } = await db.query(query, [name, image_url, id, shopId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Barber not found in your shop.' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


router.delete('/barbers/:id', auth, async (req, res) => {
    const { id } = req.params;
    const shopId = req.shop.id;
    try {
        const query = 'DELETE FROM barbers WHERE id = $1 AND shop_id = $2 RETURNING *;';
        const { rows } = await db.query(query, [id, shopId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Barber not found in your shop.' });
        res.json({ message: 'Barber deleted successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- APPOINTMENTS, SCHEDULES, SERVICES (No changes to these routes) ---
router.get('/appointments', auth, async (req, res) => {
    try {
        const shopId = req.shop.id;
        const query = `
            SELECT a.id, a.appointment_time, s.name as service_name, b.name as barber_name
            FROM appointments a
            JOIN services s ON a.service_id = s.id
            JOIN barbers b ON a.barber_id = b.id
            WHERE b.shop_id = $1
            ORDER BY a.appointment_time DESC;
        `;
        const { rows } = await db.query(query, [shopId]);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.get('/schedule', auth, async (req, res) => {
    try {
        const shopId = req.shop.id;
        const query = `
            SELECT s.* FROM barber_schedules s
            JOIN barbers b ON s.barber_id = b.id
            WHERE b.shop_id = $1
        `;
        const { rows } = await db.query(query, [shopId]);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.post('/schedule', auth, async (req, res) => {
    const shopId = req.shop.id;
    const { schedulesByBarber, startDate, endDate } = req.body;
    if (!schedulesByBarber || !startDate || !endDate) {
        return res.status(400).json({ error: 'schedulesByBarber, startDate, and endDate data is required.' });
    }
    try {
        await db.query('BEGIN');
        const { rows: shopBarbers } = await db.query('SELECT id FROM barbers WHERE shop_id = $1', [shopId]);
        const shopBarberIds = shopBarbers.map(b => b.id);
        const deleteQuery = `
            DELETE FROM barber_schedules 
            WHERE barber_id = ANY($1::int[])
            AND schedule_date >= $2 AND schedule_date <= $3;
        `;
        await db.query(deleteQuery, [shopBarberIds, startDate, endDate]);
        for (const barberId in schedulesByBarber) {
            if (shopBarberIds.includes(parseInt(barberId))) {
                const schedule = schedulesByBarber[barberId];
                for (const day of schedule) {
                    if (day.is_active) {
                        const insertQuery = `
                            INSERT INTO barber_schedules (barber_id, schedule_date, start_time, end_time, is_active)
                            VALUES ($1, $2, $3, $4, $5)
                        `;
                        await db.query(insertQuery, [barberId, day.schedule_date, day.start_time, day.end_time, day.is_active]);
                    }
                }
            }
        }
        await db.query('COMMIT');
        res.status(200).json({ message: 'All schedules updated successfully!' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.get('/services', auth, async (req, res) => {
    try {
        const shopId = req.shop.id;
        const { rows } = await db.query('SELECT * FROM services WHERE shop_id = $1 ORDER BY name', [shopId]);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.post('/services', auth, async (req, res) => {
    const { name, price, duration_minutes } = req.body;
    const shopId = req.shop.id;
    if (!name || !price || !duration_minutes) {
        return res.status(400).json({ error: 'Name, price, and duration are required.' });
    }
    try {
        const query = `
            INSERT INTO services (name, price, duration_minutes, shop_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const { rows } = await db.query(query, [name, price, duration_minutes, shopId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.put('/services/:id', auth, async (req, res) => {
    const { id } = req.params;
    const { name, price, duration_minutes } = req.body;
    const shopId = req.shop.id;
    if (!name || !price || !duration_minutes) {
        return res.status(400).json({ error: 'Name, price, and duration are required.' });
    }
    try {
        const query = `
            UPDATE services
            SET name = $1, price = $2, duration_minutes = $3
            WHERE id = $4 AND shop_id = $5
            RETURNING *;
        `;
        const { rows } = await db.query(query, [name, price, duration_minutes, id, shopId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Service not found in your shop.' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.delete('/services/:id', auth, async (req, res) => {
    const { id } = req.params;
    const shopId = req.shop.id;
    try {
        const query = 'DELETE FROM services WHERE id = $1 AND shop_id = $2 RETURNING *;';
        const { rows } = await db.query(query, [id, shopId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Service not found in your shop.' });
        res.json({ message: 'Service deleted successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
