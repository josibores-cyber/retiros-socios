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
              text: `Sos un experto en lectura de cheques bancarios argentinos. Analiza esta imagen con MAXIMA precision.

INSTRUCCIONES CRITICAS:
- Lee cada digito individualmente, no asumas
- Para fechas: el formato argentino es DD/MM/AAAA. Lee dia, mes y año por separado
- Para el numero de cheque: son tipicamente 8 digitos
- Para el monto: lee cada digito, presta atencion a si hay comas o puntos
- Si un caracter es ambiguo, indica null para ese campo

Responde SOLO con JSON sin markdown ni backticks:
{"banco":"Nombre del banco","numero":"12345678","monto":438512.00,"fecha_emision":"2025-03-15","fecha_cobro":"2025-04-25","ok":true}

Si no es un cheque: {"ok":false}`
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
