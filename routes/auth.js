const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Registro (primer admin). En producción debería protegerse.
router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const [existe] = await pool.query(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );
    if (existe.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES (?, ?, ?, ?)`,
      [nombre, email, hash, rol || 'jugador']
    );

    const [rows] = await pool.query(
      'SELECT id, nombre, email, rol FROM usuarios WHERE id = ?',
      [result.insertId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query(
      'SELECT * FROM usuarios WHERE email = ?',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, rol: user.rol, nombre: user.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, rol: user.rol, nombre: user.nombre });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;