import { handleOpsRequest } from '../lib/ops-handler.mjs';

export default async function handler(req, res) {
  return handleOpsRequest(req, res);
}
