/**
  Copyright (c) Jupyter Development Team.
  Distributed under the terms of the Modified BSD License.
*/

import {
  JSONObject
} from '@phosphor/coreutils';

import {
  Message,
} from '@phosphor/messaging';

import {
  PanelLayout
} from '@phosphor/widgets';

import {
  Widget
} from '@phosphor/widgets';

import * as leaflet from 'leaflet';

import {
  ActivityMonitor
} from '@jupyterlab/coreutils';

import {
  DocumentRegistry, 
  ABCWidgetFactory
} from '@jupyterlab/docregistry';

import {
  MimeModel, 
  RenderMime
} from '@jupyterlab/rendermime';


/**
 * The class name added to a Jupyter GeoJSONViewer.
 */
const GEOJSON_CLASS = 'jp-GeoJSONViewer';


/**
 * The class name added to a Jupyter GeoJSONViewer.
 */
const RENDERED_GEOJSON_CLASS = 'jp-RenderedGeoJSON';


/**
 * The timeout to wait for change activity to have ceased before rendering.
 */
const RENDER_TIMEOUT = 1000;


/**
 * The mime type of GeoJSON.
 */
const MIME_TYPE = 'application/geojson';


/**
 * Set base path for leaflet images.
 */
leaflet.Icon.Default.imagePath = 'https://unpkg.com/leaflet/dist/images/';


/**
 * The url template that leaflet tile layers.
 * See http://leafletjs.com/reference-1.0.3.html#tilelayer
 */
const URL_TEMPLATE: string = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';


/**
 * The options for leaflet tile layers.
 * See http://leafletjs.com/reference-1.0.3.html#tilelayer
 */
const LAYER_OPTIONS: JSONObject = {
  attribution: 'Map data (c) <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
  minZoom: 0,
  maxZoom: 18
};


/**
 * A widget for displaying Markdown with embeded latex.
 */
export
class RenderedGeoJSON extends Widget {
  /**
   * Construct a new GeoJSON widget.
   */
  constructor(options: RenderMime.IRenderOptions) {
    super(options);
    this.addClass(RENDERED_GEOJSON_CLASS);
    let data = options.model.data.get(options.mimeType) as JSONObject | GeoJSON.GeoJsonObject;
    let metadata = options.model.metadata.get(options.mimeType) as JSONObject;
    let urlTemplate = metadata.url_template as string || URL_TEMPLATE;
    let layerOptions = metadata.layer_options as JSONObject || LAYER_OPTIONS;
    this._map = leaflet.map(this.node).fitWorld();
    leaflet.tileLayer(urlTemplate, layerOptions).addTo(this._map);
    this._map.getSize = () => {
      let map: any = this._map;
      if (!map._size || map._sizeChanged) {
        if (this._width < 0 || this._height < 0) {
          return map.prototype.getSize.call(map);
        }
        map._size = leaflet.point(this._width, this._height);
        map._sizeChanged = false;
      }
      return map._size.clone();
    };
    this._geojson = data as GeoJSON.GeoJsonObject;
    this._geojsonLayer = leaflet.geoJSON(this._geojson, options);
    this._map.addLayer(this._geojsonLayer);
    this._fitLayerBounds();
  }
  
  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this._map.remove();
    this._map = null;
    this._geojsonLayer = null;
    super.dispose();
  }

  /**
   * A message handler invoked on an `'after-attach'` message.
   */
  onAfterAttach(msg: Message): void {
    this.update();
  }
  
  /**
   * A message handler invoked on a `'resize'` message.
   */
  protected onResize(msg: Widget.ResizeMessage) {
    this._sized = true;
    this._width = msg.width;
    this._height = msg.height;
    this._map.invalidateSize(true);
    this._fitLayerBounds();
  }
  
  /**
   * Make the map fit the geojson layer bounds only once when all info is available.
   */
  private _fitLayerBounds() {
    if (!this._fitted && this._sized && this._geojsonLayer) {
      this._map.fitBounds(this._geojsonLayer.getBounds(), {});
      this._fitted = true;
    }
  }

  private _map: leaflet.Map;
  private _geojson: GeoJSON.GeoJsonObject;
  private _geojsonLayer: leaflet.GeoJSON;
  private _fitted = false;
  private _sized = false;
  private _width = -1;
  private _height = -1;
}


/**
 * A widget for rendered GeoJSON.
 */
export
class GeoJSONViewer extends Widget {
  /**
   * Construct a new GeoJSON widget.
   */
  constructor(context: DocumentRegistry.Context, rendermime: RenderMime) {
    super();
    this.addClass(GEOJSON_CLASS);
    this.layout = new PanelLayout();
    this.title.label = context.path.split('/').pop();
    this._rendermime = rendermime;
    rendermime.resolver = context;
    this._context = context;

    context.pathChanged.connect(this._onPathChanged, this);

    // Throttle the rendering rate of the widget.
    this._monitor = new ActivityMonitor({
      signal: context.model.contentChanged,
      timeout: RENDER_TIMEOUT
    });
    this._monitor.activityStopped.connect(this.update, this);    
  }

  /**
   * The GeoJSON widget's context.
   */
  get context(): DocumentRegistry.Context {
    return this._context;
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._monitor.dispose();
    super.dispose();
  }

  /**
   * Handle `'activate-request'` messages.
   */
  protected onActivateRequest(msg: Message): void {
    this.node.tabIndex = -1;
    this.node.focus();
  }

  /**
   * Handle an `after-attach` message to the widget.
   */
  protected onAfterAttach(msg: Message): void {
    this.update();
  }
  
  /**
   * Handle an `update-request` message to the widget.
   */
  protected onUpdateRequest(msg: Message): void {
    let context = this._context;
    let model = context.model;
    let data = { [MIME_TYPE]: model.toJSON() };
    let mimeModel = new MimeModel({ data, trusted: false });
    let widget = this._rendermime.render(mimeModel);
    let layout = this.layout as PanelLayout;
    if (layout.widgets.length) {
      layout.widgets[0].dispose();
    }
    layout.addWidget(widget);
  }

  /**
   * Handle a path change.
   */
  private _onPathChanged(): void {
    this.title.label = this._context.path.split('/').pop();
  }

  private _context: DocumentRegistry.Context = null;
  private _monitor: ActivityMonitor<any, any> = null;
  private _rendermime: RenderMime = null;
}


/**
 * A widget factory for GeoJSON.
 */
export
class GeoJSONViewerFactory extends ABCWidgetFactory<GeoJSONViewer, DocumentRegistry.IModel> {
  /**
   * Construct a new GeoJSON widget factory.
   */
  constructor(options: GeoJSONViewerFactory.IOptions) {
    super(options);
    this._rendermime = options.rendermime;
  }

  /**
   * Create a new widget given a context.
   */
  protected createNewWidget(context: DocumentRegistry.Context): GeoJSONViewer {
    return new GeoJSONViewer(context, this._rendermime.clone());
  }

  private _rendermime: RenderMime = null;
}


/**
 * A namespace for `GeoJSONViewerFactory` statics.
 */
export
namespace GeoJSONViewerFactory {
  /**
   * The options used to create a GeoJSON widget factory.
   */
  export
  interface IOptions extends DocumentRegistry.IWidgetFactoryOptions {
    /**
     * A rendermime instance.
     */
    rendermime: RenderMime;
  }
}