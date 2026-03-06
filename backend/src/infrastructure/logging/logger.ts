import pino from 'pino';
import { config } from '../../config';

export const logger = pino({
  level: config.isDev ? 'debug' : 'info',
  ...(config.isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});
