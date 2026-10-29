import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Dev-only: serves the Vercel-style handlers in api/ at /api/<name> so the
 * proxy code path runs locally instead of falling back to direct BVG calls.
 */
function localApiRoutes() {
  return {
    name: 'local-api-routes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const url = new URL(req.url, 'http://localhost')
        const route = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '')
        if (!route) return next()

        try {
          const mod = await server.ssrLoadModule(`/api/${route}.js`)
          req.query = Object.fromEntries(url.searchParams)
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (body) => {
            res.setHeader('content-type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(body))
            return res
          }
          await mod.default(req, res)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(error?.message || error) }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localApiRoutes()],
})
