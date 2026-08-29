import { handle } from 'hono/cloudflare-pages';
import app from '../../server/app';

export const onRequest = handle(app);
