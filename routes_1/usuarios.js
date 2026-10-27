const router = require('express').Router();
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', permitirRoles('admin'), async (req, res) => {
  const result = await pool.query(
    'SELECT id, nombre, email, rol, activo FROM usuarios ORDER BY id'
  );
  res.json(result.rows);
});

router.put('/:id/rol', permitirRoles('admin'), async (req, res) => {
  const { rol } = req.body;
  const result = await pool.query(
    'UPDATE usuarios SET rol=$1 WHERE id=$2 RETURNING id, nombre, rol',
    [rol, req.params.id]
  );
  res.json(result.rows[0]);
});

router.put('/:id/desactivar', permitirRoles('admin'), async (req, res) => {
  const result = await pool.query(
    'UPDATE usuarios SET activo=false WHERE id=$1 RETURNING id, nombre, activo',
    [req.params.id]
  );
  res.json(result.rows[0]);
});

module.exports = router;