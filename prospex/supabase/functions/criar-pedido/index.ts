// Cria o pedido (preço calculado aqui) e inicia o pagamento no Mercado Pago.
// Sem o segredo MP_ACCESS_TOKEN a função recusa pedidos. Pagamento aprovado na hora só com PROSPEX_DEMO=1 (testes).
import { createClient } from "jsr:@supabase/supabase-js@2.45.4";
import { calcular, ESCOPO, ESTADOS, EXTRAS } from "../_shared/pricing.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const MP = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SITE = Deno.env.get("SITE_URL") ?? "http://localhost:8000";
const DEMO = Deno.env.get("PROSPEX_DEMO") === "1";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ detail: "Método não permitido" }, 405);
  if (!MP && !DEMO) return json({ detail: "Pagamentos indisponíveis no momento. Tente novamente em instantes." }, 503);

  // usuário a partir do JWT
  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ detail: "Faça login" }, 401);

  let b: any; try { b = await req.json(); } catch { return json({ detail: "JSON inválido" }, 400); }
  const nicho = String(b.nicho ?? "").trim(), escopo = String(b.escopo ?? ""), metodo = String(b.metodo ?? "pix");
  const extras: string[] = Array.isArray(b.extras) ? b.extras.map(String) : [];
  if (!/^[\p{L}\p{N}\s\-&/.,]{3,60}$/u.test(nicho)) return json({ detail: "Nicho inválido" }, 422);
  if (!(escopo in ESCOPO)) return json({ detail: "Escopo inválido" }, 422);
  if (!["pix", "card"].includes(metodo)) return json({ detail: "Método de pagamento inválido" }, 422);
  if (extras.some((e) => !(e in EXTRAS))) return json({ detail: "Extra inválido" }, 422);

  let regiao = "Brasil";
  if (escopo === "estado") { regiao = String(b.regiao ?? "").toUpperCase(); if (!ESTADOS.has(regiao)) return json({ detail: "Estado inválido" }, 422); }
  if (escopo === "cidade") { regiao = String(b.regiao ?? "").trim(); if (!/^[\p{L}\s\-'.]+,\s*[A-Za-z]{2}$/u.test(regiao)) return json({ detail: "Use o formato 'Cidade, UF'" }, 422); }

  const admin = createClient(URL, SERVICE);
  // desconto de cliente: já recebeu ao menos uma lista paga
  const { count } = await admin.from("orders").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).eq("status", "pronta");
  const { valor, desconto, estimativa } = calcular(nicho, escopo, extras, metodo, (count ?? 0) > 0);
  const { data: order, error } = await admin.from("orders")
    .insert({ user_id: user.id, nicho, escopo, regiao, extras, valor_centavos: valor, desconto_centavos: desconto, estimativa, pagamento_metodo: metodo })
    .select().single();
  if (error) return json({ detail: "Não foi possível criar o pedido" }, 500);

  // ---- pagamento ----
  let pagamento: Record<string, unknown>;
  try {
    if (DEMO && !MP) {
      pagamento = { id: `demo-${crypto.randomUUID().slice(0, 8)}`, status: "approved", demo: true };
    } else {
      const desc = `Prospex: ${nicho} · ${regiao}`, notification_url = `${URL}/functions/v1/mp-webhook`;
      const h = { Authorization: `Bearer ${MP}`, "content-type": "application/json", "X-Idempotency-Key": `order-${order.id}` };
      if (metodo === "pix") {
        const r = await fetch("https://api.mercadopago.com/v1/payments", { method: "POST", headers: h, body: JSON.stringify({
          transaction_amount: valor / 100, description: desc, payment_method_id: "pix", payer: { email: user.email },
          external_reference: String(order.id), notification_url }) });
        if (!r.ok) throw new Error(await r.text());
        const p = await r.json(), tx = p.point_of_interaction?.transaction_data ?? {};
        pagamento = { id: String(p.id), status: p.status, pix_qr: tx.qr_code_base64, pix_copia_cola: tx.qr_code };
      } else {
        const r = await fetch("https://api.mercadopago.com/checkout/preferences", { method: "POST", headers: h, body: JSON.stringify({
          items: [{ title: desc, quantity: 1, unit_price: valor / 100, currency_id: "BRL" }], payer: { email: user.email },
          external_reference: String(order.id), notification_url,
          back_urls: { success: `${SITE}/workspace.html#prospeccoes` }, auto_return: "approved" }) });
        if (!r.ok) throw new Error(await r.text());
        const p = await r.json();
        pagamento = { id: p.id, status: "pending", checkout_url: p.init_point };
      }
    }
  } catch (e) {
    console.error("pagamento", e);
    // Uma resposta perdida do provedor ainda pode gerar um webhook aprovado.
    // Preserve o pedido pendente para permitir a conciliação.
    return json({ detail: "Não foi possível iniciar o pagamento. Tente novamente." }, 502);
  }

  const upd: Record<string, unknown> = { pagamento_id: pagamento.id };
  if (pagamento.status === "approved") upd.status = "na_fila";
  const { data: updated, error: updateError } = await admin.from("orders").update(upd)
    .eq("id", order.id).eq("status", "aguardando_pagamento").select().maybeSingle();
  if (updateError) return json({ detail: "Falha ao registrar o pagamento. Confira o pedido antes de tentar novamente." }, 503);
  if (updated) return json({ order: updated, pagamento });

  // O webhook pode confirmar o pagamento antes de o checkout receber a resposta.
  const { data: current, error: readError } = await admin.from("orders").select().eq("id", order.id).single();
  if (readError || !current) return json({ detail: "Não foi possível consultar o pedido" }, 503);
  return json({ order: current, pagamento });
});
