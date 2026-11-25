import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Dev-only: serves the Vercel functions in api/*.js from the Vite dev server,
// so `npm run dev` runs the full app (site + API) without the Vercel CLI.
// It only shims the slice of Vercel's req/res the handlers use (method, JSON
// body, cookies, status/json/setHeader). Never part of a production build.
function vercelApiDev() {
  return {
    name: 'vercel-api-dev',
    apply: 'serve',
    configureServer(server) {
      // Server-side handlers read process.env (DATABASE_URL, SQUARE_*, etc.).
      // Vite auto-restarts when .env.local changes, but loadEnv() lets values
      // already in process.env win over the file — including ones WE put there
      // last time, so an edited value (e.g. a new STAFF_PASSCODE) would be
      // silently ignored. So: forget what we injected before, then re-read.
      // (Kept on globalThis because this config module is re-run on restart.)
      for (const key of globalThis.__hcsInjectedEnv || []) delete process.env[key]
      const fileEnv = loadEnv(server.config.mode, process.cwd(), '')
      const injected = Object.keys(fileEnv).filter((key) => process.env[key] === undefined)
      for (const key of injected) process.env[key] = fileEnv[key]
      globalThis.__hcsInjectedEnv = injected

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const match = url.pathname.match(/^\/api\/([\w-]+)\/?$/)
        if (!match) return next()

        const file = path.resolve('api', `${match[1]}.js`)
        if (!fs.existsSync(file)) return next()

        try {
          // ssrLoadModule picks up edits to api/*.js without a restart.
          const mod = await server.ssrLoadModule(file)

          // Like Vercel: `export const config = { api: { bodyParser: false } }`
          // leaves the request stream unread (e.g. for webhook signatures).
          if (mod.config?.api?.bodyParser !== false) {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const raw = Buffer.concat(chunks).toString('utf8')
            const isJson = (req.headers['content-type'] || '').includes('application/json')
            req.body = raw && isJson ? JSON.parse(raw) : raw || undefined
          }
          req.query = Object.fromEntries(url.searchParams)
          req.cookies = Object.fromEntries(
            (req.headers.cookie || '')
              .split(';')
              .map((c) => c.trim().split('='))
              .filter(([k]) => k)
              .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
          )

          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
            return res
          }
          res.send = (data) => {
            res.end(typeof data === 'string' ? data : JSON.stringify(data))
            return res
          }

          await mod.default(req, res)
        } catch (err) {
          server.config.logger.error(`[api/${match[1]}] ${err.stack || err}`)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Dev API handler crashed — see terminal.' }))
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vercelApiDev()],
})
