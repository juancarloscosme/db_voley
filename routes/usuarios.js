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

// Dar de baja (Desactivar) o Reactivar
router.put('/:id/estado', permitirRoles('admin'), async (req, res) => {
  try {
    const { activo } = req.body; // Recibe 1 (activo) o 0 (inactivo)
    await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo, req.params.id]);
    const [rows] = await pool.query(
      'SELECT id, nombre, activo FROM usuarios WHERE id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar usuario definitivamente
router.delete('/:id', permitirRoles('admin'), async (req, res) => {
  try {
    // Gracias al ON DELETE CASCADE en tu base de datos, si es jugador 
    // también se borrarán sus pagos y asistencias.
    await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener lista de jugadores para el select de pagos
router.get('/jugadores', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT j.id, u.nombre 
       FROM jugadores j 
       JOIN usuarios u ON j.usuario_id = u.id
       WHERE u.activo = 1` // Solo muestra jugadores activos
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;