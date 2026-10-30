import { test } from 'tap'
import { cleanUrl, convertUnit, getRichSuggestions, hexToRgbHsl } from '../src/rich'

test('unit conversion supports temperature, distance, mass, and aliases', async (t) => {
  t.equal(convertUnit(72, 'f', 'c'), 22.222222)
  t.equal(convertUnit(10, 'km', 'mi'), 6.213712)
  t.equal(convertUnit(5, 'kilograms', 'lbs'), 11.023113)
  t.equal(convertUnit(1, 'km', 'kg'), null)
})

test('color conversion expands shorthand and calculates RGB/HSL', async (t) => {
  t.same(hexToRgbHsl('#f00'), {
    hex: '#FF0000', rgb: [255, 0, 0], hsl: [0, 100, 50],
  })
  t.same(hexToRgbHsl('#000000'), {
    hex: '#000000', rgb: [0, 0, 0], hsl: [0, 0, 0],
  })
  t.equal(hexToRgbHsl('red'), null)
})

test('cleanUrl removes tracking parameters and preserves search', async (t) => {
  t.equal(
    cleanUrl('https://example.com/path?utm_source=test&a=1&fbclid=x&utm_medium=email'),
    'https://example.com/path?a=1'
  )
  t.equal(cleanUrl('not a url'), 'not a url')
})

test('bang discovery is local and uses discovery relevance', async (t) => {
  const all = await getRichSuggestions('!')
  t.equal(all.length, 8)
  t.ok(all.every(item => item.relevance === 4500 && item.annotation.length > 0))

  const github = await getRichSuggestions('!g')
  t.equal(github.length, 1)
  t.equal(github[0].suggestion, '!gh owner/repo')
  t.same(await getRichSuggestions('ordinary search'), [])
})
