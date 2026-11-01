const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

// Registro (Solo admin, pero permite el primero si la BD está vacía)
router.post('/registro', async (req, res) => {
  try {
    const { nombre, email, password, rol, telefono, direccion, dni } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    // 1. VALIDACIÓN: Buscamos si el email O el DNI ya existen
    const [existeEmail] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existeEmail.length > 0) {
      return res.status(400).json({ error: 'El correo ya está registrado con otro usuario.' });
    }

    if (dni) {
      const [existeDni] = await pool.query('SELECT id FROM usuarios WHERE dni = ?', [dni]);
      if (existeDni.length > 0) {
        return res.status(400).json({ error: 'El DNI/Documento ya está registrado con otro usuario.' });
      }
    }

    // 2. Si pasa las validaciones, encriptamos y creamos al usuario
    const hash = await bcrypt.hash(password, 10);
    const rolFinal = rol || 'padre'; // Por defecto será padre ahora

    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, direccion, dni) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre, email, hash, rolFinal, telefono || null, direccion || null, dni || null]
    );

    // Si es jugador (aunque ahora se crean desde Familias, mantenemos la lógica por si acaso)
    if (rolFinal === 'jugador') {
      await pool.query(
        `INSERT INTO jugadores (usuario_id, categoria, posicion, dorsal) 
         VALUES (?, 'Sin categoría', 'Por definir', 0)`,
        [result.insertId]
      );
    }

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