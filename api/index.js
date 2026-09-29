/**
 * Vercel serverless entrypoint.
 *
 * An Express app is already a (req, res) handler, so it can be exported
 * directly. vercel.json routes every /api/* path here, and the app's own
 * router does the rest — the same routing that runs locally under
 * `npm --prefix server run dev`.
 */
import app from '../server/app.js';

export default app;
