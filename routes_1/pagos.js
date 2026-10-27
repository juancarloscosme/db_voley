const router = require('express').Router();
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

router.use(verificarToken);

// Registrar pago pendiente
router.post('/', permitirRoles('admin', 'cajero'), async (req, res) => {
  try {
    const { jugador_id, concepto, monto, fecha_vencimiento } = req.body;
    const result = await pool.query(
      `INSERT INTO pagos (jugador_id, concepto, monto, fecha_vencimiento, estado, registrado_por)
       VALUES ($1,$2,$3,$4,'pendiente',$5) RETURNING *`,
      [jugador_id, concepto, monto, fecha_vencimiento, req.usuario.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirmar pago
router.put('/:id/pagar', permitirRoles('admin', 'cajero'), async (req, res) => {
  const result = await pool.query(
    `UPDATE pagos SET estado='pagado', fecha_pago=NOW() WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  res.json(result.rows[0]);
});

// Listar pagos (jugador ve solo los suyos)
router.get('/', async (req, res) => {
  let query, params;
  if (req.usuario.rol === 'jugador') {
    query = `SELECT p.* FROM pagos p
             JOIN jugadores j ON p.jugador_id=j.id
             WHERE j.usuario_id=$1 ORDER BY p.fecha_vencimiento DESC`;
    params = [req.usuario.id];
  } else {
    query = 'SELECT * FROM pagos ORDER BY fecha_vencimiento DESC';
    params = [];
  }
  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Resumen de ingresos (caja)
router.get('/resumen', permitirRoles('admin', 'cajero'), async (req, res) => {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE estado='pagado') AS pagados,
      COUNT(*) FILTER (WHERE estado='pendiente') AS pendientes,
      COALESCE(SUM(monto) FILTER (WHERE estado='pagado'),0) AS total_pagado,
      COALESCE(SUM(monto) FILTER (WHERE estado='pendiente'),0) AS total_pendiente
    FROM pagos
  `);
  res.json(result.rows[0]);
});

module.exports = router;