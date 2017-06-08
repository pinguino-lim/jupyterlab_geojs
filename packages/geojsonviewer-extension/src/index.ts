/**
  Copyright (c) Jupyter Development Team.
  Distributed under the terms of the Modified BSD License.
*/

import {
  JupyterLab, 
  JupyterLabPlugin
} from '@jupyterlab/application';

import {
  ILayoutRestorer, 
  InstanceTracker
} from '@jupyterlab/apputils';

import {
  IDocumentRegistry
} from '@jupyterlab/docregistry';

import {
  IRenderMime
} from '@jupyterlab/rendermime';

import {
  GeoJSONViewer, 
  GeoJSONViewerFactory
} from '@jupyterlab/geojsonviewer';


/**
 * The name of the factory that creates geojson widgets.
 */
const FACTORY = 'GeoJSON Preview';


/**
 * The name of the factory that creates geojson widgets.
 */
const NAMESPACE = 'rendered-geojson';


/**
 * The class name for the text editor icon from the default theme.
 */
const ICON_CLASS = 'jp-ImageTextEditor';


/**
 * The geojson handler extension.
 */
const plugin: JupyterLabPlugin<void> = {
  activate,
  id: 'jupyter.extensions.rendered-geojson',
  requires: [IDocumentRegistry, IRenderMime, ILayoutRestorer],
  autoStart: true
};


/**
 * Activate the geojson plugin.
 */
function activate(app: JupyterLab, registry: IDocumentRegistry, rendermime: IRenderMime, restorer: ILayoutRestorer) {
    const factory = new GeoJSONViewerFactory({
      name: FACTORY,
      fileExtensions: ['.geojson', '.geo.json'],
      readOnly: true,
      rendermime
    });

    const tracker = new InstanceTracker<GeoJSONViewer>({ namespace: NAMESPACE });

    // Handle state restoration.
    restorer.restore(tracker, {
      command: 'file-operations:open',
      args: widget => ({ path: widget.context.path, factory: FACTORY }),
      name: widget => widget.context.path
    });

    factory.widgetCreated.connect((sender, widget) => {
      widget.title.icon = ICON_CLASS;
      // Notify the instance tracker if restore data needs to update.
      widget.context.pathChanged.connect(() => { tracker.save(widget); });
      tracker.add(widget);
    });

    registry.addWidgetFactory(factory);

    // commands.addCommand(CommandIDs.preview, {
    //   label: 'GeoJSON Preview',
    //   execute: (args) => {
    //     let path = args['path'];
    //     if (typeof path !== 'string') {
    //       return;
    //     }
    //     return commands.execute('file-operations:open', {
    //       path, factory: FACTORY
    //     });
    //   }
    // });
  }


/**
 * Export the plugin as default.
 */
export default plugin;