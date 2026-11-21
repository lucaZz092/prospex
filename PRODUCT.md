# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Two primary audiences, weighted equally:
- Small agencies and freelancers who sell services (marketing, websites, software) to local small and mid-sized businesses.
- Small and mid-sized B2B sales teams (SDRs, salespeople) who need to fill their pipeline.

Both arrive with the same job: "give me a list of businesses in my niche and region that I can contact today", without setting up scrapers, proxies or data cleaning.

## Product Purpose
Prospex sells ready-to-work B2B lead lists from public business profiles (Google Maps and the businesses' own websites). The customer picks a niche and a region (city, state or all of Brazil), pays once, and receives a prioritized list in a dashboard plus a spreadsheet. Success: the customer starts contacting leads the same day.

## Positioning
"Not a list, a sales queue." Each lead is scored A/B/C by likelihood of closing (available contact, reviews, digital presence), comes with direct contacts (phone, WhatsApp link, website email, Instagram/LinkedIn) and includes a niche-specific first-contact script and email template. One-time payment per niche + region, no subscription, with an estimate shown before paying.

## Operating Context
- Brazilian market; UI and copy in Portuguese (pt-BR); payment by Pix or card through Mercado Pago.
- Flow: landing → login (Supabase Auth, optional Google) → build an order (niche + region) → pay → a worker collects the leads → dashboard with leads, pipeline stage and notes → CSV/Excel export.
- Customers work leads mainly by WhatsApp, phone and email, and move them into CRMs (RD Station, Pipedrive, HubSpot).

## Capabilities and Constraints
- Stack: static HTML/CSS/JS front end (index, login, app, workspace), Supabase (Postgres with RLS, Realtime, Edge Functions `criar-pedido` and `mp-webhook`), Python worker (`worker/`) using a Google Maps scraping engine.
- Pricing (current): City R$ 97 (up to ~900 leads, delivered within 1 hour), State R$ 397 (up to ~12,000 leads, within 6 hours), Brazil R$ 1,497 (up to ~150,000 leads, within 48 hours).
- 40+ preset niches plus a custom term.
- Users can read only their own orders and leads, and can edit only a lead's stage and notes. Prices are computed only on the server.
- Compliance: business data only, never consumer personal data. LGPD applies: outreach should be transparent about where the contact came from and honor opt-outs. Scraping Google Maps conflicts with Google's ToS; treat volume and claims with care.
- Open: CRM direct send (currently presented on the landing; confirm before promising it as live).

## Brand Commitments
- Name: Prospex.
- Voice: direct, plain Portuguese, outcome-first ("Você escolhe, a gente entrega", "Você só precisa ligar").

## Evidence on Hand
- No real customer count, lead totals, testimonials or customer logos yet. The current landing figures ("+1.200 empresas", "1.284.392 leads", customer initials) are placeholders and must not be presented as real or extended.
- Real sample output exists from SoftSolutions prospecting runs (São Paulo and Campinas prioritized CSVs, in `softsolutions_prospeccao/`). These are usable as format examples only, not as customer proof.

## Product Principles
1. Ready to sell, not raw data: every deliverable should lead straight to a first contact.
2. Price and volume before payment: no surprises, no subscription.
3. Honest proof only: never fabricate numbers, customers or testimonials.
4. Respect the data: business contacts only, LGPD-aware outreach.
