import { format } from 'date-fns';
import fs from 'fs';
import { pino } from 'pino';
import { settings } from 'pactum';
import { PactumEventLogger } from './pactum.event.logger';

declare global {
  var logTimestamp: string | undefined;
  var pinoLoggerInstance: ReturnType<typeof pino> | undefined;
  var apiLoggerInstance: ReturnType<typeof pino> | undefined;
}

const LOGS_FOLDER = 'logs';
const LOG_TIME_STAMP = 'UTC:yyyy-MM-dd HH:mm:ss.l o';

const SENSITIVE_FIELDS: string[] = [
  'request.headers.Authorization',
  'request.headers.Cookie',
  'request.headers.cookie',
  'request.headers["Authorization"]',
  'request.headers["Cookie"]',
  'response.headers["set-cookie"]',
  'response.headers.set-cookie',
];

function getLogTimestamp(): string {
  if (process.env.LOG_TIMESTAMP) {
    if (!global.logTimestamp) global.logTimestamp = process.env.LOG_TIMESTAMP;
    return global.logTimestamp;
  }
  if (!global.logTimestamp) {
    global.logTimestamp = format(new Date(), 'dd-MM-yyyy HH.mm.ss');
  }
  return global.logTimestamp;
}

const isCI = !!process.env.CI;

const getConsoleLogLevel = (): string => process.env.LOG_LEVEL ?? (isCI ? 'info' : 'debug');
const getFileLogLevel = (): string => process.env.LOG_LEVEL ?? 'trace';

function createLogDirectory(): void {
  if (!fs.existsSync(LOGS_FOLDER)) fs.mkdirSync(LOGS_FOLDER, { recursive: true });
}

function createMainLogger(): ReturnType<typeof pino> {
  if (global.pinoLoggerInstance) return global.pinoLoggerInstance;
  const level = getConsoleLogLevel();
  global.pinoLoggerInstance = pino({
    level,
    transport: {
      targets: [
        {
          level,
          target: 'pino-pretty',
          options: {
            destination: 1,
            translateTime: LOG_TIME_STAMP,
            colorize: !isCI,
            ignore: 'pid,hostname',
            singleLine: isCI,
          },
        },
      ],
    },
    redact: { paths: SENSITIVE_FIELDS, remove: false, censor: '******' },
  });
  return global.pinoLoggerInstance;
}

function createApiLogger(): ReturnType<typeof pino> {
  if (global.apiLoggerInstance) return global.apiLoggerInstance;
  const level = getFileLogLevel();
  const apiExecutionLog = `${LOGS_FOLDER}/api_execution-${getLogTimestamp()}.log`;
  global.apiLoggerInstance = pino({
    level,
    transport: {
      targets: [
        {
          level,
          target: 'pino-pretty',
          options: {
            destination: apiExecutionLog,
            colorize: false,
            translateTime: LOG_TIME_STAMP,
            ignore: 'pid,hostname',
          },
        },
      ],
    },
    redact: { paths: SENSITIVE_FIELDS, remove: false, censor: '******' },
  });
  return global.apiLoggerInstance;
}

createLogDirectory();

export const logger = createMainLogger();
export const apiExecutionLogger = createApiLogger().child({ module: 'api-execution' });

settings.setLogLevel('SILENT');

let pactumEventLoggerRegistered = false;

export function registerPactumEventLogger(): void {
  if (pactumEventLoggerRegistered) return;
  new PactumEventLogger().listen();
  pactumEventLoggerRegistered = true;
}

registerPactumEventLogger();
