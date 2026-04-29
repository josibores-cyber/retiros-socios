export async function POST(req) {
  try {
    const { b64, mime } = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
            {
              type: 'text',
              text: 'Analiza esta imagen de un cheque bancario argentino. Responde SOLO con JSON sin markdown ni backticks: {"banco":"Nombre del banco","numero":"12345","monto":15000.50,"fecha_emision":"2025-03-01","fecha_cobro":"2025-04-15","ok":true}. fecha_emision es la fecha impresa en el cheque. fecha_cobro es la fecha de vencimiento o cobro. Si no podes leer un campo pone null. Si no es un cheque pone ok:false.',
            },
          ],
        }],
      }),
    });

    const data = await response.json();
    const txt = data.content?.find((b) => b.type === 'text')?.text || '';
    const result = JSON.parse(txt.replace(/```json|```/g, '').trim());
    return Response.json(result);
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
