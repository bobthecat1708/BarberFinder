// Import the express library to create a router
const express = require('express');
// Import the database query function
const db = require('./db');

// Create a new router object
const router = express.Router();

// --- Define API Endpoints for Barbers ---

// GET /api/barbers - Fetches all barbers from the database
router.get('/barbers', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM barbers ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/barbers/:id - Fetches a single barber by their ID
router.get('/barbers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM barbers WHERE id = $1', [id]);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).send('Barber not found');
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/barbers/:id/services - Fetches all services for a specific barber
router.get('/barbers/:id/services', async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await db.query('SELECT * FROM services WHERE barber_id = $1 ORDER BY price', [id]);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// GET /api/barbers/:id/availability - A simple endpoint to check available slots for a given day
router.get('/barbers/:id/availability', async (req, res) => {
    const { id } = req.params;
    const { date } = req.query; // e.g., ?date=2024-07-21

    if (!date) {
        return res.status(400).send('Date query parameter is required.');
    }

    try {
        // Get existing appointments for that barber on that day
        const query = `
            SELECT appointment_time 
            FROM appointments 
            WHERE barber_id = $1 AND appointment_time::date = $2
        `;
        const { rows: existingAppointments } = await db.query(query, [id, date]);
        const bookedTimes = existingAppointments.map(appt => appt.appointment_time);

        // --- Simple Availability Logic ---
        // Assume the barber works 9 AM to 5 PM (17:00)
        const availableSlots = [];
        const startHour = 9;
        const endHour = 17;

        for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += 30) { // 30-minute slots
                const slotTime = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`);
                
                // Check if this slot is already booked
                const isBooked = bookedTimes.some(booked => new Date(booked).getTime() === slotTime.getTime());

                if (!isBooked) {
                    availableSlots.push(slotTime.toISOString());
                }
            }
        }

        res.json(availableSlots);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- NEW ROUTE TO CREATE AN APPOINTMENT ---
// POST /api/appointments - Creates a new appointment
router.post('/appointments', async (req, res) => {
    // Get the booking details from the request body
    const { barber_id, service_id, appointment_time } = req.body;

    // Basic validation to ensure we have the required data
    if (!barber_id || !service_id || !appointment_time) {
        return res.status(400).json({ error: 'Missing required appointment details.' });
    }

    try {
        // SQL query to insert a new appointment into the database
        const query = `
            INSERT INTO appointments (barber_id, service_id, appointment_time, user_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *; 
        `;
        // We use a placeholder '1' for user_id since we don't have user accounts yet
        const values = [barber_id, service_id, appointment_time, 1]; 

        const { rows } = await db.query(query, values);

        // Send a success response with the newly created appointment
        res.status(201).json({
            message: 'Appointment created successfully!',
            appointment: rows[0]
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// Export the router to be used in server.js
module.exports = router;
