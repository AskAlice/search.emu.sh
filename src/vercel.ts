import Fastify, { FastifyInstance } from 'fastify'
import type { IncomingMessage, ServerResponse } from 'http'
import { app } from './plugin'

// Boot inside a request, not at module load: Vercel can freeze an instance mid-boot, and the plugin
// timer then fires on thaw. A failed boot is dropped so the next request starts a fresh instance
// instead of every request on this instance failing.
let booting: Promise<FastifyInstance> | undefined
const boot = () => (booting ??= (async () => {
  const fastify = Fastify({ logger: false, pluginTimeout: 60000 })
  await fastify.register(app).ready()
  return fastify
})().catch(error => { booting = undefined; throw error }))

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const fastify = await boot()
  await new Promise<void>((resolve, reject) => {
    response.once('finish', resolve)
    response.once('close', resolve)
    response.once('error', reject)
    fastify.server.emit('request', request, response)
  })
}
