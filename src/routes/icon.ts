import { FastifyPluginAsync } from 'fastify'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const icon: FastifyPluginAsync = async (fastify) => {
  fastify.get('/icon/chromium/:name.svg', async (request: any, reply) => {
    const allowed = ['equal', 'history', 'search', 'notes_spark', 'search_spark', 'trending_up', 'subdirectory_arrow_right', 'prompt_suggestion', 'public']
    if (!allowed.includes(request.params.name)) return reply.code(404).send()
    const bundled = join(__dirname, '../chromium/icons')
    const root = existsSync(bundled) ? bundled : join(process.cwd(), 'src/chromium/icons')
    return reply.header('Cache-Control', 'public, max-age=86400').type('image/svg+xml').send(await readFile(join(root, `${request.params.name}.svg`)))
  })
  fastify.get('/icon/:name.svg', async (request: any, reply) => {
    const label = request.params.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'EMU'
    const glyphs: Record<string, string> = {
      MDN: '<path d="m5 19 3-14m1 14 3-10 2 10 3-10m1 10 3-14"/>',
      NPM: '<path d="M3 6h18v12h-9v-3H9v3H3z"/><path d="M6 9v6m6-6v3m6-3v6" stroke="#fff"/>',
      TRK: '<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5l10 6v5"/>',
      FL: '<path d="m21 3-6 18-3-8-9-3zM12 13l9-10"/>',
      RDAP: '<circle cx="10" cy="10" r="7"/><ellipse cx="10" cy="10" rx="3" ry="7"/><path d="M3 10h14m-2 5 6 6"/>',
      SSL: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
      MX: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 5 10 8L22 5m-7 12 2 2 4-4"/>',
      DNS: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
    }
    const glyph = glyphs[label]
    const fontSize = label.length > 3 ? 16 : 20
    const drawing = glyph
      ? `<g transform="translate(12 12) scale(3)" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`
      : `<text x="48" y="56" text-anchor="middle" font-family="monospace" font-size="${fontSize}" font-weight="600" fill="#fff">${label}</text>`
    return reply
      .header('Cache-Control', 'public, max-age=86400')
      .type('image/svg+xml')
      .send(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="16" fill="${label === 'MDN' ? '#111827' : label === 'NPM' ? '#cb3837' : '#1a73e8'}"/>${drawing}</svg>`)
  })
}

export default icon
