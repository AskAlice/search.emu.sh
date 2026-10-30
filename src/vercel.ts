import Fastify from 'fastify'
import type { IncomingMessage, ServerResponse } from 'http'
import { app } from './plugin'

const fastify = Fastify({ logger: false, pluginTimeout: 60000 })
const ready = fastify.register(app).ready()

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await ready
  await new Promise<void>((resolve, reject) => {
    response.once('finish', resolve)
    response.once('close', resolve)
    response.once('error', reject)
    fastify.server.emit('request', request, response)
  })
}
