import 'dotenv/config';
import cors from 'cors';
import express, { Application } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cron from 'node-cron';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import { FreshchatCacheService } from './services/freshchat-cache.service';

const app: Application = express();
const PORT = process.env.PORT || 3000;
const cacheService = new FreshchatCacheService();

app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    callback(new Error('Nao permitido por CORS'));
  },
  credentials: true
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Next Fit AI Analyst API'
  });
});

app.use('/api', routes);
app.use(errorHandler);

cron.schedule('0 */6 * * *', async () => {
  console.log('Iniciando limpeza automatica de cache...');
  try {
    await cacheService.cleanExpiredCache();
    console.log('Limpeza de cache concluida');
  } catch (error) {
    console.error('Erro na limpeza automatica de cache:', error);
  }
});

console.log('Cron de limpeza de cache configurado (a cada 6 horas)');

app.listen(PORT, () => {
  console.log('Next Fit AI Analyst API');
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
