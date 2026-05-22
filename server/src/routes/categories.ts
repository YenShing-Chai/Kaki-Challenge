import { Router } from 'express';

import { CATEGORIES } from '../lib/categories';

export const categoriesRouter = Router();

categoriesRouter.get('/', (_req, res) => {
  res.json({ categories: CATEGORIES });
});
