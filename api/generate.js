export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, userData } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

  try {
    // 1. Generate scripts with Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Erro na API' });
    }

    const scriptContent = data.content[0].text;

    // 2. Save to Supabase if userData provided
    if (userData && process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
      try {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SECRET_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            email: userData.email || null,
            business_name: userData.name || null,
            segment: userData.segment || null,
            channel: userData.channel || null,
            description: userData.desc || null,
            ideal_client: userData.client || null,
            differentiator: userData.diff || null,
            objections: userData.objections || null,
            best_story: userData.story || null,
            created_at: new Date().toISOString()
          })
        });
      } catch (dbError) {
        // Don't fail the request if DB save fails
        console.error('DB save error:', dbError);
      }
    }

    return res.status(200).json({ content: scriptContent });

  } catch (error) {
    return res.status(500).json({ error: 'Erro interno: ' + error.message });
  }
}
