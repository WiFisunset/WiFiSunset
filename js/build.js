(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require('aframe-entity-generator-component');
require('aframe-layout-component');
require('aframe-template-component');
require('../index');
},{"../index":2,"aframe-entity-generator-component":3,"aframe-layout-component":4,"aframe-template-component":5}],2:[function(require,module,exports){
if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}
// Single audio context.
var context;
/**
 * Audio visualizer system for A-Frame. Share AnalyserNodes between components that share the
 * the `src`.
 */
AFRAME.registerSystem('audioanalyser', {
  init: function () {
    this.analysers = {};
  },
  getOrCreateAnalyser: function (data) {
    if (!context) { context = new AudioContext(); }
    var analysers = this.analysers;
    var analyser = context.createAnalyser();
    var audioEl = data.src;
    var src = audioEl.getAttribute('src');
    if (analysers[src]) { return analysers[src]; }
    var source = context.createMediaElementSource(audioEl)
    source.connect(analyser);
    analyser.connect(context.destination);
    analyser.smoothingTimeConstant = data.smoothingTimeConstant;
    analyser.fftSize = data.fftSize;
    // Store.
    analysers[src] = analyser;
    return analysers[src];
  }
});
/**
 * Audio visualizer component for A-Frame using AnalyserNode.
 */
AFRAME.registerComponent('audioanalyser', {
  schema: {
    enableBeatDetection: {default: true},
    enableLevels: {default: true},
    enableWaveform: {default: true},
    enableVolume: {default: true},
    fftSize: {default: 2048},
    smoothingTimeConstant: {default: 0.8},
    src: {type: 'selector'},
    unique: {default: false}
  },
  init: function () {
    this.analyser = null;
    this.levels = null;
    this.waveform = null;
    this.volume = 0;
  },
  update: function () {
    var data = this.data;
    var self = this;
    var system = this.system;
    if (!data.src) { return; }
    // Get or create AnalyserNode.
    if (data.unique) {
      init(system.createAnalyser(data));
    } else {
      init(system.getOrCreateAnalyser(data));
    }
    function init (analyser) {
      self.analyser = analyser;
      self.levels = new Uint8Array(self.analyser.frequencyBinCount);
      self.waveform = new Uint8Array(self.analyser.fftSize);
      self.el.emit('audioanalyser-ready', {analyser: analyser});
    }
  },
  /**
   * Update spectrum on each frame.
   */
  tick: function () {
    var data = this.data;
    if (!this.analyser) { return; }
    // Levels (frequency).
    if (data.enableLevels || data.enableVolume) {
      this.analyser.getByteFrequencyData(this.levels);
    }
    // Waveform.
    if (data.enableWaveform) {
      this.analyser.getByteTimeDomainData(this.waveform);
    }
    // Average volume.
    if (data.enableVolume || data.enableBeatDetection) {
      var sum = 0;
      for (var i = 0; i < this.levels.length; i++) {
        sum += this.levels[i];;
      }
      this.volume = sum / this.levels.length;
    }
    // Beat detection.
    if (data.enableBeatDetection) {
      var BEAT_DECAY_RATE = 0.99;
      var BEAT_HOLD = 60;
      var BEAT_MIN = 0.15;  // Volume less than this is no beat.
      volume = this.volume;
      if (!this.beatCutOff) { this.beatCutOff = volume; }
      if (volume > this.beatCutOff && volume > BEAT_MIN) {
        console.log('[audioanalyser] Beat detected.');
        this.el.emit('audioanalyser-beat');
        this.beatCutOff = volume * 1.5;
        this.beatTime = 0;
      } else {
        if (this.beatTime <= BEAT_HOLD) {
          this.beatTime++;
        } else {
          this.beatCutOff *= BEAT_DECAY_RATE;
          this.beatCutOff = Math.max(this.beatCutOff, BEAT_MIN);
        }
      }
    }
  }
});
},{}],3:[function(require,module,exports){
if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}
/**
 * Entity Generator component for A-Frame.
 * Create number of entities given a mixin.
 */
AFRAME.registerComponent('entity-generator', {
  schema: {
    mixin: {default: ''},
    num: {default: 10}
  },
  init: function () {
    var data = this.data;
    // Create entities with supplied mixin.
    for (var i = 0; i < data.num; i++) {
      var entity = document.createElement('a-entity');
      entity.setAttribute('mixin', data.mixin);
      this.el.appendChild(entity);
    }
  }
});
},{}],4:[function(require,module,exports){
/**
 * Layout component for A-Frame.
 * Some layouts adapted from http://www.vb-helper.com/tutorial_platonic_solids.html
 */
AFRAME.registerComponent('layout', {
  schema: {
    columns: {default: 1, min: 0, if: {type: ['box']}},
    margin: {default: 1, min: 0, if: { type: ['box', 'line']}},
    radius: {default: 1, min: 0, if: {
      type: ['circle', 'cube', 'dodecahedron', 'pyramid']
    }},
    type: {default: 'line', oneOf: [
      'box', 'circle', 'cube', 'dodecahedron', 'line', 'pyramid'
    ]}
  },
  /**
   * Store initial positions in case need to reset on component removal.
   */
  init: function () {
    var self = this;
    var el = this.el;
    this.children = el.getChildEntities();
    this.initialPositions = [];
    this.children.forEach(function getInitialPositions (childEl) {
      if (childEl.hasLoaded) { return _getPositions(); }
      childEl.addEventListener('loaded', _getPositions);
      function _getPositions () {
        var position = childEl.getComputedAttribute('position');
        self.initialPositions.push([position.x, position.y, position.z]);
      }
    });
    el.addEventListener('child-attached', function (evt) {
      // Only update if direct child attached.
      if (evt.detail.el.parentNode !== el) { return; }
      self.children.push(evt.detail.el);
      self.update();
    });
  },
  /**
   * Update child entity positions.
   */
  update: function (oldData) {
    var children = this.children;
    var data = this.data;
    var el = this.el;
    var numChildren = children.length;
    var positionFn;
    var positions;
    var startPosition = el.getComputedAttribute('position');
    // Calculate different positions based on layout shape.
    switch (data.type) {
      case 'box': {
        positionFn = getBoxPositions;
        break;
      }
      case 'circle': {
        positionFn = getCirclePositions;
        break;
      }
      case 'cube': {
        positionFn = getCubePositions;
        break;
      }
      case 'dodecahedron': {
        positionFn = getDodecahedronPositions;
        break;
      }
      case 'pyramid': {
        positionFn = getPyramidPositions;
        break;
      }
      default: {
        // Line.
        positionFn = getLinePositions;
      }
    }
    positions = positionFn(data, numChildren, startPosition);
    setPositions(children, positions);
  },
  /**
   * Reset positions.
   */
  remove: function () {
    this.el.removeEventListener('child-attached', this.childAttachedCallback);
    setPositions(this.children, this.initialPositions);
  }
});
/**
 * Get positions for `box` layout.
 */
function getBoxPositions (data, numChildren, startPosition) {
  var positions = [];
  var rows = Math.ceil(numChildren / data.columns);
  for (var row = 0; row < rows; row++) {
    for (var column = 0; column < data.columns; column++) {
      positions.push([
        column * data.margin,
        row * data.margin,
        0
      ]);
    }
  }
  return positions;
}
module.exports.getBoxPositions = getBoxPositions;
/**
 * Get positions for `circle` layout.
 * TODO: arcLength.
 */
function getCirclePositions (data, numChildren, startPosition) {
  var positions = [];
  for (var i = 0; i < numChildren; i++) {
    var rad = i * (2 * Math.PI) / numChildren;
    positions.push([
      startPosition.x + data.radius * Math.cos(rad),
      startPosition.y,
      startPosition.z + data.radius * Math.sin(rad)
    ]);
  }
  return positions;
}
module.exports.getCirclePositions = getCirclePositions;
/**
 * Get positions for `line` layout.
 * TODO: 3D margins.
 */
function getLinePositions (data, numChildren, startPosition) {
  data.columns = numChildren;
  return getBoxPositions(data, numChildren, startPosition);
}
module.exports.getLinePositions = getLinePositions;
/**
 * Get positions for `cube` layout.
 */
function getCubePositions (data, numChildren, startPosition) {
  return transform([
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [-1, 0, 0],
    [0, -1, 0],
    [0, 0, -1],
  ], startPosition, data.radius / 2);
}
module.exports.getCubePositions = getCubePositions;
/**
 * Get positions for `dodecahedron` layout.
 */
function getDodecahedronPositions (data, numChildren, startPosition) {
  var PHI = (1 + Math.sqrt(5)) / 2;
  var B = 1 / PHI;
  var C = 2 - PHI;
  var NB = -1 * B;
  var NC = -1 * C;
  return transform([
    [-1, C, 0],
    [-1, NC, 0],
    [0, -1, C],
    [0, -1, NC],
    [0, 1, C],
    [0, 1, NC],
    [1, C, 0],
    [1, NC, 0],
    [B, B, B],
    [B, B, NB],
    [B, NB, B],
    [B, NB, NB],
    [C, 0, 1],
    [C, 0, -1],
    [NB, B, B],
    [NB, B, NB],
    [NB, NB, B],
    [NB, NB, NB],
    [NC, 0, 1],
    [NC, 0, -1],
  ], startPosition, data.radius / 2);
}
module.exports.getDodecahedronPositions = getDodecahedronPositions;
/**
 * Get positions for `pyramid` layout.
 */
function getPyramidPositions (data, numChildren, startPosition) {
  var SQRT_3 = Math.sqrt(3);
  var NEG_SQRT_1_3 = -1 / Math.sqrt(3);
  var DBL_SQRT_2_3 = 2 * Math.sqrt(2 / 3);
  return transform([
    [0, 0, SQRT_3 + NEG_SQRT_1_3],
    [-1, 0, NEG_SQRT_1_3],
    [1, 0, NEG_SQRT_1_3],
    [0, DBL_SQRT_2_3, 0]
  ], startPosition, data.radius / 2);
}
module.exports.getPyramidPositions = getPyramidPositions;
/**
 * Multiply all coordinates by a scale factor and add translate.
 *
 * @params {array} positions - Array of coordinates in array form.
 * @returns {array} positions
 */
function transform (positions, translate, scale) {
  translate = [translate.x, translate.y, translate.z];
  return positions.map(function (position) {
    return position.map(function (point, i) {
      return point * scale + translate[i];
    });
  });
};
/**
 * Set position on child entities.
 *
 * @param {array} els - Child entities to set.
 * @param {array} positions - Array of coordinates.
 */
function setPositions (els, positions) {
  els.forEach(function (el, i) {
    var position = positions[i];
    el.setAttribute('position', {
      x: position[0],
      y: position[1],
      z: position[2]
    });
  });
}
},{}],5:[function(require,module,exports){
var templateString = require('es6-template-strings');
var debug = AFRAME.utils.debug;
var extend = AFRAME.utils.extend;
var templateCache = {};  // Template cache.
var error = debug('template-component:error');
var log = debug('template-component:info');
var HANDLEBARS = 'handlebars';
var JADE = 'jade';
var MUSTACHE = 'mustache';
var NUNJUCKS = 'nunjucks';
var HTML = 'html';
var LIB_LOADED = {};
LIB_LOADED[HANDLEBARS] = !!window.Handlebars;
LIB_LOADED[JADE] = !!window.jade;
LIB_LOADED[MUSTACHE] = !!window.Mustache;
LIB_LOADED[NUNJUCKS] = !!window.nunjucks;
var LIB_SRC = {};
LIB_SRC[HANDLEBARS] = 'https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.0.5/handlebars.min.js';
LIB_SRC[JADE] = 'https://cdnjs.cloudflare.com/ajax/libs/jade/1.11.0/jade.min.js';
LIB_SRC[MUSTACHE] = 'https://cdnjs.cloudflare.com/ajax/libs/mustache.js/2.2.1/mustache.min.js';
LIB_SRC[NUNJUCKS] = 'https://cdnjs.cloudflare.com/ajax/libs/nunjucks/2.3.0/nunjucks.min.js';
AFRAME.registerComponent('template', {
  schema: {
    insert: {
      // insertAdjacentHTML.
      default: 'beforeend'
    },
    type: {
      default: ''
    },
    src: {
      // Selector or URL.
      default: ''
    },
    data: {
      default: ''
    }
  },
  update: function (oldData) {
    var data = this.data;
    var el = this.el;
    var fetcher = data.src[0] === '#' ? fetchTemplateFromScriptTag : fetchTemplateFromXHR;
    var templateCacheItem = templateCache[data.src];
    // Replace children if swapping templates.
    if (oldData && oldData.src !== data.src) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    }
    if (templateCacheItem) {
      this.renderTemplate(templateCacheItem);
      return;
    }
    fetcher(data.src, data.type).then(this.renderTemplate.bind(this));
  },
  renderTemplate: function (templateCacheItem) {
    var el = this.el;
    var data = this.data;
    var templateData = {};
    Object.keys(el.dataset).forEach(function convertToData (key) {
      templateData[key] = el.dataset[key];
    });
    if (data.data) {
      templateData = extend(templateData, el.getAttribute(data.data));
    }
    var renderedTemplate = renderTemplate(templateCacheItem.template, templateCacheItem.type,
                                          templateData);
    el.insertAdjacentHTML(data.insert, renderedTemplate);
    el.emit('templaterendered');
  }
});
/**
 * Helper to compile template, lazy-loading the template engine if needed.
 */
function compileTemplate (src, type, templateStr) {
  return new Promise(function (resolve) {
    injectTemplateLib(type).then(function () {
      templateCache[src] = {
        template: getCompiler(type)(templateStr.trim()),
        type: type
      };
      resolve(templateCache[src]);
    });
  });
}
function renderTemplate (template, type, context) {
  switch (type) {
    case HANDLEBARS: {
      return template(context);
    }
    case JADE: {
      return template(context);
    }
    case MUSTACHE: {
      return Mustache.render(template, context);
    }
    case NUNJUCKS: {
      return template.render(context);
    }
    default: {
      // If type not specified, assume HTML. Add some ES6 template string sugar.
      return templateString(template, context);
    }
  }
}
/**
 * Cache and compile templates.
 */
function fetchTemplateFromScriptTag (src, type) {
  var compiler;
  var scriptEl = document.querySelector(src);
  var scriptType = scriptEl.getAttribute('type');
  var templateStr = scriptEl.innerHTML;
  // Try to infer template type from <script type> if type not specified.
  if (!type) {
    if (!scriptType) {
      throw new Error('Must provide `type` attribute for <script> templates (e.g., handlebars, jade, nunjucks, html)');
    }
    if (scriptType.indexOf('handlebars') !== -1) {
      type = HANDLEBARS;
    } else if (scriptType.indexOf('jade') !== -1) {
      type = JADE
    } else if (scriptType.indexOf('mustache') !== -1) {
      type = MUSTACHE;
    } else if (scriptType.indexOf('nunjucks') !== -1) {
      type = NUNJUCKS
    } else if (scriptType.indexOf('html') !== -1) {
      type = HTML;
    } else {
      error('Template type could not be inferred from the script tag. Please add a type.');
      return;
    }
  }
  return new Promise(function (resolve) {
    compileTemplate(src, type, templateStr).then(function (template) {
      resolve(template, type);
    });
  });
}
function fetchTemplateFromXHR (src, type) {
  return new Promise(function (resolve) {
    var request;
    request = new XMLHttpRequest();
    request.addEventListener('load', function () {
      // Template fetched. Use template.
      compileTemplate(src, type, request.response).then(function (template) {
        resolve(template, type);
      });
    });
    request.open('GET', src);
    request.send();
  });
}
/**
 * Get compiler given type.
 */
function getCompiler (type) {
  switch (type) {
    case HANDLEBARS: {
      return compileHandlebarsTemplate;
    }
    case JADE: {
      return compileJadeTemplate;
    }
    case MUSTACHE: {
      return compileHandlebarsTemplate;
    }
    case NUNJUCKS: {
      return compileNunjucksTemplate;
    }
    default: {
      // If type not specified, assume raw HTML and no templating needed.
      return function (str) { return str; };
    }
  }
}
function compileHandlebarsTemplate (templateStr) {
  return Handlebars.compile(templateStr);
}
function compileJadeTemplate (templateStr) {
  return jade.compile(templateStr);
}
function compileMustacheTemplate (templateStr) {
  Mustache.parse(templateStr);
  return templateStr;
}
function compileNunjucksTemplate (templateStr) {
  return nunjucks.compile(templateStr);
}
function injectTemplateLib (type) {
  return new Promise(function (resolve) {
    // No lib injection required.
    if (!type || type === 'html') { return resolve(); }
    var scriptEl = LIB_LOADED[type];
    // Engine loaded.
    if (LIB_LOADED[type] === true) { return resolve(); }
    // Start lazy-loading.
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      LIB_LOADED[type] = scriptEl;
      scriptEl.setAttribute('src', LIB_SRC[type]);
      log('Lazy-loading %s engine. Please add <script src="%s"> to your page.',
          type, LIB_SRC[type]);
      document.body.appendChild(scriptEl);
    }
    // Wait for onload, whether just injected or already lazy-loading.
    var prevOnload = scriptEl.onload || function () {};
    scriptEl.onload = function () {
      prevOnload();
      LIB_LOADED[type] = true;
      resolve();
    };
  });
};
AFRAME.registerComponent('template-set', {
  schema: {
    on: {type: 'string'},
    src: {type: 'string'},
    data: {type: 'string'}
  },
  init: function () {
    var data = this.data;
    var el = this.el;
    el.addEventListener(data.on, function () {
      el.setAttribute('template', {src: data.src, data: data.data});
    });
  }
});
},{"es6-template-strings":39}],6:[function(require,module,exports){
'use strict';
var assign        = require('es5-ext/object/assign')
  , normalizeOpts = require('es5-ext/object/normalize-options')
  , isCallable    = require('es5-ext/object/is-callable')
  , contains      = require('es5-ext/string/#/contains')
  , d;
d = module.exports = function (dscr, value/*, options*/) {
	var c, e, w, options, desc;
	if ((arguments.length < 2) || (typeof dscr !== 'string')) {
		options = value;
		value = dscr;
		dscr = null;
	} else {
		options = arguments[2];
	}
	if (dscr == null) {
		c = w = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
		w = contains.call(dscr, 'w');
	}
	desc = { value: value, configurable: c, enumerable: e, writable: w };
	return !options ? desc : assign(normalizeOpts(options), desc);
};
d.gs = function (dscr, get, set/*, options*/) {
	var c, e, options, desc;
	if (typeof dscr !== 'string') {
		options = set;
		set = get;
		get = dscr;
		dscr = null;
	} else {
		options = arguments[3];
	}
	if (get == null) {
		get = undefined;
	} else if (!isCallable(get)) {
		options = get;
		get = set = undefined;
	} else if (set == null) {
		set = undefined;
	} else if (!isCallable(set)) {
		options = set;
		set = undefined;
	}
	if (dscr == null) {
		c = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
	}
	desc = { get: get, set: set, configurable: c, enumerable: e };
	return !options ? desc : assign(normalizeOpts(options), desc);
};
},{"es5-ext/object/assign":18,"es5-ext/object/is-callable":21,"es5-ext/object/normalize-options":25,"es5-ext/string/#/contains":29}],7:[function(require,module,exports){
'use strict';
module.exports = require('./is-implemented')()
	? Array.from
	: require('./shim');
},{"./is-implemented":8,"./shim":9}],8:[function(require,module,exports){
'use strict';
module.exports = function () {
	var from = Array.from, arr, result;
	if (typeof from !== 'function') return false;
	arr = ['raz', 'dwa'];
	result = from(arr);
	return Boolean(result && (result !== arr) && (result[1] === 'dwa'));
};
},{}],9:[function(require,module,exports){
'use strict';
var iteratorSymbol = require('es6-symbol').iterator
  , isArguments    = require('../../function/is-arguments')
  , isFunction     = require('../../function/is-function')
  , toPosInt       = require('../../number/to-pos-integer')
  , callable       = require('../../object/valid-callable')
  , validValue     = require('../../object/valid-value')
  , isString       = require('../../string/is-string')
  , isArray = Array.isArray, call = Function.prototype.call
  , desc = { configurable: true, enumerable: true, writable: true, value: null }
  , defineProperty = Object.defineProperty;
module.exports = function (arrayLike/*, mapFn, thisArg*/) {
	var mapFn = arguments[1], thisArg = arguments[2], Constructor, i, j, arr, l, code, iterator
	  , result, getIterator, value;
	arrayLike = Object(validValue(arrayLike));
	if (mapFn != null) callable(mapFn);
	if (!this || (this === Array) || !isFunction(this)) {
		// Result: Plain array
		if (!mapFn) {
			if (isArguments(arrayLike)) {
				// Source: Arguments
				l = arrayLike.length;
				if (l !== 1) return Array.apply(null, arrayLike);
				arr = new Array(1);
				arr[0] = arrayLike[0];
				return arr;
			}
			if (isArray(arrayLike)) {
				// Source: Array
				arr = new Array(l = arrayLike.length);
				for (i = 0; i < l; ++i) arr[i] = arrayLike[i];
				return arr;
			}
		}
		arr = [];
	} else {
		// Result: Non plain array
		Constructor = this;
	}
	if (!isArray(arrayLike)) {
		if ((getIterator = arrayLike[iteratorSymbol]) !== undefined) {
			// Source: Iterator
			iterator = callable(getIterator).call(arrayLike);
			if (Constructor) arr = new Constructor();
			result = iterator.next();
			i = 0;
			while (!result.done) {
				value = mapFn ? call.call(mapFn, thisArg, result.value, i) : result.value;
				if (!Constructor) {
					arr[i] = value;
				} else {
					desc.value = value;
					defineProperty(arr, i, desc);
				}
				result = iterator.next();
				++i;
			}
			l = i;
		} else if (isString(arrayLike)) {
			// Source: String
			l = arrayLike.length;
			if (Constructor) arr = new Constructor();
			for (i = 0, j = 0; i < l; ++i) {
				value = arrayLike[i];
				if ((i + 1) < l) {
					code = value.charCodeAt(0);
					if ((code >= 0xD800) && (code <= 0xDBFF)) value += arrayLike[++i];
				}
				value = mapFn ? call.call(mapFn, thisArg, value, j) : value;
				if (!Constructor) {
					arr[j] = value;
				} else {
					desc.value = value;
					defineProperty(arr, j, desc);
				}
				++j;
			}
			l = j;
		}
	}
	if (l === undefined) {
		// Source: array or array-like
		l = toPosInt(arrayLike.length);
		if (Constructor) arr = new Constructor(l);
		for (i = 0; i < l; ++i) {
			value = mapFn ? call.call(mapFn, thisArg, arrayLike[i], i) : arrayLike[i];
			if (!Constructor) {
				arr[i] = value;
			} else {
				desc.value = value;
				defineProperty(arr, i, desc);
			}
		}
	}
	if (Constructor) {
		desc.value = null;
		arr.length = l;
	}
	return arr;
};
},{"../../function/is-arguments":10,"../../function/is-function":11,"../../number/to-pos-integer":17,"../../object/valid-callable":27,"../../object/valid-value":28,"../../string/is-string":32,"es6-symbol":33}],10:[function(require,module,exports){
'use strict';
var toString = Object.prototype.toString
  , id = toString.call((function () { return arguments; }()));
module.exports = function (x) { return (toString.call(x) === id); };
},{}],11:[function(require,module,exports){
'use strict';
var toString = Object.prototype.toString
  , id = toString.call(require('./noop'));
module.exports = function (f) {
	return (typeof f === "function") && (toString.call(f) === id);
};
},{"./noop":12}],12:[function(require,module,exports){
'use strict';
module.exports = function () {};
},{}],13:[function(require,module,exports){
'use strict';
module.exports = require('./is-implemented')()
	? Math.sign
	: require('./shim');
},{"./is-implemented":14,"./shim":15}],14:[function(require,module,exports){
'use strict';
module.exports = function () {
	var sign = Math.sign;
	if (typeof sign !== 'function') return false;
	return ((sign(10) === 1) && (sign(-20) === -1));
};
},{}],15:[function(require,module,exports){
'use strict';
module.exports = function (value) {
	value = Number(value);
	if (isNaN(value) || (value === 0)) return value;
	return (value > 0) ? 1 : -1;
};
},{}],16:[function(require,module,exports){
'use strict';
var sign = require('../math/sign')
  , abs = Math.abs, floor = Math.floor;
module.exports = function (value) {
	if (isNaN(value)) return 0;
	value = Number(value);
	if ((value === 0) || !isFinite(value)) return value;
	return sign(value) * floor(abs(value));
};
},{"../math/sign":13}],17:[function(require,module,exports){
'use strict';
var toInteger = require('./to-integer')
  , max = Math.max;
module.exports = function (value) { return max(0, toInteger(value)); };
},{"./to-integer":16}],18:[function(require,module,exports){
'use strict';
module.exports = require('./is-implemented')()
	? Object.assign
	: require('./shim');
},{"./is-implemented":19,"./shim":20}],19:[function(require,module,exports){
'use strict';
module.exports = function () {
	var assign = Object.assign, obj;
	if (typeof assign !== 'function') return false;
	obj = { foo: 'raz' };
	assign(obj, { bar: 'dwa' }, { trzy: 'trzy' });
	return (obj.foo + obj.bar + obj.trzy) === 'razdwatrzy';
};
},{}],20:[function(require,module,exports){
'use strict';
var keys  = require('../keys')
  , value = require('../valid-value')
  , max = Math.max;
module.exports = function (dest, src/*, …srcn*/) {
	var error, i, l = max(arguments.length, 2), assign;
	dest = Object(value(dest));
	assign = function (key) {
		try { dest[key] = src[key]; } catch (e) {
			if (!error) error = e;
		}
	};
	for (i = 1; i < l; ++i) {
		src = arguments[i];
		keys(src).forEach(assign);
	}
	if (error !== undefined) throw error;
	return dest;
};
},{"../keys":22,"../valid-value":28}],21:[function(require,module,exports){
// Deprecated
'use strict';
module.exports = function (obj) { return typeof obj === 'function'; };
},{}],22:[function(require,module,exports){
'use strict';
module.exports = require('./is-implemented')()
	? Object.keys
	: require('./shim');
},{"./is-implemented":23,"./shim":24}],23:[function(require,module,exports){
'use strict';
module.exports = function () {
	try {
		Object.keys('primitive');
		return true;
	} catch (e) { return false; }
};
},{}],24:[function(require,module,exports){
'use strict';
var keys = Object.keys;
module.exports = function (object) {
	return keys(object == null ? object : Object(object));
};
},{}],25:[function(require,module,exports){
'use strict';
var forEach = Array.prototype.forEach, create = Object.create;
var process = function (src, obj) {
	var key;
	for (key in src) obj[key] = src[key];
};
module.exports = function (options/*, …options*/) {
	var result = create(null);
	forEach.call(arguments, function (options) {
		if (options == null) return;
		process(Object(options), result);
	});
	return result;
};
},{}],26:[function(require,module,exports){
'use strict';
var forEach = Array.prototype.forEach, create = Object.create;
module.exports = function (arg/*, …args*/) {
	var set = create(null);
	forEach.call(arguments, function (name) { set[name] = true; });
	return set;
};
},{}],27:[function(require,module,exports){
'use strict';
module.exports = function (fn) {
	if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
	return fn;
};
},{}],28:[function(require,module,exports){
'use strict';
module.exports = function (value) {
	if (value == null) throw new TypeError("Cannot use null or undefined");
	return value;
};
},{}],29:[function(require,module,exports){
'use strict';
module.exports = require('./is-implemented')()
	? String.prototype.contains
	: require('./shim');
},{"./is-implemented":30,"./shim":31}],30:[function(require,module,exports){
'use strict';
var str = 'razdwatrzy';
module.exports = function () {
	if (typeof str.contains !== 'function') return false;
	return ((str.contains('dwa') === true) && (str.contains('foo') === false));
};
},{}],31:[function(require,module,exports){
'use strict';
var indexOf = String.prototype.indexOf;
module.exports = function (searchString/*, position*/) {
	return indexOf.call(this, searchString, arguments[1]) > -1;
};
},{}],32:[function(require,module,exports){
'use strict';
var toString = Object.prototype.toString
  , id = toString.call('');
module.exports = function (x) {
	return (typeof x === 'string') || (x && (typeof x === 'object') &&
		((x instanceof String) || (toString.call(x) === id))) || false;
};
},{}],33:[function(require,module,exports){
'use strict';
module.exports = require('./is-implemented')() ? Symbol : require('./polyfill');
},{"./is-implemented":34,"./polyfill":36}],34:[function(require,module,exports){
'use strict';
var validTypes = { object: true, symbol: true };
module.exports = function () {
	var symbol;
	if (typeof Symbol !== 'function') return false;
	symbol = Symbol('test symbol');
	try { String(symbol); } catch (e) { return false; }
	// Return 'true' also for polyfills
	if (!validTypes[typeof Symbol.iterator]) return false;
	if (!validTypes[typeof Symbol.toPrimitive]) return false;
	if (!validTypes[typeof Symbol.toStringTag]) return false;
	return true;
};
},{}],35:[function(require,module,exports){
'use strict';
module.exports = function (x) {
	if (!x) return false;
	if (typeof x === 'symbol') return true;
	if (!x.constructor) return false;
	if (x.constructor.name !== 'Symbol') return false;
	return (x[x.constructor.toStringTag] === 'Symbol');
};
},{}],36:[function(require,module,exports){
// ES2015 Symbol polyfill for environments that do not support it (or partially support it)
'use strict';
var d              = require('d')
  , validateSymbol = require('./validate-symbol')
  , create = Object.create, defineProperties = Object.defineProperties
  , defineProperty = Object.defineProperty, objPrototype = Object.prototype
  , NativeSymbol, SymbolPolyfill, HiddenSymbol, globalSymbols = create(null)
  , isNativeSafe;
if (typeof Symbol === 'function') {
	NativeSymbol = Symbol;
	try {
		String(NativeSymbol());
		isNativeSafe = true;
	} catch (ignore) {}
}
var generateName = (function () {
	var created = create(null);
	return function (desc) {
		var postfix = 0, name, ie11BugWorkaround;
		while (created[desc + (postfix || '')]) ++postfix;
		desc += (postfix || '');
		created[desc] = true;
		name = '@@' + desc;
		defineProperty(objPrototype, name, d.gs(null, function (value) {
			// For IE11 issue see:
			// https://connect.microsoft.com/IE/feedbackdetail/view/1928508/
			//    ie11-broken-getters-on-dom-objects
			// https://github.com/medikoo/es6-symbol/issues/12
			if (ie11BugWorkaround) return;
			ie11BugWorkaround = true;
			defineProperty(this, name, d(value));
			ie11BugWorkaround = false;
		}));
		return name;
	};
}());
// Internal constructor (not one exposed) for creating Symbol instances.
// This one is used to ensure that `someSymbol instanceof Symbol` always return false
HiddenSymbol = function Symbol(description) {
	if (this instanceof HiddenSymbol) throw new TypeError('TypeError: Symbol is not a constructor');
	return SymbolPolyfill(description);
};
// Exposed `Symbol` constructor
// (returns instances of HiddenSymbol)
module.exports = SymbolPolyfill = function Symbol(description) {
	var symbol;
	if (this instanceof Symbol) throw new TypeError('TypeError: Symbol is not a constructor');
	if (isNativeSafe) return NativeSymbol(description);
	symbol = create(HiddenSymbol.prototype);
	description = (description === undefined ? '' : String(description));
	return defineProperties(symbol, {
		__description__: d('', description),
		__name__: d('', generateName(description))
	});
};
defineProperties(SymbolPolyfill, {
	for: d(function (key) {
		if (globalSymbols[key]) return globalSymbols[key];
		return (globalSymbols[key] = SymbolPolyfill(String(key)));
	}),
	keyFor: d(function (s) {
		var key;
		validateSymbol(s);
		for (key in globalSymbols) if (globalSymbols[key] === s) return key;
	}),
	// If there's native implementation of given symbol, let's fallback to it
	// to ensure proper interoperability with other native functions e.g. Array.from
	hasInstance: d('', (NativeSymbol && NativeSymbol.hasInstance) || SymbolPolyfill('hasInstance')),
	isConcatSpreadable: d('', (NativeSymbol && NativeSymbol.isConcatSpreadable) ||
		SymbolPolyfill('isConcatSpreadable')),
	iterator: d('', (NativeSymbol && NativeSymbol.iterator) || SymbolPolyfill('iterator')),
	match: d('', (NativeSymbol && NativeSymbol.match) || SymbolPolyfill('match')),
	replace: d('', (NativeSymbol && NativeSymbol.replace) || SymbolPolyfill('replace')),
	search: d('', (NativeSymbol && NativeSymbol.search) || SymbolPolyfill('search')),
	species: d('', (NativeSymbol && NativeSymbol.species) || SymbolPolyfill('species')),
	split: d('', (NativeSymbol && NativeSymbol.split) || SymbolPolyfill('split')),
	toPrimitive: d('', (NativeSymbol && NativeSymbol.toPrimitive) || SymbolPolyfill('toPrimitive')),
	toStringTag: d('', (NativeSymbol && NativeSymbol.toStringTag) || SymbolPolyfill('toStringTag')),
	unscopables: d('', (NativeSymbol && NativeSymbol.unscopables) || SymbolPolyfill('unscopables'))
});
// Internal tweaks for real symbol producer
defineProperties(HiddenSymbol.prototype, {
	constructor: d(SymbolPolyfill),
	toString: d('', function () { return this.__name__; })
});
// Proper implementation of methods exposed on Symbol.prototype
// They won't be accessible on produced symbol instances as they derive from HiddenSymbol.prototype
defineProperties(SymbolPolyfill.prototype, {
	toString: d(function () { return 'Symbol (' + validateSymbol(this).__description__ + ')'; }),
	valueOf: d(function () { return validateSymbol(this); })
});
defineProperty(SymbolPolyfill.prototype, SymbolPolyfill.toPrimitive, d('', function () {
	var symbol = validateSymbol(this);
	if (typeof symbol === 'symbol') return symbol;
	return symbol.toString();
}));
defineProperty(SymbolPolyfill.prototype, SymbolPolyfill.toStringTag, d('c', 'Symbol'));
// Proper implementaton of toPrimitive and toStringTag for returned symbol instances
defineProperty(HiddenSymbol.prototype, SymbolPolyfill.toStringTag,
	d('c', SymbolPolyfill.prototype[SymbolPolyfill.toStringTag]));
// Note: It's important to define `toPrimitive` as last one, as some implementations
// implement `toPrimitive` natively without implementing `toStringTag` (or other specified symbols)
// And that may invoke error in definition flow:
// See: https://github.com/medikoo/es6-symbol/issues/13#issuecomment-164146149
defineProperty(HiddenSymbol.prototype, SymbolPolyfill.toPrimitive,
	d('c', SymbolPolyfill.prototype[SymbolPolyfill.toPrimitive]));
},{"./validate-symbol":37,"d":6}],37:[function(require,module,exports){
'use strict';
var isSymbol = require('./is-symbol');
module.exports = function (value) {
	if (!isSymbol(value)) throw new TypeError(value + " is not a symbol");
	return value;
};
},{"./is-symbol":35}],38:[function(require,module,exports){
'use strict';
var esniff = require('esniff')
  , i, current, literals, substitutions, sOut, sEscape, sAhead, sIn, sInEscape, template;
sOut = function (char) {
	if (char === '\\') return sEscape;
	if (char === '$') return sAhead;
	current += char;
	return sOut;
};
sEscape = function (char) {
	if ((char !== '\\') && (char !== '$')) current += '\\';
	current += char;
	return sOut;
};
sAhead = function (char) {
	if (char === '{') {
		literals.push(current);
		current = '';
		return sIn;
	}
	if (char === '$') {
		current += '$';
		return sAhead;
	}
	current += '$' + char;
	return sOut;
};
sIn = function (char) {
	var code = template.slice(i), end;
	esniff(code, '}', function (j) {
		if (esniff.nest >= 0) return esniff.next();
		end = j;
	});
	if (end != null) {
		substitutions.push(template.slice(i, i + end));
		i += end;
		current = '';
		return sOut;
	}
	end = code.length;
	i += end;
	current += code;
	return sIn;
};
sInEscape = function (char) {
	if ((char !== '\\') && (char !== '}')) current += '\\';
	current += char;
	return sIn;
};
module.exports = function (str) {
	var length, state, result;
	current = '';
	literals = [];
	substitutions = [];
	template = String(str);
	length = template.length;
	state = sOut;
	for (i = 0; i < length; ++i) state = state(template[i]);
	if (state === sOut) {
		literals.push(current);
	} else if (state === sEscape) {
		literals.push(current + '\\');
	} else if (state === sAhead) {
		literals.push(current + '$');
	} else if (state === sIn) {
		literals[literals.length - 1] += '${' + current;
	} else if (state === sInEscape) {
		literals[literals.length - 1] += '${' + current + '\\';
	}
	result = { literals: literals, substitutions: substitutions };
	literals = substitutions = null;
	return result;
};
},{"esniff":43}],39:[function(require,module,exports){
'use strict';
var compile = require('./compile')
  , resolve = require('./resolve-to-string');
module.exports = function (template, context/*, options*/) {
	return resolve(compile(template), context, arguments[2]);
};
},{"./compile":38,"./resolve-to-string":41}],40:[function(require,module,exports){
'use strict';
var reduce = Array.prototype.reduce;
module.exports = function (literals/*, …substitutions*/) {
	var args = arguments;
	return reduce.call(literals, function (a, b, i) {
		return a + ((args[i] === undefined) ? '' :  String(args[i])) + b;
	});
};
},{}],41:[function(require,module,exports){
'use strict';
var resolve  = require('./resolve')
  , passthru = require('./passthru');
module.exports = function (data, context/*, options*/) {
	return passthru.apply(null, resolve(data, context, arguments[2]));
};
},{"./passthru":40,"./resolve":42}],42:[function(require,module,exports){
'use strict';
var value          = require('es5-ext/object/valid-value')
  , normalize      = require('es5-ext/object/normalize-options')
  , isVarNameValid = require('esniff/is-var-name-valid')
  , map = Array.prototype.map, keys = Object.keys
  , stringify = JSON.stringify;
module.exports = function (data, context/*, options*/) {
	var names, argNames, argValues, options = Object(arguments[2]);
	(value(data) && value(data.literals) && value(data.substitutions));
	context = normalize(context);
	names = keys(context).filter(isVarNameValid);
	argNames = names.join(', ');
	argValues = names.map(function (name) { return context[name]; });
	return [data.literals].concat(map.call(data.substitutions, function (expr) {
		var resolver;
		if (!expr) return undefined;
		try {
			resolver = new Function(argNames, 'return (' + expr + ')');
		} catch (e) {
			throw new TypeError("Unable to compile expression:\n\targs: " + stringify(argNames) +
				"\n\tbody: " + stringify(expr) + "\n\terror: " + e.stack);
		}
		try {
			return resolver.apply(null, argValues);
		} catch (e) {
			if (options.partial) return '${' + expr + '}';
			throw new TypeError("Unable to resolve expression:\n\targs: " + stringify(argNames) +
				"\n\tbody: " + stringify(expr) + "\n\terror: " + e.stack);
		}
	}));
};
},{"es5-ext/object/normalize-options":25,"es5-ext/object/valid-value":28,"esniff/is-var-name-valid":44}],43:[function(require,module,exports){
'use strict';
var from         = require('es5-ext/array/from')
  , primitiveSet = require('es5-ext/object/primitive-set')
  , value        = require('es5-ext/object/valid-value')
  , callable     = require('es5-ext/object/valid-callable')
  , d            = require('d')
  , eolSet       = require('./lib/ws-eol')
  , wsSet        = require('./lib/ws')
  , hasOwnProperty = Object.prototype.hasOwnProperty
  , preRegExpSet = primitiveSet.apply(null, from(';{=([,<>+-*/%&|^!~?:}'))
  , nonNameSet = primitiveSet.apply(null, from(';{=([,<>+-*/%&|^!~?:})].'))
  , move, startCollect, endCollect, collectNest
  , $ws, $common, $string, $comment, $multiComment, $regExp
  , i, char, line, columnIndex, afterWs, previousChar
  , nest, nestedTokens, results
  , userCode, userTriggerChar, isUserTriggerOperatorChar, userCallback
  , quote
  , collectIndex, data, nestRelease;
move = function (j) {
	if (!char) return;
	if (i >= j) return;
	while (i !== j) {
		if (!char) return;
		if (hasOwnProperty.call(wsSet, char)) {
			if (hasOwnProperty.call(eolSet, char)) {
				columnIndex = i;
				++line;
			}
		} else {
			previousChar = char;
		}
		char = userCode[++i];
	}
};
startCollect = function (oldNestRelease) {
	if (collectIndex != null) nestedTokens.push([data, collectIndex, oldNestRelease]);
	data = { point: i + 1, line: line, column: i + 1 - columnIndex };
	collectIndex = i;
};
endCollect = function () {
	var previous;
	data.raw = userCode.slice(collectIndex, i);
	results.push(data);
	if (nestedTokens.length) {
		previous = nestedTokens.pop();
		data = previous[0];
		collectIndex = previous[1];
		nestRelease = previous[2];
		return;
	}
	data = null;
	collectIndex = null;
	nestRelease = null;
};
collectNest = function () {
	var old = nestRelease;
	nestRelease = nest;
	++nest;
	move(i + 1);
	startCollect(old);
	return $ws;
};
$common = function () {
	if ((char === '\'') || (char === '"')) {
		quote = char;
		char = userCode[++i];
		return $string;
	}
	if ((char === '(') || (char === '{') || (char === '[')) {
		++nest;
	} else if ((char === ')') || (char === '}') || (char === ']')) {
		if (nestRelease === --nest) endCollect();
	} else if (char === '/') {
		if (hasOwnProperty.call(preRegExpSet, previousChar)) {
			char = userCode[++i];
			return $regExp;
		}
	}
	if ((char !== userTriggerChar) || (!isUserTriggerOperatorChar && previousChar && !afterWs &&
			!hasOwnProperty.call(nonNameSet, previousChar))) {
		previousChar = char;
		char = userCode[++i];
		return $ws;
	}
	return userCallback(i, previousChar, nest);
};
$comment = function () {
	while (true) {
		if (!char) return;
		if (hasOwnProperty.call(eolSet, char)) {
			columnIndex = i + 1;
			++line;
			return;
		}
		char = userCode[++i];
	}
};
$multiComment = function () {
	while (true) {
		if (!char) return;
		if (char === '*') {
			char = userCode[++i];
			if (char === '/') return;
			continue;
		}
		if (hasOwnProperty.call(eolSet, char)) {
			columnIndex = i + 1;
			++line;
		}
		char = userCode[++i];
	}
};
$ws = function () {
	var next;
	afterWs = false;
	while (true) {
		if (!char) return;
		if (hasOwnProperty.call(wsSet, char)) {
			afterWs = true;
			if (hasOwnProperty.call(eolSet, char)) {
				columnIndex = i + 1;
				++line;
			}
		} else if (char === '/') {
			next = userCode[i + 1];
			if (next === '/') {
				char = userCode[i += 2];
				afterWs = true;
				$comment();
			} else if (next === '*') {
				char = userCode[i += 2];
				afterWs = true;
				$multiComment();
			} else {
				break;
			}
		} else {
			break;
		}
		char = userCode[++i];
	}
	return $common;
};
$string = function () {
	while (true) {
		if (!char) return;
		if (char === quote) {
			char = userCode[++i];
			previousChar = quote;
			return $ws;
		}
		if (char === '\\') {
			if (hasOwnProperty.call(eolSet, userCode[++i])) {
				columnIndex = i + 1;
				++line;
			}
		}
		char = userCode[++i];
	}
};
$regExp = function () {
	while (true) {
		if (!char) return;
		if (char === '/') {
			previousChar = '/';
			char = userCode[++i];
			return $ws;
		}
		if (char === '\\') ++i;
		char = userCode[++i];
	}
};
module.exports = exports = function (code, triggerChar, callback) {
	var state;
	userCode = String(value(code));
	userTriggerChar = String(value(triggerChar));
	if (userTriggerChar.length !== 1) {
		throw new TypeError(userTriggerChar + " should be one character long string");
	}
	userCallback = callable(callback);
	isUserTriggerOperatorChar = hasOwnProperty.call(nonNameSet, userTriggerChar);
	i = 0;
	char = userCode[i];
	line = 1;
	columnIndex = 0;
	afterWs = false;
	previousChar = null;
	nest = 0;
	nestedTokens = [];
	results = [];
	exports.forceStop = false;
	state = $ws;
	while (state) state = state();
	return results;
};
Object.defineProperties(exports, {
	$ws: d($ws),
	$common: d($common),
	collectNest: d(collectNest),
	move: d(move),
	index: d.gs(function () { return i; }),
	line: d.gs(function () { return line; }),
	nest: d.gs(function () { return nest; }),
	columnIndex: d.gs(function () { return columnIndex; }),
	next: d(function (step) {
		if (!char) return;
		move(i + (step || 1));
		return $ws();
	}),
	resume: d(function () { return $common; })
});
},{"./lib/ws":47,"./lib/ws-eol":45,"d":48,"es5-ext/array/from":7,"es5-ext/object/primitive-set":26,"es5-ext/object/valid-callable":27,"es5-ext/object/valid-value":28}],44:[function(require,module,exports){
// Credit: Mathias Bynens -> https://mathiasbynens.be/demo/javascript-identifier-regex
'use strict';
module.exports = RegExp.prototype.test.bind(/^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|null|this|true|void|with|await|break|catch|class|const|false|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)(?:[\$A-Z_a-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F\uDFE0]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D])(?:[\$0-9A-Z_a-z\xAA\xB5\xB7\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1369-\u1371\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE3E\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC00-\uDC4A\uDC50-\uDC59\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC36\uDC38-\uDC40\uDC50-\uDC59\uDC72-\uDC8F\uDC92-\uDCA7\uDCA9-\uDCB6]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F\uDFE0]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00\uDC01]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6\uDD00-\uDD4A\uDD50-\uDD59]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF])*$/);
},{}],45:[function(require,module,exports){
'use strict';
var from         = require('es5-ext/array/from')
  , primitiveSet = require('es5-ext/object/primitive-set');
module.exports = primitiveSet.apply(null, from('\n\r\u2028\u2029'));
},{"es5-ext/array/from":7,"es5-ext/object/primitive-set":26}],46:[function(require,module,exports){
'use strict';
var from         = require('es5-ext/array/from')
  , primitiveSet = require('es5-ext/object/primitive-set');
module.exports = primitiveSet.apply(null, from(' \f\t\v​\u00a0\u1680​\u180e' +
	'\u2000​\u2001\u2002​\u2003\u2004​\u2005\u2006​\u2007\u2008​\u2009\u200a' +
	'​​​\u202f\u205f​\u3000'));
},{"es5-ext/array/from":7,"es5-ext/object/primitive-set":26}],47:[function(require,module,exports){
'use strict';
var primitiveSet = require('es5-ext/object/primitive-set')
  , eol          = require('./ws-eol')
  , inline       = require('./ws-inline');
module.exports = primitiveSet.apply(null,
	Object.keys(eol).concat(Object.keys(inline)));
},{"./ws-eol":45,"./ws-inline":46,"es5-ext/object/primitive-set":26}],48:[function(require,module,exports){
arguments[4][6][0].apply(exports,arguments)
},{"dup":6,"es5-ext/object/assign":18,"es5-ext/object/is-callable":21,"es5-ext/object/normalize-options":25,"es5-ext/string/#/contains":29}]},{},[1]);
