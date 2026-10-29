const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

// Registro (Solo admin, pero permite el primero si la BD está vacía)
router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    // Verificar cuántos usuarios hay
    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM usuarios');
    const esPrimerUsuario = countRows[0].total === 0;

    if (!esPrimerUsuario) {
      // Si NO es el primero, verificamos que quien lo crea sea un admin logueado
      const authHeader = req.headers['authorization'];
      if (!authHeader) return res.status(401).json({ error: 'No autorizado' });
      
      try {
        const token = authHeader.split(' ')[1];
        const decodificado = jwt.verify(token, process.env.JWT_SECRET);
        if (decodificado.rol !== 'admin') {
          return res.status(403).json({ error: 'Solo los administradores pueden crear usuarios' });
        }
      } catch (err) {
        return res.status(403).json({ error: 'Token inválido' });
      }
    }

    const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existe.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)`,
      [nombre, email, hash, rol || 'jugador']
    );

    const [rows] = await pool.query('SELECT id, nombre, email, rol FROM usuarios WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login (se mantiene igual)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
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