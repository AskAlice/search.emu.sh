import { FastifyPluginAsync } from 'fastify'
import { hexToRgbHsl } from '../rich'

const color: FastifyPluginAsync = async (fastify) => {
  fastify.get('/color/:hex.svg', async (request: any, reply) => {
    const hex = request.params.hex.toUpperCase()
    const parsed = hexToRgbHsl(`#${hex}`)
    if (!parsed) return reply.code(400).send({ error: 'Expected a 3 or 6 digit hex color' })
    return reply
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .type('image/svg+xml')
      .send(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="16" fill="#${hex}"/></svg>`)
  })
}

export default color
