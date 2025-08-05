const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); 
const db = require('./db');
const router = express.Router();

// --- Barber Shop Sign Up ---
// This route now creates a new record in the 'barber_shops' table.
router.post('/signup', async (req, res) => {
    const { name, address, email, password } = req.body;

    if (!name || !address || !email || !password) {
        return res.status(400).json({ error: 'Shop name, address, email, and password are required.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const query = `
            INSERT INTO barber_shops (name, address, email, password_hash)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, email;
        `;
        const values = [name, address, email, passwordHash];
        const { rows } = await db.query(query, values);

        res.status(201).json({
            message: 'Barber shop account created successfully!',
            shop: rows[0]
        });

    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// --- Barber Shop Login ---
// This route now queries the 'barber_shops' table.
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM barber_shops WHERE email = $1', [email]);
        const shop = rows[0];

        if (!shop) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, shop.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // The token payload now contains the shop's ID and name.
        const payload = { 
            shop: { 
                id: shop.id, 
                name: shop.name 
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


module.exports = router;
