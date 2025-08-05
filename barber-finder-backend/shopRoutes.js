const express = require('express');
const db = require('./db');
const router = express.Router();

// --- Define API Endpoints for Barber Shops ---

// GET /api/shops - Fetches all barber shops for the homepage
router.get('/shops', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM barber_shops ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/shops/:id - Fetches details for a single shop AND its barbers
router.get('/shops/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const shopResult = await db.query('SELECT * FROM barber_shops WHERE id = $1', [id]);
    if (shopResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    const shop = shopResult.rows[0];

    const barbersResult = await db.query('SELECT id, name, image_url FROM barbers WHERE shop_id = $1 ORDER BY name', [id]);
    shop.barbers = barbersResult.rows;

    res.json(shop);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/shops/:id/services - Fetches all services for a specific shop
router.get('/shops/:id/services', async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query('SELECT * FROM services WHERE shop_id = $1 ORDER BY price', [id]);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// GET /api/barbers/:barberId/availability - Fetches available slots for a specific barber on a specific date
router.get('/barbers/:barberId/availability', async (req, res) => {
    const { barberId } = req.params;
    const { date } = req.query;

    if (!date) {
        return res.status(400).send('A date query parameter is required.');
    }

    try {
        const scheduleQuery = 'SELECT start_time, end_time FROM barber_schedules WHERE barber_id = $1 AND schedule_date = $2 AND is_active = true';
        const scheduleResult = await db.query(scheduleQuery, [barberId, date]);

        if (scheduleResult.rows.length === 0) {
            return res.json([]);
        }
        const { start_time, end_time } = scheduleResult.rows[0];

        const appointmentsQuery = `SELECT appointment_time FROM appointments WHERE barber_id = $1 AND appointment_time::date = $2`;
        const { rows: existingAppointments } = await db.query(appointmentsQuery, [barberId, date]);
        const bookedTimes = existingAppointments.map(appt => new Date(appt.appointment_time).getTime());

        const availableSlots = [];
        const [startHour, startMinute] = start_time.split(':').map(Number);
        const [endHour, endMinute] = end_time.split(':').map(Number);

        let currentTime = new Date(`${date}T00:00:00.000Z`);
        currentTime.setUTCHours(startHour, startMinute);

        let endTime = new Date(`${date}T00:00:00.000Z`);
        endTime.setUTCHours(endHour, endMinute);

        while (currentTime < endTime) {
            if (!bookedTimes.includes(currentTime.getTime())) {
                availableSlots.push(currentTime.toISOString());
            }
            currentTime.setUTCMinutes(currentTime.getUTCMinutes() + 30);
        }

        res.json(availableSlots);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
