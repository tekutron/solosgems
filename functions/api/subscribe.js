// Cloudflare Pages Function: handles the newsletter signup form.
// Requires a KV namespace bound to this Pages project as "SUBSCRIBERS"
// (Pages project -> Settings -> Functions -> KV namespace bindings).
// Stores each email as a KV key with the signup timestamp as the value.
// No third-party service, no API key, nothing to configure beyond that one binding.

export async function onRequestPost({ request, env }) {
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
    // KV namespace not bound yet; fail visibly instead of silently losing signups.
    return new Response(
      "Signup storage isn't configured yet. Bind a KV namespace named SUBSCRIBERS to this Pages project.",
      { status: 500 }
    );
  }

  const existing = await env.SUBSCRIBERS.get(email);
  if (!existing) {
    await env.SUBSCRIBERS.put(email, new Date().toISOString());
  }

  return Response.redirect(new URL("/thanks.html", request.url), 303);
}

export async function onRequestGet() {
  return new Response("Method not allowed", { status: 405 });
}
