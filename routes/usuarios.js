const router = require('express').Router();
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

router.use(verificarToken);

// Listar usuarios (solo admin)
router.get('/', permitirRoles('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, email, rol, activo FROM usuarios ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cambiar rol
router.put('/:id/rol', permitirRoles('admin'), async (req, res) => {
  try {
    const { rol } = req.body;
    await pool.query('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, req.params.id]);
    const [rows] = await pool.query(
      'SELECT id, nombre, rol FROM usuarios WHERE id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Desactivar usuario
router.put('/:id/desactivar', permitirRoles('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [req.params.id]);
    const [rows] = await pool.query(
      'SELECT id, nombre, activo FROM usuarios WHERE id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;