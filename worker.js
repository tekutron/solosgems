// Worker entry point. Static assets (HTML/CSS/JS/images) under assets.directory
// are served automatically without hitting this script. This fetch handler only
// runs for requests that don't match a static asset, i.e. the /api/subscribe and
// /api/submit routes.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/subscribe") {
      if (request.method === "POST") {
        return handleSubscribe(request, env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/submit") {
      if (request.method === "POST") {
        return handleSubmit(request, env);
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

async function handleSubmit(request, env) {
  let fields;
  try {
    const formData = await request.formData();
    fields = {
      type: (formData.get("type") || "tool").toString().trim().slice(0, 32),
      tool_name: (formData.get("tool_name") || "").toString().trim().slice(0, 200),
      tool_url: (formData.get("tool_url") || "").toString().trim().slice(0, 500),
      category: (formData.get("category") || "").toString().trim().slice(0, 200),
      pitch: (formData.get("pitch") || "").toString().trim().slice(0, 2000),
      submitter_email: (formData.get("submitter_email") || "").toString().trim().slice(0, 254),
    };
  } catch (err) {
    return new Response("Bad request", { status: 400 });
  }

  if (!fields.tool_name) {
    return Response.redirect(new URL("/submit.html?error=missing_name", request.url), 303);
  }

  if (!env.SUBMISSIONS) {
    return new Response(
      "Submission storage isn't configured yet. Bind a KV namespace named SUBMISSIONS to this Worker.",
      { status: 500 }
    );
  }

  const timestamp = new Date().toISOString();
  const rand = Math.random().toString(36).slice(2, 8);
  const safeName = fields.tool_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const key = `${fields.type}:${timestamp}:${safeName}:${rand}`;

  await env.SUBMISSIONS.put(key, JSON.stringify({ ...fields, received_at: timestamp }));

  return Response.redirect(new URL("/submitted.html", request.url), 303);
}
