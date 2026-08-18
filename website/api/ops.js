import { handleOpsRequest } from '../lib/ops-handler.mjs';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

export default async function handler(req, res) {
  return handleOpsRequest(req, res);
}
