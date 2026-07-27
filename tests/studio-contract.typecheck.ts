import type { StudioResultEvent } from '../src/index'

const baseEnvelope = {
  version: 1,
  source: 'sudomock-studio',
  request_id: '11111111-1111-4111-8111-111111111111',
  message_session_id: '22222222-2222-4222-8222-222222222222',
} as const

export const psdDesignSubmitted = {
  ...baseEnvelope,
  type: 'studio.design-submitted',
  payload: {
    mockup_uuid: '33333333-3333-4333-8333-333333333333',
    render_uuid: '44444444-4444-4444-8444-444444444444',
  },
} satisfies StudioResultEvent

export const twoDDesignSubmitted = {
  ...baseEnvelope,
  type: 'studio.design-submitted',
  payload: {
    mockup_uuid: '33333333-3333-4333-8333-333333333333',
    render_uuid: '44444444-4444-4444-8444-444444444444',
  },
} satisfies StudioResultEvent

declare const acceptStudioResult: (event: StudioResultEvent) => void

acceptStudioResult({
  ...baseEnvelope,
  type: 'studio.design-submitted',
  payload: {
    mockup_uuid: '33333333-3333-4333-8333-333333333333',
    render_uuid: '44444444-4444-4444-8444-444444444444',
  },
})

acceptStudioResult({
  ...baseEnvelope,
  type: 'studio.mockup-saved',
  payload: {
    mockup_uuid: '33333333-3333-4333-8333-333333333333',
    render_uuid: '44444444-4444-4444-8444-444444444444',
  },
})
