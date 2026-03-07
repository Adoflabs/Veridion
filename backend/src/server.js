import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { startRiskEvaluationScheduler } from './jobs/risk-evaluation.job.js';
import { startFormulaApprovalScheduler } from './jobs/formula-approval.job.js';

async function bootstrap() {
  if (!env.databaseUrl) {
    throw new Error('[server] DATABASE_URL is missing. Set it in backend/.env before starting the API.');
  }

  // Retry database connection with exponential backoff
  let retries = 5;
  let delay = 1000;
  
  while (retries > 0) {
    try {
      await prisma.$connect();
      console.log('[server] connected to PostgreSQL');
      break;
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error('[server] failed to connect to database after multiple attempts');
        throw error;
      }
      console.log(`[server] database connection failed, retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }

  app.listen(env.port, () => {
    console.log(`[server] listening on :${env.port}`);
    startRiskEvaluationScheduler();
    startFormulaApprovalScheduler();
  });
}

bootstrap().catch((error) => {
  console.error('[server] failed to start', error);
  process.exit(1);
});

async function shutdown(signal) {
  console.log(`[server] received ${signal}, shutting down`);
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
