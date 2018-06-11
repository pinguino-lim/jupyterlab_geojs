import logging
import os

from IPython.display import display, JSON
from .geojsfeaturelayer import GeoJSFeatureLayer
from .geojsosmlayer import GeoJSOSMLayer

# A display class that can be used in Jupyter notebooks:
#   from jupyterlab_geojs import GeoJSMap
#   GeoJSMap()

MIME_TYPE = 'application/geojs+json'

class GeoJSMap(JSON):
    """A display class for displaying GeoJS visualizations in the Jupyter Notebook and IPython kernel.

    GeoJSMap expects a JSON-able dict, not serialized JSON strings.

    Scalar types (None, number, string) are not allowed, only dict containers.
    """

    # List of options (names) to be added as a public member of each instance.
    # No error checking is done in this class.
    OptionNames = [
        'allowRotation',
        'center',
        'clampBoundsX',
        'clampBoundsY',
        'clampZoom',
        'discreteZoom',
        'gcs',
        'ingcs',
        'maxBounds',
        'minZoom',
        'maxZoom',
        'rotation',
        'unitsPerPixel',
        'zoom'
    ]

    def __init__(self, **kwargs):
        '''
        '''
        super(GeoJSMap, self).__init__()
        # Public members
        for name in self.__class__.OptionNames:
            value = kwargs.get(name)
            setattr(self, name, value)
        # Todo create attributes for any kwargs not in MemberNames,
        # for forward compatibility with GeoJS

        # Internal members
        self._options = kwargs
        self._layers = list()
        self._layer_lookup = dict()  # <layer, index>
        self._logger = None

    def createLayer(self, layer_type, **kwargs):
        if False: pass
        # elif layer_type == 'annotation':
        #     layer = GeoJSAnnotationLayer(**kwargs)
        elif layer_type == 'feature':
            layer = GeoJSFeatureLayer(**kwargs)
        elif layer_type == 'osm':
            layer = GeoJSOSMLayer(**kwargs)
        # elif layer_type == 'ui':
        #     layer = GeoJSUILayer(**kwargs)
        else:
            raise Exception('Unrecognized layer type \"{}\"'.format(layerType))

        self._layers.append(layer)
        return layer

    def create_logger(self, folder, filename='geojsmap.log'):
        '''Initialize logger with file handler

        @param folder (string) directory to store logfile
        '''
        os.makedirs(folder, exist_ok=True)  # create folder if needed

        log_name, ext = os.path.splitext(filename)
        self._logger = logging.getLogger(log_name)
        self._logger.setLevel(logging.INFO)  # default

        log_path = os.path.join(folder, filename)
        fh = logging.FileHandler(log_path, 'w')
        self._logger.addHandler(fh)
        return self._logger

    def _build_data(self):
        data = dict()  # return value

        # Copy options that have been set
        for name in self.__class__.OptionNames:
            value = getattr(self, name, None)
            if value is not None:
                self._options[name] = value
        data['options'] = self._options

        layer_list = list()
        for layer in self._layers:
            layer_list.append(layer._build_data())
        data['layers'] = layer_list
        return data


    def _ipython_display_(self):
        if self._logger is not None:
            self._logger.debug('Enter GeoJSMap._ipython_display_()')
        data = self._build_data()
        bundle = {
            MIME_TYPE: data,
            'text/plain': '<jupyterlab_geojs.GeoJSMap object>'
        }
        metadata = {
            MIME_TYPE: self.metadata
        }
        if self._logger is not None:
            self._logger.debug('display bundle: {}'.format(bundle))
            self._logger.debug('metadata: {}'.format(metadata))
        display(bundle, metadata=metadata, raw=True)
