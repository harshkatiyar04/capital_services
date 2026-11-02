import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { exec } from 'child_process';
import 'dotenv/config';
import { handleOpsRequest } from './lib/ops-handler.mjs';
// Xelion on hold — uncomment when resuming (also set XELION_ENABLED=true).
// import { handleXelionRequest } from './lib/xelion-handler.mjs';
import { replyToChat } from './lib/chat-reply.mjs';

function groqProxyPlugin() {
  let envKey = '';
  let envModel = 'openai/gpt-oss-120b';
  try {
    const envFile = readFileSync(resolve(__dirname, '.env'), 'utf-8');
    const keyMatch = envFile.match(/GROQ_API_KEY=(.+)/);
    if (keyMatch) envKey = keyMatch[1].trim();
    const modelMatch = envFile.match(/GROQ_MODEL=(.+)/);
    if (modelMatch) envModel = modelMatch[1].trim();
  } catch {}
  const model = process.env.GROQ_MODEL || envModel;

  const prompts = [
    "Write an authentic 5-star Google review (4-6 sentences, around 80-120 words) for Capital Services, a property restoration and insurance claims company in Watford, UK. They handle fire/flood damage restoration, drying, strip-out works, reinstatement, and major loss projects. Sound like a real homeowner or business owner. Mention specific services like making safe, drying, or reinstatement naturally. Do NOT use any greeting or sign-off. Just the review text. Be warm, genuine, and detailed.",
    "Write a heartfelt 5-star Google review (4-6 sentences, around 80-120 words) for Capital Services, a UK property care company that handles insurance claims, flood/fire damage, and property restoration. Sound like a genuine customer who had their property restored after damage. Mention their professionalism, communication, and quick response. No greeting or sign-off. Just the review.",
    "Compose a glowing 5-star Google review (4-5 sentences, around 80-120 words) for Capital Services based in Watford/Yateley, UK. They specialize in property damage restoration including strip-out, drying, validation, and reinstatement for insurance claims. Write as if you're a satisfied property owner describing a real experience. Be specific but natural. No greetings or closings.",
    "Create an enthusiastic but genuine 5-star review (4-6 sentences, around 80-120 words) for Capital Services, a property restoration firm handling insurance work across the UK. Mention their team's expertise in areas like major loss, commercial claims, subsidence, or high net worth properties. Sound real and personal with concrete detail. No opening or closing formalities.",
    "Write an honest-sounding 5-star Google review (4-5 sentences, around 80-120 words) for Capital Services. They restored a property after significant damage — could be water, fire, or structural. Praise their communication, timeliness, and quality of work with specific examples. Sound like a real person, not marketing copy. No greetings.",
  ];

  return {
    name: 'groq-proxy',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }

        const apiKey = envKey || process.env.GROQ_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Chat is not configured yet' }));
          return;
        }

        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        let body = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        try {
          const result = await replyToChat({
            body,
            apiKey,
            model,
            req,
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err) {
          res.statusCode = err.status || 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Chat failed' }));
        }
      });

      server.middlewares.use('/api/generate-review', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }

        const apiKey = envKey || process.env.GROQ_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'No API key' }));
          return;
        }

        const prompt = prompts[Math.floor(Math.random() * prompts.length)];
        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: 'You write authentic Google reviews. Output ONLY the review text — no quotes, no labels.' },
                { role: 'user', content: prompt }
              ],
              temperature: 1.1,
              max_tokens: 350,
              top_p: 0.95,
            }),
          });

          if (!response.ok) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: 'AI provider error' }));
            return;
          }

          const data = await response.json();
          let review = data.choices?.[0]?.message?.content?.trim() || '';
          review = review.replace(/^["']|["']$/g, '');

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ review }));
        } catch {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed' }));
        }
      });
      server.middlewares.use('/api/run-automation', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }

        exec('python auto_review.py', (error, stdout, stderr) => {
          if (error) {
            console.error(`Automation error: ${error.message}`);
          }
        });

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      });

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/ops')) return next();
        try {
          await handleOpsRequest(req, res);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message || 'Server error' }));
        }
      });

      // Xelion /api/xelion middleware on hold — uncomment when resuming.
      // server.middlewares.use(async (req, res, next) => {
      //   const url = req.url || '';
      //   if (!url.startsWith('/api/xelion')) return next();
      //   try {
      //     await handleXelionRequest(req, res);
      //   } catch (err) {
      //     res.statusCode = 500;
      //     res.setHeader('Content-Type', 'application/json');
      //     res.end(JSON.stringify({ error: err.message || 'Server error' }));
      //   }
      // });
    },
  };
}

export default defineConfig({
  root: '.',
  plugins: [groqProxyPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        services: resolve(__dirname, 'services.html'),
        clients: resolve(__dirname, 'clients.html'),
        testimonials: resolve(__dirname, 'testimonials.html'),
        contact: resolve(__dirname, 'contact.html'),
        cookies: resolve(__dirname, 'cookies.html'),
        team: resolve(__dirname, 'team.html'),
        crew: resolve(__dirname, 'crew.html'),
        admin: resolve(__dirname, 'admin.html'),
        survey: resolve(__dirname, 'survey.html'),
        caseWater: resolve(__dirname, 'case-water.html'),
        caseFire: resolve(__dirname, 'case-fire.html'),
        caseStorm: resolve(__dirname, 'case-storm.html'),
        caseSubsidence: resolve(__dirname, 'case-subsidence.html'),
        caseCommercial: resolve(__dirname, 'case-commercial.html'),
        caseMajorLoss: resolve(__dirname, 'case-major-loss.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
