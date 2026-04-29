export async function POST(req) {
  try {
    const cheque = await req.json();
    
    const response = await fetch(
      process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/cheques',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(cheque)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Supabase error:', error);
      return Response.json({ ok: false, error }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error('Save cheque error:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
