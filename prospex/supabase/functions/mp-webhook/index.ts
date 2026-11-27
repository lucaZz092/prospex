// Webhook do Mercado Pago. Nunca confia no corpo: confirma o pagamento direto na API do MP.
// Deploy com verificação de JWT desligada (o MP não envia token do Supabase): `supabase functions deploy mp-webhook --no-verify-jwt`
import { createClient } from "jsr:@supabase/supabase-js@2.45.4";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MP = Deno.env.get("MP_ACCESS_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (!MP) return new Response("retry", { status: 503 });
  const url = new URL(req.url);
  let body: any = {}; try { body = await req.json(); } catch { /* MP às vezes manda só query string */ }
  const id = String(body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!/^\d+$/.test(id)) return new Response("ok");

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${MP}` } });
  if (!r.ok) return new Response("retry", { status: 500 });
  const p = await r.json();
  const orderId = Number(p.external_reference);
  if (p.status === "approved" && orderId) {
    // confere valor para evitar pagamento parcial
    const { data: o, error: readError } = await admin.from("orders").select("valor_centavos,status").eq("id", orderId).maybeSingle();
    if (readError) return new Response("retry", { status: 503 });
    if (p.currency_id !== "BRL") return new Response("ok");
    if (o && o.status === "aguardando_pagamento" && Math.round(p.transaction_amount * 100) >= o.valor_centavos) {
      const { error: writeError } = await admin.from("orders").update({ status: "na_fila", pagamento_id: id }).eq("id", orderId).eq("status", "aguardando_pagamento");
      if (writeError) return new Response("retry", { status: 503 });
    }
  }
  return new Response("ok");
});
