import 'dotenv/config';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { prisma } from '../config/database';
import { AppError } from './errorHandler';
import { debugLog, maskEmail } from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
}

const client = jwksClient({
  jwksUri: `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  requestHeaders: {
    apikey: process.env.SUPABASE_ANON_KEY || ''
  },
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
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
      return next(new AppError('Token nao fornecido', 401));
    }

    const [, token] = authHeader.split(' ');

    const decodedToken = jwt.decode(token, { complete: true });
    if (!decodedToken || typeof decodedToken === 'string') {
      return next(new AppError('Token malformado', 401));
    }

    const { header } = decodedToken;
    let decoded: any;

    if (header.alg === 'HS256') {
      const secret = process.env.SUPABASE_JWT_SECRET!;
      const secretToUse = secret.includes('+') || secret.includes('/')
        ? Buffer.from(secret, 'base64')
        : secret;

      decoded = jwt.verify(token, secretToUse, { algorithms: ['HS256'] });
      debugLog('Token HS256 verificado para usuario autenticado:', maskEmail(decoded.email));
    } else {
      debugLog('Validando token Supabase via JWKS para algoritmo:', header.alg);
      decoded = await new Promise((resolve, reject) => {
        jwt.verify(token, getKey, { algorithms: [header.alg as jwt.Algorithm] }, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      debugLog('Token ES256 verificado para usuario autenticado:', maskEmail(decoded.email));
    }

    if (!decoded || !decoded.sub || !decoded.email) {
      return next(new AppError('Token invalido ou incompleto', 401));
    }

    const supabaseUserId: string = decoded.sub;
    const email: string = decoded.email;
    const name: string =
      decoded.user_metadata?.full_name ||
      decoded.user_metadata?.name ||
      email.split('@')[0] ||
      'Usuario';

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
    console.error('Falha na autenticacao:', error.message);

    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Token invalido', 401));
    }

    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expirado', 401));
    }

    if (error.name?.startsWith('Prisma')) {
      return next(new AppError('Servico temporariamente indisponivel', 503));
    }

    next(new AppError('Erro interno durante autenticacao', 500));
  }
};
