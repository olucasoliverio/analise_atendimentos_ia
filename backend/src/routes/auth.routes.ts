import { Router } from 'express';

const router = Router();

// As rotas de login/registro foram substituídas pelo Supabase Auth.
// A criação/upsert de usuário acontece automaticamente no auth.middleware.ts
// na primeira requisição autenticada de qualquer rota protegida.

export default router;