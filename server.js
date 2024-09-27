const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');

const app = express();
const upload = multer();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
    user: 'postgres',          // Replace with your PostgreSQL user
    host: 'localhost',
    database: 'postgres',      // Replace with your database name
    password: 'admin',         // Replace with your password
    port: 5432,
});

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the root, lib, and images directories
app.use(express.static(path.join(__dirname))); // This serves files from the root
app.use('/lib', express.static(path.join(__dirname, 'lib'))); // This serves files from lib
app.use('/images', express.static(path.join(__dirname, 'images'))); // This serves files from images

// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// Registration endpoint
app.post('/register', async (req, res) => {
    const { email, password, userType } = req.body; // Get userType from request

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into database
    try {
        const result = await pool.query(
            'INSERT INTO usersLogin (email, password, user_type) VALUES ($1, $2, $3) RETURNING *',
            [email, hashedPassword, userType] // Store userType in the database
        );
        res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
    } catch (err) {
        // Handle specific error cases
        if (err.code === '23505') { // Unique violation
            res.status(409).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});


// Login endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Fetch user by email
        const result = await pool.query('SELECT * FROM usersLogin WHERE email = $1', [email]);
        const user = result.rows[0];

        if (user) {
            // Compare hashed password
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                // Redirect based on user type
                const redirectPage = user.user_type === 'employer' ? 'Employer.html' : 'Job%20Seeker.html';
                res.json({ message: 'Login successful', redirect: redirectPage });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload route
app.post('/upload', upload.single('file'), async (req, res) => {
    const { password } = req.body;
    const { originalname, buffer } = req.file;

    try {
        const result = await pool.query(
            'INSERT INTO resumes (filename, filedata, password) VALUES ($1, $2, $3) RETURNING *',
            [originalname, buffer, password]
        );
        res.json({ message: 'File uploaded successfully!', id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error uploading file' });
    }
});

// Get resumes by password
app.get('/resumes', async (req, res) => {
    const { password } = req.query;

    try {
        const result = await pool.query(
            'SELECT * FROM resumes WHERE password = $1',
            [password]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error retrieving resumes' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
