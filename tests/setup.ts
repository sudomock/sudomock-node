import { afterAll, afterEach, beforeAll } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

export const TEST_API_KEY = 'sm_test_key_123'
export const TEST_BASE_URL = 'https://api.sudomock.com'

export const MOCK_MOCKUP = {
  uuid: '11111111-1111-1111-1111-111111111111',
  name: 'Test Mockup',
  thumbnail: 'https://cdn.sudomock.com/thumbs/test.webp',
  width: 4000,
  height: 3000,
  smart_objects: [
    {
      uuid: '22222222-2222-2222-2222-222222222222',
      name: 'Front Design',
      size: { width: 800, height: 600 },
      position: { x: 100, y: 200, width: 800, height: 600 },
      print_area_presets: [
        {
          uuid: '33333333-3333-3333-3333-333333333333',
          name: 'Default',
          thumbnails: [],
          size: { width: 800, height: 600 },
          position: { x: 0, y: 0, width: 800, height: 600 },
        },
      ],
      layer_name: 'Front Design',
      quad: null,
      blend_mode: 'normal',
    },
  ],
  text_layers: [],
  collections: [],
  thumbnails: [
    { width: 720, url: 'https://cdn.sudomock.com/thumbs/720.webp' },
  ],
}

export const MOCK_RENDER_RESPONSE = {
  success: true,
  data: {
    print_files: [
      {
        export_path: 'https://cdn.sudomock.com/renders/test/render_123.webp',
        smart_object_uuid: '22222222-2222-2222-2222-222222222222',
      },
    ],
  },
}

export const MOCK_AI_RENDER_RESPONSE = {
  success: true,
  data: {
    print_files: [
      {
        export_path: 'https://cdn.sudomock.com/renders/sudoai/abc123.png',
        duration_ms: 2340,
        segment_index: 0,
        confidence: 0.95,
        export_format: 'png',
      },
    ],
  },
}

export const MOCK_ACCOUNT_RESPONSE = {
  success: true,
  data: {
    account: {
      uuid: '44444444-4444-4444-4444-444444444444',
      email: 'test@example.com',
      name: 'Test User',
      created_at: '2026-01-01T00:00:00Z',
    },
    subscription: {
      plan: 'pro',
      tier: 'pro',
      status: 'active',
      current_period_end: '2026-04-01T00:00:00Z',
      cancel_at_period_end: false,
    },
    usage: {
      credits_used_this_month: 50,
      credits_limit: 1000,
      credits_remaining: 950,
      billing_period_start: '2026-03-01T00:00:00Z',
      billing_period_end: '2026-04-01T00:00:00Z',
    },
    api_key: {
      name: 'Production Key',
      created_at: '2026-01-15T00:00:00Z',
      last_used_at: '2026-03-20T12:00:00Z',
      total_requests: 1234,
    },
  },
}

export const MOCK_UPLOAD_RESPONSE = {
  success: true,
  data: MOCK_MOCKUP,
  message: '',
}

export const MOCK_SESSION_RESPONSE = {
  success: true,
  session: 'sess_abcdefghijklmnopqrstuvwxyz1234567890ABCDE',
  expires_in: 900,
  displayMode: 'iframe',
}

// ---------------------------------------------------------------------------
// Default handlers -- happy path
// ---------------------------------------------------------------------------

export const handlers = [
  // List mockups
  http.get(`${TEST_BASE_URL}/api/v1/mockups`, ({ request }) => {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== TEST_API_KEY) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json({
      success: true,
      data: {
        mockups: [MOCK_MOCKUP],
        total: 1,
        limit: 20,
        offset: 0,
      },
    })
  }),

  // Get mockup
  http.get(`${TEST_BASE_URL}/api/v1/mockups/:uuid`, ({ request, params }) => {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== TEST_API_KEY) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    if (params['uuid'] === 'not-found-uuid') {
      return HttpResponse.json({ detail: 'Mockup not found' }, { status: 404 })
    }
    return HttpResponse.json({
      success: true,
      data: MOCK_MOCKUP,
    })
  }),

  // Update mockup
  http.patch(`${TEST_BASE_URL}/api/v1/mockups/:uuid`, ({ request }) => {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== TEST_API_KEY) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json({
      success: true,
      data: { ...MOCK_MOCKUP, name: 'Updated Mockup' },
    })
  }),

  // Delete mockup
  http.delete(`${TEST_BASE_URL}/api/v1/mockups/:uuid`, ({ request }) => {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== TEST_API_KEY) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // Render
  http.post(`${TEST_BASE_URL}/api/v1/renders`, ({ request }) => {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== TEST_API_KEY) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json(MOCK_RENDER_RESPONSE)
  }),

  // AI Render
  http.post(`${TEST_BASE_URL}/api/v1/sudoai/render`, ({ request }) => {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== TEST_API_KEY) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json(MOCK_AI_RENDER_RESPONSE)
  }),

  // Upload
  http.post(`${TEST_BASE_URL}/api/v1/psd/upload`, ({ request }) => {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== TEST_API_KEY) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json(MOCK_UPLOAD_RESPONSE)
  }),

  // Account
  http.get(`${TEST_BASE_URL}/api/v1/me`, ({ request }) => {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== TEST_API_KEY) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json(MOCK_ACCOUNT_RESPONSE)
  }),

  // Studio create session
  http.post(`${TEST_BASE_URL}/api/v1/studio/create-session`, ({ request }) => {
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== TEST_API_KEY) {
      return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json(MOCK_SESSION_RESPONSE)
  }),
]

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

export const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
