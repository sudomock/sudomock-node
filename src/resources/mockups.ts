import { publicWarnings, type HttpClient } from '../client'
import type { ListMockupsParams, Mockup, MockupListResult } from '../types'

export function toPublicMockup(mockup: Mockup): Mockup {
  return {
    uuid: mockup.uuid,
    name: mockup.name,
    thumbnail: mockup.thumbnail,
    width: mockup.width,
    height: mockup.height,
    smartObjects: mockup.smartObjects.map((smartObject) => ({
      uuid: smartObject.uuid,
      name: smartObject.name,
      size: {
        width: smartObject.size.width,
        height: smartObject.size.height,
      },
      position: {
        x: smartObject.position.x,
        y: smartObject.position.y,
        width: smartObject.position.width,
        height: smartObject.position.height,
      },
      printAreaPresets: smartObject.printAreaPresets.map((preset) => ({
        uuid: preset.uuid,
        name: preset.name,
        thumbnails: preset.thumbnails.map((thumbnail) => ({
          width: thumbnail.width,
          url: thumbnail.url,
        })),
        size: { width: preset.size.width, height: preset.size.height },
        position: {
          x: preset.position.x,
          y: preset.position.y,
          width: preset.position.width,
          height: preset.position.height,
        },
      })),
      layerName: smartObject.layerName,
      quad: smartObject.quad?.map((point) => [...point]) ?? smartObject.quad,
      blendMode: smartObject.blendMode,
      instanceCount: smartObject.instanceCount,
    })),
    textLayers: mockup.textLayers.map((layer) => ({
      uuid: layer.uuid,
      name: layer.name,
      textContent: layer.textContent,
      fontPostscriptName: layer.fontPostscriptName,
      fontSize: layer.fontSize,
      color: layer.color,
      fontAvailable: layer.fontAvailable,
      isEditable: layer.isEditable,
      segmentCount: layer.segmentCount,
      segments: layer.segments?.map((segment) => ({
        index: segment.index,
        text: segment.text,
        fontPostscriptName: segment.fontPostscriptName,
        fontSize: segment.fontSize,
        color: segment.color,
      })) ?? layer.segments,
      visible: layer.visible,
      hasStrokeEffect: layer.hasStrokeEffect,
      strokeCount: layer.strokeCount,
      hasColorOverlay: layer.hasColorOverlay,
      hasClippedArtwork: layer.hasClippedArtwork,
      suggestedEditTogether: layer.suggestedEditTogether,
    })),
    collections: mockup.collections,
    thumbnails: mockup.thumbnails.map((thumbnail) => ({
      width: thumbnail.width,
      url: thumbnail.url,
    })),
    warnings: publicWarnings(mockup.warnings),
  }
}

export class MockupsResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * List mockups with pagination and filtering.
   *
   * @example
   * ```ts
   * const { mockups, total } = await client.mockups.list({ limit: 10 })
   * ```
   */
  async list(params: ListMockupsParams = {}): Promise<MockupListResult> {
    const result = await this.client.request<MockupListResult>({
      method: 'GET',
      path: '/api/v1/mockups',
      query: {
        limit: params.limit,
        offset: params.offset,
        name: params.name,
        created_after: params.createdAfter,
        created_before: params.createdBefore,
        sort: params.sort,
        order: params.order,
      },
    })
    return {
      mockups: result.mockups.map(toPublicMockup),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    }
  }

  /**
   * Get a single mockup by UUID.
   *
   * @example
   * ```ts
   * const mockup = await client.mockups.get('uuid')
   * console.log(mockup.smartObjects)
   * ```
   */
  async get(uuid: string): Promise<Mockup> {
    const mockup = await this.client.request<Mockup>({
      method: 'GET',
      path: `/api/v1/mockups/${uuid}`,
    })
    return toPublicMockup(mockup)
  }

  /**
   * Update a mockup's name.
   *
   * @example
   * ```ts
   * const updated = await client.mockups.update('uuid', { name: 'New Name' })
   * ```
   */
  async update(uuid: string, params: { name: string }): Promise<Mockup> {
    const mockup = await this.client.request<Mockup>({
      method: 'PATCH',
      path: `/api/v1/mockups/${uuid}`,
      body: params,
    })
    return toPublicMockup(mockup)
  }

  /**
   * Delete a mockup permanently.
   *
   * @example
   * ```ts
   * await client.mockups.delete('uuid')
   * ```
   */
  async delete(uuid: string): Promise<void> {
    await this.client.request<void>({
      method: 'DELETE',
      path: `/api/v1/mockups/${uuid}`,
    })
  }
}
