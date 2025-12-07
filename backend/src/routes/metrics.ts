/**
 * Metrics Endpoint Route
 * Exposes Prometheus metrics at /api/metrics
 */

import { Router, Request, Response } from 'express';
import { register } from '../middleware/metrics';

const router = Router();

/**
 * GET /api/metrics
 * Returns Prometheus-formatted metrics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).send('Error generating metrics');
  }
});

export default router;

