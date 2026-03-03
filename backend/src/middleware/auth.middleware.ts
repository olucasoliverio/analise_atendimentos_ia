import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { prisma } from '../config/database';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  userId?: string;
}

// Configurar o cliente JWKS para o Supabase (para tokens ES256)
const client = jwksClient({
  jwksUri: `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  requestHeaders: {
    'apikey': process.env.SUPABASE_ANON_KEY || '' // Algumas instâncias pedem a anon key
  },
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(new AppError('Token não fornecido', 401));
    }

    const [, token] = authHeader.split(' ');

    // 1. Decodificar sem verificar primeiro para ver o algoritmo
    const decodedToken = jwt.decode(token, { complete: true });
    if (!decodedToken || typeof decodedToken === 'string') {
      return next(new AppError('Token malformado', 401));
    }

    const { header } = decodedToken;
    let decoded: any;

    if (header.alg === 'HS256') {
      const secret = process.env.SUPABASE_JWT_SECRET!;
      // Tentar decodificar segredo base64 se parecer base64
      const secretToUse = secret.includes('+') || secret.includes('/')
        ? Buffer.from(secret, 'base64')
        : secret;
      decoded = jwt.verify(token, secretToUse, { algorithms: ['HS256'] });
      console.log('✅ Token HS256 verificado:', decoded.email);
    } else {
      // ES256 ou outros: buscar chave pública
      console.log('🔑 Buscando chave para algoritmo:', header.alg);
      decoded = await new Promise((resolve, reject) => {
        jwt.verify(token, getKey, { algorithms: [header.alg as any] }, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      console.log('✅ Token ES256 verificado via JWKS:', decoded.email);
    }


    if (!decoded || !decoded.sub || !decoded.email) {
      return next(new AppError('Token inválido ou incompleto', 401));
    }

    const supabaseUserId: string = decoded.sub;
    const email: string = decoded.email;
    const name: string =
      decoded.user_metadata?.full_name ||
      decoded.user_metadata?.name ||
      email.split('@')[0] ||
      'Usuário';

    // Buscar ou criar o utilizador local no banco
    let user = await (prisma.user as any).findFirst({
      where: { supabaseId: supabaseUserId }
    });

    if (!user) {
      user = await (prisma.user as any).upsert({
        where: { email },
        update: { supabaseId: supabaseUserId, name },
        create: {
          email,
          name,
          supabaseId: supabaseUserId,
          password: undefined
        }
      });
    }

    req.userId = user.id;
    next();
  } catch (error: any) {
    console.error('Erro na autenticação:', error.message);
    next(new AppError('Erro na autenticação: ' + error.message, 401));
  }
};