import { test } from 'tap'
import { build } from '../helper'

test('default root route', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/'
  })
  t.equal(res.statusCode, 200)
  t.match(res.headers['content-type'], /text\/html/)
  t.match(res.body, /<div id="root"><\/div>/)
  const asset = res.body.match(/src="([^"]+\.js)"/)?.[1]
  t.ok(asset, 'compiled JavaScript is referenced')
  if (asset) t.equal((await app.inject(asset)).statusCode, 200, 'same app serves the compiled asset')
  t.equal((await app.inject('/osd.xml')).statusCode, 200, 'API route remains reachable')
})
