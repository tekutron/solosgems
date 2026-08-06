// Worker entry point. Static assets (HTML/CSS/JS/images) under assets.directory
// are served automatically without hitting this script. This fetch handler only
// runs for requests that don't match a static asset, i.e. the /api/subscribe route.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/subscribe") {
      if (request.method === "POST") {
        return handleSubscribe(request, env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleSubscribe(request, env) {
  let email = "";
  try {
    const formData = await request.formData();
    email = (formData.get("email") || "").toString().trim().toLowerCase();
  } catch (err) {
    return new Response("Bad request", { status: 400 });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailPattern.test(email) || email.length > 254) {
    return Response.redirect(new URL("/?subscribe=invalid", request.url), 303);
  }

  if (!env.SUBSCRIBERS) {
    return new Response(
      "Signup storage isn't configured yet. Bind a KV namespace named SUBSCRIBERS to this Worker.",
      { status: 500 }
    );
  }

  const existing = await env.SUBSCRIBERS.get(email);
  if (!existing) {
    await env.SUBSCRIBERS.put(email, new Date().toISOString());
  }

  return Response.redirect(new URL("/thanks.html", request.url), 303);
}
