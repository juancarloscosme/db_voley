const router = require('express').Router();
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM inventario ORDER BY id');
  res.json(result.rows);
});

router.post('/', permitirRoles('admin', 'entrenador'), async (req, res) => {
  try {
    const { item, categoria, cantidad, estado, vida_util_meses } = req.body;
    const result = await pool.query(
      `INSERT INTO inventario (item, categoria, cantidad, estado, vida_util_meses, fecha_adquisicion)
       VALUES ($1,$2,$3,$4,$5,CURRENT_DATE) RETURNING *`,
      [item, categoria, cantidad, estado, vida_util_meses]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/prestar', permitirRoles('admin', 'entrenador'), async (req, res) => {
  const { usuario_id } = req.body;
  const result = await pool.query(
    'UPDATE inventario SET prestado_a=$1 WHERE id=$2 RETURNING *',
    [usuario_id, req.params.id]
  );
  res.json(result.rows[0]);
});

router.put('/:id/devolver', permitirRoles('admin', 'entrenador'), async (req, res) => {
  const result = await pool.query(
    'UPDATE inventario SET prestado_a=NULL WHERE id=$1 RETURNING *',
    [req.params.id]
  );
  res.json(result.rows[0]);
});

module.exports = router;