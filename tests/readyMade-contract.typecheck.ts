// The four steps the README's ready-made section prints, typechecked. The
// snippet is the contract a reader copies, so a wrong argument shape has to
// fail the build rather than the reader's first run.
import SudoMock from '../src/index'
import type { ReadyMadeTemplateDetail, ReadyMadeTemplatePage } from '../src/index'

export async function readyMadeWalkthrough(client: SudoMock): Promise<string> {
  const page: ReadyMadeTemplatePage = await client.readyMadeMockups.search({
    search: 'coffee mug',
    category: 'drinkware',
    limit: 5,
  })

  const first = page.templates[0]
  if (!first) throw new Error('No template matched')

  const template: ReadyMadeTemplateDetail =
    await client.readyMadeMockups.getTemplate(first.slug)

  const view = template.mockups?.[0]
  if (!view) throw new Error('No view available')

  const mockup = await client.photoMockups.create({ sourceUrl: view.sourceUrl })
  if (!('surfaces' in mockup)) throw new Error('Created asynchronously')

  const surface = mockup.surfaces[0]
  if (!surface) throw new Error('No surface available')

  const result = await client.photoMockups.render({
    mockupId: mockup.mockupId,
    printAreas: [{
      surfaceUuid: surface.surfaceUuid,
      artworkUrl: 'https://example.com/artwork.png',
      placement: { coverage: 60 },
    }],
  })
  if (!('url' in result)) throw new Error('Rendered asynchronously')
  return result.url
}
