var L = require('leaflet');
require('./layout.css');
require('./range.css');

var mapWasDragEnabled;
var mapWasTapEnabled;

// Function to get the appropriate event for range input
function getRangeEvent(rangeInput) {
  return 'oninput' in rangeInput ? 'input' : 'change';
}

// Function to disable map dragging and tapping
function cancelMapDrag() {
  mapWasDragEnabled = this._map.dragging.enabled();
  mapWasTapEnabled = this._map.tap && this._map.tap.enabled();
  this._map.dragging.disable();
  if (this._map.tap) this._map.tap.disable();
}

// Function to re-enable map dragging and tapping
function uncancelMapDrag() {
  if (mapWasDragEnabled) {
    this._map.dragging.enable();
  }
  if (mapWasTapEnabled) {
    this._map.tap.enable();
  }
}

// Convert argument to array
function asArray(arg) {
  return arg === undefined ? [] : Array.isArray(arg) ? arg : [arg];
}

function noop() {}

L.Control.SideBySide = L.Control.extend({
  options: {
    thumbSize: 42,
    padding: 0
  },

  initialize: function(leftLayers, rightLayers, options) {
    this.setLeftLayers(leftLayers);
    this.setRightLayers(rightLayers);
    L.setOptions(this, options);
  },

  getPosition: function() {
    var rangeValue = this._range.value;
    var offset = (0.5 - rangeValue) * (2 * this.options.padding + this.options.thumbSize);
    return this._map.getSize().x * rangeValue + offset;
  },

  setPosition: noop,

  addTo: function(map) {
    this.remove();
    this._map = map;

    // Create custom panes for left and right layers
    map.createPane('leftPane');
    map.createPane('rightPane');

    // Optional: Set z-index for panes to manage layer stacking
    map.getPane('leftPane').style.zIndex = 400;
    map.getPane('rightPane').style.zIndex = 401;

    var container = (this._container = L.DomUtil.create('div', 'leaflet-sbs', map._controlContainer));

    this._divider = L.DomUtil.create('div', 'leaflet-sbs-divider', container);
    var range = (this._range = L.DomUtil.create('input', 'leaflet-sbs-range', container));
    range.type = 'range';
    range.min = 0;
    range.max = 1;
    range.step = 'any';
    range.value = 0.5;
    range.style.paddingLeft = range.style.paddingRight = this.options.padding + 'px';
    this._addEvents();
    this._updateLayers();
    return this;
  },

  remove: function() {
    if (!this._map) {
      return this;
    }
    if (this._leftLayer) {
      var leftPane = this._map.getPane('leftPane');
      if (leftPane) {
        leftPane.style.clip = '';
      }
    }
    if (this._rightLayer) {
      var rightPane = this._map.getPane('rightPane');
      if (rightPane) {
        rightPane.style.clip = '';
      }
    }
    this._removeEvents();
    L.DomUtil.remove(this._container);

    this._map = null;

    return this;
  },

  setLeftLayers: function(leftLayers) {
    this._leftLayers = asArray(leftLayers);
    this._updateLayers();
    return this;
  },

  setRightLayers: function(rightLayers) {
    this._rightLayers = asArray(rightLayers);
    this._updateLayers();
    return this;
  },

  _updateClip: function() {
    var map = this._map;
    var nw = map.containerPointToLayerPoint([0, 0]);
    var se = map.containerPointToLayerPoint(map.getSize());
    var clipX = nw.x + this.getPosition();
    var dividerX = this.getPosition();

    this._divider.style.left = dividerX + 'px';
    this.fire('dividermove', { x: dividerX });
    var clipLeft = 'rect(' + [nw.y, clipX, se.y, nw.x].join('px,') + 'px)';
    var clipRight = 'rect(' + [nw.y, se.x, se.y, clipX].join('px,') + 'px)';

    if (this._leftLayer) {
      var leftPane = this._map.getPane('leftPane');
      if (leftPane) {
        leftPane.style.clip = clipLeft;
      }
    }
    if (this._rightLayer) {
      var rightPane = this._map.getPane('rightPane');
      if (rightPane) {
        rightPane.style.clip = clipRight;
      }
    }
  },

  _updateLayers: function() {
    if (!this._map) {
      return this;
    }
    var prevLeft = this._leftLayer;
    var prevRight = this._rightLayer;
    this._leftLayer = this._rightLayer = null;

    // Update left layers
    this._leftLayers.forEach(function(layer) {
      if (this._map.hasLayer(layer)) {
        this._leftLayer = layer;
        if (layer.options.pane !== 'leftPane') {
          layer.options.pane = 'leftPane';
          layer.remove();
          layer.addTo(this._map);
        }
      }
    }, this);

    // Update right layers
    this._rightLayers.forEach(function(layer) {
      if (this._map.hasLayer(layer)) {
        this._rightLayer = layer;
        if (layer.options.pane !== 'rightPane') {
          layer.options.pane = 'rightPane';
          layer.remove();
          layer.addTo(this._map);
        }
      }
    }, this);

    if (prevLeft !== this._leftLayer) {
      if (prevLeft) this.fire('leftlayerremove', { layer: prevLeft });
      if (this._leftLayer) this.fire('leftlayeradd', { layer: this._leftLayer });
    }
    if (prevRight !== this._rightLayer) {
      if (prevRight) this.fire('rightlayerremove', { layer: prevRight });
      if (this._rightLayer) this.fire('rightlayeradd', { layer: this._rightLayer });
    }
    this._updateClip();
  },

  _addEvents: function() {
    var range = this._range;
    var map = this._map;
    if (!map || !range) return;
    map.on('move', this._updateClip, this);
    map.on('layeradd layerremove', this._updateLayers, this);
    L.DomEvent.on(range, getRangeEvent(range), this._updateClip, this);
    L.DomEvent.on(range, 'mousedown touchstart', cancelMapDrag, this);
    L.DomEvent.on(range, 'mouseup touchend', uncancelMapDrag, this);
  },

  _removeEvents: function() {
    var range = this._range;
    var map = this._map;
    if (range) {
      L.DomEvent.off(range, getRangeEvent(range), this._updateClip, this);
      L.DomEvent.off(range, 'mousedown touchstart', cancelMapDrag, this);
      L.DomEvent.off(range, 'mouseup touchend', uncancelMapDrag, this);
    }
    if (map) {
      map.off('layeradd layerremove', this._updateLayers, this);
      map.off('move', this._updateClip, this);
    }
  }
});

L.control.sideBySide = function(leftLayers, rightLayers, options) {
  return new L.Control.SideBySide(leftLayers, rightLayers, options);
};

module.exports = L.Control.SideBySide;
