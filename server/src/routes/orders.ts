import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware, AuthRequest } from '../auth.js';

const router = Router();

router.get('/', authMiddleware, async (_req: AuthRequest, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, total, items } = req.body;
    const orderId = crypto.randomUUID();

    await pool.query('BEGIN');

    await pool.query(
      'INSERT INTO orders (id, customer_name, customer_phone, customer_email, total, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [orderId, customer_name, customer_phone, customer_email || '', total, 'En attente', new Date().toISOString()]
    );

    for (const item of items) {
      const itemId = crypto.randomUUID();
      await pool.query(
        'INSERT INTO order_items (id, "order", service, service_name, quantity, price) VALUES ($1,$2,$3,$4,$5,$6)',
        [itemId, orderId, item.service_id, item.service_name, item.quantity, item.price]
      );
    }

    await pool.query('COMMIT');
    res.json({ id: orderId });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.patch('/:id/status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
