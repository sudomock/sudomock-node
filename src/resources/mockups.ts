import { publicWarnings, type HttpClient } from '../client'
import type {
  ListMockupsParams,
  Mockup,
  MockupLayer,
  MockupLayersResult,
  MockupListResult,
  SmartObject,
  TextLayer,
} from '../types'

function toPublicLayer(layer: MockupLayer): MockupLayer {
  return {
    uuid: layer.uuid,
    name: layer.name,
    kind: layer.kind,
    visible: layer.visible,
    children: (layer.children ?? []).map(toPublicLayer),
  }
}

function toPublicTextLayer(layer: TextLayer): TextLayer {
  return {
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
  }
}

function toPublicSmartObject(smartObject: SmartObject): SmartObject {
  const result: SmartObject = {
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
  }
  if (smartObject.smartObjects) {
    result.smartObjects = smartObject.smartObjects.map(toPublicSmartObject)
  }
  if (smartObject.textLayers) {
    result.textLayers = smartObject.textLayers.map(toPublicTextLayer)
  }
  return result
}

export function toPublicMockup(mockup: Mockup): Mockup {
  return {
    uuid: mockup.uuid,
    name: mockup.name,
    thumbnail: mockup.thumbnail,
    width: mockup.width,
    height: mockup.height,
    smartObjects: mockup.smartObjects.map(toPublicSmartObject),
    textLayers: mockup.textLayers.map(toPublicTextLayer),
    collections: mockup.collections,
    thumbnails: mockup.thumbnails.map((thumbnail) => ({
      width: thumbnail.width,
      url: thumbnail.url,
    })),
    warnings: publicWarnings(mockup.warnings),
  }
}

/** Path the PSD-mockup family is served on. */
export const PSD_MOCKUPS_PATH = '/api/v1/psd-mockups'
/** Path `client.mockups` was published on; it still answers. */
export const EARLIER_PSD_MOCKUPS_PATH = '/api/v1/mockups'

export class MockupsResource {
  constructor(
    private readonly client: HttpClient,
    private readonly basePath: string = PSD_MOCKUPS_PATH,
  ) {}

  /**
   * List mockups with pagination and filtering.
   *
   * @example
   * ```ts
   * const { mockups, total } = await client.psdMockups.list({ limit: 10 })
   * ```
   */
  async list(params: ListMockupsParams = {}): Promise<MockupListResult> {
    const result = await this.client.request<MockupListResult>({
      method: 'GET',
      path: this.basePath,
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
   * const mockup = await client.psdMockups.get('uuid')
   * console.log(mockup.smartObjects)
   * ```
   */
  async get(uuid: string): Promise<Mockup> {
    const mockup = await this.client.request<Mockup>({
      method: 'GET',
      path: `${this.basePath}/${uuid}`,
    })
    return toPublicMockup(mockup)
  }

  /**
   * List every layer of a mockup, nested the way Photoshop's Layers panel
   * shows them and front-most first. A smart object whose contents hold
   * layers you can fill lists those layers as its children. Pass a layer's
   * `uuid` in `hiddenLayers` on `client.renders.create` to leave it out of
   * one render. Costs no credits.
   *
   * @example
   * ```ts
   * const { layers } = await client.psdMockups.layers('uuid')
   * console.log(layers.map((layer) => `${layer.kind}: ${layer.name}`))
   * ```
   */
  async layers(uuid: string): Promise<MockupLayersResult> {
    const result = await this.client.request<MockupLayersResult>({
      method: 'GET',
      path: `${this.basePath}/${uuid}/layers`,
    })
    return {
      mockupUuid: result.mockupUuid,
      layers: result.layers.map(toPublicLayer),
    }
  }

  /**
   * Update a mockup's name.
   *
   * @example
   * ```ts
   * const updated = await client.psdMockups.update('uuid', { name: 'New Name' })
   * ```
   */
  async update(uuid: string, params: { name: string }): Promise<Mockup> {
    const mockup = await this.client.request<Mockup>({
      method: 'PATCH',
      path: `${this.basePath}/${uuid}`,
      body: params,
    })
    return toPublicMockup(mockup)
  }

  /**
   * Delete a mockup permanently.
   *
   * @example
   * ```ts
   * await client.psdMockups.delete('uuid')
   * ```
   */
  async delete(uuid: string): Promise<void> {
    await this.client.request<void>({
      method: 'DELETE',
      path: `${this.basePath}/${uuid}`,
    })
  }
}
