import Fastify from 'fastify'
import { app } from './plugin'

const fastify = Fastify({ logger: true })
fastify.register(app)
fastify.listen({ port: Number(process.env.PORT) || 3000 })

export default fastify
