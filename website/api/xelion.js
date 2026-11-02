// Xelion integration on hold — restore handler when resuming (XELION_ENABLED=true).
// import { handleXelionRequest } from '../lib/xelion-handler.mjs';

export const config = {
  runtime: 'nodejs',
  maxDuration: 20,
};

export default async function handler(req, res) {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      error: 'Xelion office chat is on hold.',
      onHold: true,
    }),
  );
  // return handleXelionRequest(req, res);
}
