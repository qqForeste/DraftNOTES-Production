interface Env {
  API_ORIGIN: string
}

// one origin, cookies stay first-party
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const incoming = new URL(request.url)
  const origin = new URL(env.API_ORIGIN)

  const target = new URL(incoming.pathname + incoming.search, origin)
  const proxied = new Request(target, request)
  proxied.headers.set('X-Forwarded-Host', incoming.host)
  proxied.headers.set('X-Forwarded-Proto', incoming.protocol.replace(':', ''))

  return fetch(proxied)
}
