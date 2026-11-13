import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SudoMock from '../src/index'
import { NotFoundError } from '../src/errors'
import { TEST_API_KEY, TEST_BASE_URL, server } from './setup'

function createClient() {
  return new SudoMock(TEST_API_KEY, { baseUrl: TEST_BASE_URL })
}

// The shape the live endpoints answer with: bare, no {success, data} envelope.
const MOCK_PAGE = {
  templates: [
    {
      slug: 'accent-coffee-mug-11-15oz-mockup-5afc',
      title: 'Accent Coffee Mug (11, 15oz) Mockup',
      description: 'Accent mug mockup shown in 9 views.',
      category: 'drinkware',
      subcategory: 'mugs',
      product_type: 'two-tone-mug',
      tags: ['two-tone-mug-mockup', 'coffee-mug-mockup'],
      is_featured: false,
      mockup_count: 9,
      mockups: [
        {
          name: 'Lifestyle Scene',
          view: 'lifestyle-scene',
          source_url: 'https://assets.example.invalid/a.png',
        },
      ],
    },
  ],
  total_templates: 12,
  total_mockups: 97,
  page: 1,
  limit: 20,
  pages: 1,
}

const MOCK_DETAIL = {
  ...MOCK_PAGE.templates[0],
  long_description: 'The scene described at length.',
  features: ['9 views, including Handle Left'],
  visual_style: ['lifestyle', 'overhead'],
  target_audience: [],
  compatible_platforms: ['etsy', 'shopify'],
  industries: [],
  use_cases: [],
  seasons: [],
  published_at: '2026-10-31T13:09:06.177196Z',
}

describe('readyMadeMockups.search()', () => {
  it('returns the page camelCased, with every view and its render address', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/library/templates`, () =>
        HttpResponse.json(MOCK_PAGE),
      ),
    )

    const page = await createClient().readyMadeMockups.search({ search: 'coffee mug' })
    const template = page.templates[0]!

    expect(page.totalTemplates).toBe(12)
    expect(page.totalMockups).toBe(97)
    expect(page.pages).toBe(1)
    expect(template.slug).toBe('accent-coffee-mug-11-15oz-mockup-5afc')
    expect(template.productType).toBe('two-tone-mug')
    expect(template.isFeatured).toBe(false)
    expect(template.mockupCount).toBe(9)
    expect(template.mockups?.[0]?.sourceUrl).toBe('https://assets.example.invalid/a.png')
    expect(template.mockups?.[0]?.view).toBe('lifestyle-scene')
  })

  it('sends every filter in the spelling the API reads, and nothing else', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/library/templates`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(MOCK_PAGE)
      }),
    )

    await createClient().readyMadeMockups.search({
      search: 'oversized tee',
      category: 'apparel',
      subcategory: 't-shirts',
      productType: 'crewneck-short-sleeve',
      tags: ['t-shirt-mockup', 'unisex'],
      platforms: ['etsy', 'shopify'],
      industries: ['fashion'],
      useCases: ['product-listing'],
      isFeatured: true,
      page: 2,
      limit: 5,
      sortBy: 'title',
      sortOrder: 'asc',
    })

    const query = new URL(capturedUrl).searchParams
    expect(query.get('search')).toBe('oversized tee')
    expect(query.get('category')).toBe('apparel')
    expect(query.get('subcategory')).toBe('t-shirts')
    expect(query.get('product_type')).toBe('crewneck-short-sleeve')
    expect(query.get('tags')).toBe('t-shirt-mockup,unisex')
    expect(query.get('platforms')).toBe('etsy,shopify')
    expect(query.get('industries')).toBe('fashion')
    expect(query.get('use_cases')).toBe('product-listing')
    expect(query.get('is_featured')).toBe('true')
    expect(query.get('page')).toBe('2')
    expect(query.get('limit')).toBe('5')
    expect(query.get('sort_by')).toBe('title')
    expect(query.get('sort_order')).toBe('asc')
  })

  it('sends no query at all when nothing is filtered', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/library/templates`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(MOCK_PAGE)
      }),
    )

    await createClient().readyMadeMockups.search()
    expect(new URL(capturedUrl).search).toBe('')
  })

  it('leaves an empty filter array out instead of sending an empty value', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/library/templates`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(MOCK_PAGE)
      }),
    )

    await createClient().readyMadeMockups.search({ tags: [], platforms: [] })
    expect(new URL(capturedUrl).search).toBe('')
  })

  it('sends is_featured=false when the caller asks for the rest', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/library/templates`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(MOCK_PAGE)
      }),
    )

    await createClient().readyMadeMockups.search({ isFeatured: false })
    expect(new URL(capturedUrl).searchParams.get('is_featured')).toBe('false')
  })
})

describe('readyMadeMockups.getTemplate()', () => {
  it('reads one template with its long-form copy and facets', async () => {
    server.use(
      http.get(
        `${TEST_BASE_URL}/api/v1/library/templates/accent-coffee-mug-11-15oz-mockup-5afc`,
        () => HttpResponse.json(MOCK_DETAIL),
      ),
    )

    const template = await createClient().readyMadeMockups.getTemplate(
      'accent-coffee-mug-11-15oz-mockup-5afc',
    )

    expect(template.longDescription).toBe('The scene described at length.')
    expect(template.visualStyle).toEqual(['lifestyle', 'overhead'])
    expect(template.compatiblePlatforms).toEqual(['etsy', 'shopify'])
    expect(template.publishedAt).toBe('2026-10-31T13:09:06.177196Z')
    expect(template.mockups?.[0]?.sourceUrl).toBe('https://assets.example.invalid/a.png')
  })

  it('keeps the slug to one path segment', async () => {
    let capturedPath = ''
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/library/templates/:slug`, ({ request }) => {
        capturedPath = new URL(request.url).pathname
        return HttpResponse.json(MOCK_DETAIL)
      }),
    )

    await createClient().readyMadeMockups.getTemplate('a-slug?limit=100')
    expect(capturedPath).toBe('/api/v1/library/templates/a-slug%3Flimit%3D100')
  })

  it('raises NotFoundError for a slug the catalogue does not hold', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/v1/library/templates/:slug`, () =>
        HttpResponse.json(
          { detail: "Template 'no-such-slug' not found", success: false },
          { status: 404 },
        ),
      ),
    )

    await expect(
      createClient().readyMadeMockups.getTemplate('no-such-slug'),
    ).rejects.toThrow(NotFoundError)
  })
})
