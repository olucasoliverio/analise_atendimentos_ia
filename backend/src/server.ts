import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import cron from 'node-cron';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import { FreshchatCacheService } from './services/freshchat-cache.service';


const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Next Fit AI Analyst API'
  });
});

// Routes
app.use('/api', routes);

// Error handler (último middleware)
app.use(errorHandler);

// ✅ CRON JOB - Limpar cache expirado a cada 6 horas
const cacheService = new FreshchatCacheService();

cron.schedule('0 */6 * * *', async () => {
  console.log('🧹 Iniciando limpeza automática de cache...');
  try {
    await cacheService.cleanExpiredCache();
    console.log('✅ Limpeza de cache concluída');
  } catch (error) {
    console.error('❌ Erro na limpeza de cache:', error);
  }
});

console.log('⏰ Cron job de limpeza de cache configurado (a cada 6 horas)');

app.listen(PORT, () => {
  console.log(`🚀 Next Fit AI Analyst API`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Cache otimizado habilitado`);
});

export default app;