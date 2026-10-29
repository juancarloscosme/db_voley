const router = require('express').Router();
const pool = require('../config/db');
const { verificarToken, permitirRoles } = require('../middleware/auth');

router.use(verificarToken);

// Registrar pago pendiente
router.post('/', permitirRoles('admin', 'cajero'), async (req, res) => {
  try {
    const { jugador_id, concepto, monto, fecha_inicio, fecha_vencimiento } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO pagos (jugador_id, concepto, monto, fecha_inicio, fecha_vencimiento, estado, registrado_por)
       VALUES (?, ?, ?, ?, ?, 'pendiente', ?)`,
      [jugador_id, concepto, monto, fecha_inicio, fecha_vencimiento, req.usuario.id]
    );
    const [rows] = await pool.query('SELECT * FROM pagos WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirmar pago
router.put('/:id/pagar', permitirRoles('admin', 'cajero'), async (req, res) => {
  try {
    await pool.query(
      `UPDATE pagos SET estado = 'pagado', fecha_pago = NOW() WHERE id = ?`,
      [req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM pagos WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar pagos (jugador ve solo los suyos)
// Listar pagos (jugador ve solo los suyos, admin ve todos)
router.get('/', async (req, res) => {
  try {
    let query, params;
    
    // Consulta base que trae el nombre del jugador
    const selectBase = `
      SELECT p.*, u.nombre AS nombre_jugador 
      FROM pagos p
      JOIN jugadores j ON p.jugador_id = j.id
      JOIN usuarios u ON j.usuario_id = u.id
    `;

    if (req.usuario.rol === 'jugador') {
      query = `${selectBase} WHERE j.usuario_id = ? ORDER BY p.fecha_vencimiento DESC`;
      params = [req.usuario.id];
    } else {
      query = `${selectBase} ORDER BY p.fecha_vencimiento DESC`;
      params = [];
    }
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Resumen de caja
router.get('/resumen', permitirRoles('admin', 'cajero'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        COUNT(CASE WHEN estado = 'pagado' THEN 1 END) AS pagados,
        COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) AS pendientes,
        COALESCE(SUM(CASE WHEN estado = 'pagado' THEN monto END), 0) AS total_pagado,
        COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN monto END), 0) AS total_pendiente
      FROM pagos
    `);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Anular pago (volver a pendiente)
router.put('/:id/anular', permitirRoles('admin', 'cajero'), async (req, res) => {
  try {
    await pool.query(
      `UPDATE pagos SET estado = 'pendiente', fecha_pago = NULL WHERE id = ?`,
      [req.params.id]
    );
    res.json({ mensaje: 'Pago anulado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar un pago definitivamente
router.delete('/:id', permitirRoles('admin', 'cajero'), async (req, res) => {
  try {
    await pool.query('DELETE FROM pagos WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Pago eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar/Actualizar un pago
router.put('/:id', permitirRoles('admin', 'cajero'), async (req, res) => {
  try {
    const { concepto, monto, fecha_inicio, fecha_vencimiento } = req.body;
    
    await pool.query(
      `UPDATE pagos 
       SET concepto = ?, monto = ?, fecha_inicio = ?, fecha_vencimiento = ? 
       WHERE id = ?`,
      [concepto, monto, fecha_inicio, fecha_vencimiento, req.params.id]
    );
    
    const [rows] = await pool.query('SELECT * FROM pagos WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;