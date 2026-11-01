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

    // 1. Buscamos si el correo ya existe Y su estado
    const [existe] = await pool.query('SELECT id, activo FROM usuarios WHERE email = ?', [email]);
    
    if (existe.length > 0) {
      const usuarioExistente = existe[0];

      // Si está ACTIVO, lanzamos el error normal
      if (usuarioExistente.activo === 1) {
        return res.status(400).json({ error: 'El email ya está registrado' });
      } 
      
      // Si está DE BAJA, lo actualizamos y lo reactivamos
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `UPDATE usuarios 
         SET nombre = ?, password_hash = ?, rol = ?, telefono = ?, direccion = ?, dni = ?, activo = 1 
         WHERE id = ?`,
        [nombre, hash, rol || 'jugador', telefono, direccion, dni, usuarioExistente.id]
      );

      // Si es jugador, nos aseguramos que tenga su perfil
      if (rol === 'jugador') {
        const [perfil] = await pool.query('SELECT id FROM jugadores WHERE usuario_id = ?', [usuarioExistente.id]);
        if (perfil.length === 0) {
          await pool.query(
            `INSERT INTO jugadores (usuario_id, categoria, posicion, dorsal) VALUES (?, 'Sin categoría', 'Por definir', 0)`,
            [usuarioExistente.id]
          );
        }
      }
      
      return res.json({ mensaje: 'Usuario reactivado y actualizado' });
    }

    // 2. Si el correo no existe, lo creamos desde cero (código normal)
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, direccion, dni) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre, email, hash, rol || 'jugador', telefono, direccion, dni]
    );

    if (rol === 'jugador') {
      await pool.query(
        `INSERT INTO jugadores (usuario_id, categoria, posicion, dorsal) VALUES (?, 'Sin categoría', 'Por definir', 0)`,
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