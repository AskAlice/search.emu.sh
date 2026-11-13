import { test } from 'tap'
import { cleanUrl, convertUnit, featureIcon, getRichSuggestions, hexToRgbHsl, plainText } from '../src/rich'

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

test('plainText strips provider markup and decodes entities', async (t) => {
  t.equal(plainText('emu<b>.</b>sh<b>&nbsp;error</b>'), 'emu.sh error')
  t.equal(plainText('Tom &amp; Jerry'), 'Tom & Jerry')
  t.equal(featureIcon({ suggestion: 'ssl emu.sh', title: 'emu.sh TLS certificate', annotation: '' }), '/icon/SSL.svg?v=2')
})

test('bang discovery is local and uses discovery relevance', async (t) => {
  const all = await getRichSuggestions('!')
  t.equal(all.length, 7)
  t.ok(all.every(item => item.relevance === 4500 && item.annotation.length > 0))

  t.same(await getRichSuggestions('!npm'), [])
  t.same(await getRichSuggestions('!npm react'), [])
  t.ok(all.every(item => featureIcon(item)))

  const github = await getRichSuggestions('!g')
  t.equal(github.length, 1)
  t.equal(github[0].suggestion, '!gh owner/repo')
  t.same(await getRichSuggestions('ordinary search'), [])
})
