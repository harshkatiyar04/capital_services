export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompts = [
    "Write a short, authentic 5-star Google review (2-4 sentences) for Capital Services, a property restoration and insurance claims company in Watford, UK. They handle fire/flood damage restoration, drying, strip-out works, reinstatement, and major loss projects. Make it sound like a real homeowner or business owner. Mention specific services like making safe, drying, or reinstatement naturally. Do NOT use any greeting or sign-off. Just the review text. Be warm, genuine, and unique.",
    "Write a brief, heartfelt 5-star Google review (2-4 sentences) for Capital Services, a UK property care company that handles insurance claims, flood/fire damage, and property restoration. Sound like a genuine customer who had their property restored after damage. Mention their professionalism and quick response. No greeting or sign-off. Just the review.",
    "Compose a glowing 5-star Google review (2-3 sentences) for Capital Services based in Watford/Yateley, UK. They specialize in property damage restoration including strip-out, drying, validation, and reinstatement for insurance claims. Write as if you're a satisfied property owner. Be specific but natural. No greetings or closings.",
    "Create an enthusiastic but genuine 5-star review (2-4 sentences) for Capital Services, a property restoration firm handling insurance work across the UK. Mention their team's expertise in areas like major loss, commercial claims, subsidence, or high net worth properties. Sound real and personal. No opening or closing formalities.",
    "Write a concise, honest-sounding 5-star Google review (2-3 sentences) for Capital Services. They restored a property after significant damage — could be water, fire, or structural. Praise their communication, timeliness, and quality of work. Sound like a real person, not marketing copy. No greetings.",
  ];

  const prompt = prompts[Math.floor(Math.random() * prompts.length)];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You write authentic Google reviews. Output ONLY the review text — no quotes, no labels.' },
          { role: 'user', content: prompt }
        ],
        temperature: 1.1,
        max_tokens: 100,
        top_p: 0.95,
      }),
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'AI provider error' });
    }

    const data = await response.json();
    let review = data.choices?.[0]?.message?.content?.trim() || '';
    review = review.replace(/^["']|["']$/g, '');

    return res.status(200).json({ review });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate review' });
  }
}
