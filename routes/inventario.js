const router = require('express').Router();
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

router.use(verificarToken);

// Listar inventario
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM inventario ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear item
// Crear item
router.post('/', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const { item, categoria, cantidad, estado, vida_util_meses, proveedor, fecha_ingreso } = req.body;
    const [result] = await pool.query(
      `INSERT INTO inventario (item, categoria, cantidad, estado, vida_util_meses, proveedor, fecha_ingreso)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item, categoria, cantidad, estado, vida_util_meses, proveedor, fecha_ingreso || null]
    );
    const [rows] = await pool.query('SELECT * FROM inventario WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Prestar item
router.put('/:id/prestar', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const { usuario_id } = req.body;
    await pool.query(
      'UPDATE inventario SET prestado_a = ? WHERE id = ?',
      [usuario_id, req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM inventario WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Devolver item
router.put('/:id/devolver', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE inventario SET prestado_a = NULL WHERE id = ?',
      [req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM inventario WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar item del inventario
router.delete('/:id', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    await pool.query('DELETE FROM inventario WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Item eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;