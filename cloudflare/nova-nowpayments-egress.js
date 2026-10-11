const ALLOWED = new Set([
  "GET /v1/currencies",
  "GET /v1/min-amount",
  "POST /v1/payment",
  "POST /v1/auth",
  "GET /v1/balance",
  "GET /v1/estimate",
  "POST /create/payout",
  "POST /v1/payout",
  "POST /validate/address",
]);

function allowed(request) {
  const url = new URL(request.url);
  const key = `${request.method} ${url.pathname}`;
  if (ALLOWED.has(key)) return true;
  if (request.method === "GET" && /^\/v1\/payment\/[^/]+$/.test(url.pathname)) return true;
  if (request.method === "GET" && /^\/payout\/[^/]+$/.test(url.pathname)) return true;
  if (request.method === "GET" && /^\/v1\/payout\/[^/]+$/.test(url.pathname)) return true;
  if (request.method === "POST" && url.pathname === "/verify/payout") return true;
  if (request.method === "POST" && /^\/v1\/payout\/[^/]+\/verify$/.test(url.pathname)) return true;
  return false;
}

export default {
  async fetch(request, env) {
    try {
      if (request.headers.get("x-nova-egress-secret") !== env.NOVA_EGRESS_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (!allowed(request)) {
        return new Response("Not Found", { status: 404 });
      }

      const incoming = new URL(request.url);
      const target = `https://api.nowpayments.io${incoming.pathname}${incoming.search}`;

      const headers = new Headers(request.headers);
      headers.delete("x-nova-egress-secret");
      headers.set("x-api-key", env.NOWPAYMENTS_API_KEY);
      headers.delete("host");

      const response = await fetch(target, {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : request.body,
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ ok: false, error: String(error) }),
        {
          status: 502,
          headers: { "content-type": "application/json; charset=UTF-8" },
        }
      );
    }
  },
};
