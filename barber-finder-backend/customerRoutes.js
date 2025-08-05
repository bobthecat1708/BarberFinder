const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); 
const db = require('./db');
const customerAuth = require('./middleware/customerAuth'); // Import the customer auth middleware
const router = express.Router();

// --- Customer Sign Up ---
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const query = `
            INSERT INTO customers (name, email, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, name, email;
        `;
        const values = [name, email, passwordHash];
        const { rows } = await db.query(query, values);

        res.status(201).json({
            message: 'Customer account created successfully!',
            customer: rows[0]
        });

    } catch (err) {
        if (err.code === '23505') { // Handle unique email constraint
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Customer Login ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM customers WHERE email = $1', [email]);
        const customer = rows[0];

        if (!customer) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, customer.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const payload = { 
            customer: { 
                id: customer.id, 
                name: customer.name 
            } 
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '5h' },
            (err, token) => {
                if (err) throw err;
                res.json({ message: 'Login successful!', token });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// --- PROTECTED ROUTES ---

// POST /api/customers/appointments - Creates a new appointment for the logged-in customer
router.post('/appointments', customerAuth, async (req, res) => {
    const customerId = req.customer.id; // Get customer ID from the token
    const { barber_id, service_id, appointment_time } = req.body;

    if (!barber_id || !service_id || !appointment_time) {
        return res.status(400).json({ error: 'Missing required appointment details.' });
    }
    try {
        const query = `
            INSERT INTO appointments (barber_id, service_id, appointment_time, customer_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const values = [barber_id, service_id, appointment_time, customerId];
        const { rows } = await db.query(query, values);
        res.status(201).json({
            message: 'Appointment created successfully!',
            appointment: rows[0]
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// GET /api/customers/bookings - Fetches all bookings for the logged-in customer
router.get('/bookings', customerAuth, async (req, res) => {
    const customerId = req.customer.id;
    try {
        const query = `
            SELECT 
                a.appointment_time,
                a.status,
                s.name as service_name,
                b.name as barber_name,
                bs.name as shop_name,
                bs.address as shop_address
            FROM appointments a
            JOIN services s ON a.service_id = s.id
            JOIN barbers b ON a.barber_id = b.id
            JOIN barber_shops bs ON b.shop_id = bs.id
            WHERE a.customer_id = $1
            ORDER BY a.appointment_time DESC;
        `;
        const { rows } = await db.query(query, [customerId]);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// GET /api/customers/favourites - Fetches all favourite shops for the logged-in customer
router.get('/favourites', customerAuth, async (req, res) => {
    const customerId = req.customer.id;
    try {
        const query = `
            SELECT bs.* FROM barber_shops bs
            JOIN favourite_shops fs ON bs.id = fs.shop_id
            WHERE fs.customer_id = $1;
        `;
        const { rows } = await db.query(query, [customerId]);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// POST /api/customers/favourites - Adds a shop to the customer's favourites
router.post('/favourites', customerAuth, async (req, res) => {
    const customerId = req.customer.id;
    const { shop_id } = req.body;
    if (!shop_id) {
        return res.status(400).json({ error: 'shop_id is required.' });
    }
    try {
        const query = `
            INSERT INTO favourite_shops (customer_id, shop_id)
            VALUES ($1, $2)
            RETURNING *;
        `;
        const { rows } = await db.query(query, [customerId, shop_id]);
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') { // Handle already favourited
            return res.status(409).json({ error: 'Shop is already in favourites.' });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// DELETE /api/customers/favourites/:shopId - Removes a shop from favourites
router.delete('/favourites/:shopId', customerAuth, async (req, res) => {
    const customerId = req.customer.id;
    const { shopId } = req.params;
    try {
        const query = `
            DELETE FROM favourite_shops
            WHERE customer_id = $1 AND shop_id = $2
            RETURNING *;
        `;
        const { rows } = await db.query(query, [customerId, shopId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Favourite not found.' });
        }
        res.json({ message: 'Removed from favourites.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


module.exports = router;
