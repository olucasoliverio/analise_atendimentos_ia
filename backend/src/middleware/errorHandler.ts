import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;  // Erro esperado/tratável
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // ✅ P0.4 - AppError customizado (erros de negócio)
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: 'error',
      message: error.message
    });
  }

  // ✅ P0.4 - Zod validation errors (caso não pegue no middleware)
  if (error instanceof ZodError) {
    const errors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));

    return res.status(400).json({
      status: 'error',
      message: 'Erro de validação',
      errors
    });
  }

  // ✅ P0.4 - Erros do Prisma
  if (error.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    
    // Violação de constraint única
    if (prismaError.code === 'P2002') {
      return res.status(409).json({
        status: 'error',
        message: 'Registro duplicado',
        field: prismaError.meta?.target
      });
    }

    // Registro não encontrado
    if (prismaError.code === 'P2025') {
      return res.status(404).json({
        status: 'error',
        message: 'Registro não encontrado'
      });
    }

    // Outros erros do Prisma
    return res.status(400).json({
      status: 'error',
      message: 'Erro de banco de dados'
    });
  }

  // ✅ P0.4 - Erros de autenticação
  if (error.message.includes('token') || error.message.includes('unauthorized')) {
    return res.status(401).json({
      status: 'error',
      message: 'Não autorizado'
    });
  }

  // ✅ Erro genérico (não esperado)
  console.error('❌ Erro não tratado:', {
    message: error.message,
    stack: error.stack,
    name: error.constructor.name
  });

  // Em produção, não vazar detalhes do erro
  const message = process.env.NODE_ENV === 'production'
    ? 'Erro interno do servidor'
    : error.message;

  return res.status(500).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
};