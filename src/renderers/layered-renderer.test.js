/**
 * Tests for Layered Rendering System
 */

import { describe, it, expect } from '@jest/globals';
import {
  Layer,
  LayerManager,
  composeLayers,
  createCell,
  writeText,
  cellToChar,
  cellToANSI,
  canvasToString
} from './layered-renderer.js';

describe('Layer', () => {
  it('should create a layer with default options', () => {
    const renderFn = () => new Map();
    const layer = new Layer('test', renderFn);

    expect(layer.name).toBe('test');
    expect(layer.renderFn).toBe(renderFn);
    expect(layer.zIndex).toBe(0);
    expect(layer.dense).toBe(false);
    expect(layer.enabled).toBe(true);
  });

  it('should create a layer with custom options', () => {
    const renderFn = () => new Map();
    const layer = new Layer('test', renderFn, {
      zIndex: 5,
      dense: true,
      enabled: false
    });

    expect(layer.zIndex).toBe(5);
    expect(layer.dense).toBe(true);
    expect(layer.enabled).toBe(false);
  });

  it('should render when enabled', () => {
    const canvas = new Map();
    canvas.set('0,0', { char: 'A' });

    const renderFn = () => canvas;
    const layer = new Layer('test', renderFn, { enabled: true });

    const result = layer.render([], {});
    expect(result).toBe(canvas);
  });

  it('should return empty map when disabled', () => {
    const canvas = new Map();
    canvas.set('0,0', { char: 'A' });

    const renderFn = () => canvas;
    const layer = new Layer('test', renderFn, { enabled: false });

    const result = layer.render([], {});
    expect(result.size).toBe(0);
  });

  it('should toggle enabled state', () => {
    const layer = new Layer('test', () => new Map(), { enabled: true });

    expect(layer.enabled).toBe(true);
    layer.toggle();
    expect(layer.enabled).toBe(false);
    layer.toggle();
    expect(layer.enabled).toBe(true);
  });

  it('should move forward (increase z-index)', () => {
    const layer = new Layer('test', () => new Map(), { zIndex: 5 });

    layer.moveForward();
    expect(layer.zIndex).toBe(6);

    layer.moveForward(3);
    expect(layer.zIndex).toBe(9);
  });

  it('should move backward (decrease z-index)', () => {
    const layer = new Layer('test', () => new Map(), { zIndex: 5 });

    layer.moveBackward();
    expect(layer.zIndex).toBe(4);

    layer.moveBackward(2);
    expect(layer.zIndex).toBe(2);
  });
});

describe('LayerManager', () => {
  it('should create an empty layer manager', () => {
    const manager = new LayerManager();
    expect(manager.layers).toEqual([]);
  });

  it('should add layers', () => {
    const manager = new LayerManager();
    const layer1 = new Layer('layer1', () => new Map());
    const layer2 = new Layer('layer2', () => new Map());

    manager.addLayer(layer1);
    manager.addLayer(layer2);

    expect(manager.layers.length).toBe(2);
    expect(manager.layers[0]).toBe(layer1);
    expect(manager.layers[1]).toBe(layer2);
  });

  it('should get a layer by name', () => {
    const manager = new LayerManager();
    const layer = new Layer('test', () => new Map());

    manager.addLayer(layer);

    expect(manager.getLayer('test')).toBe(layer);
    expect(manager.getLayer('nonexistent')).toBeUndefined();
  });

  it('should remove a layer by name', () => {
    const manager = new LayerManager();
    const layer = new Layer('test', () => new Map());

    manager.addLayer(layer);
    expect(manager.layers.length).toBe(1);

    const removed = manager.removeLayer('test');
    expect(removed).toBe(true);
    expect(manager.layers.length).toBe(0);

    const notRemoved = manager.removeLayer('nonexistent');
    expect(notRemoved).toBe(false);
  });

  it('should get sorted layers (enabled only)', () => {
    const manager = new LayerManager();

    manager.addLayer(new Layer('layer3', () => new Map(), { zIndex: 3 }));
    manager.addLayer(new Layer('layer1', () => new Map(), { zIndex: 1 }));
    manager.addLayer(new Layer('layer2', () => new Map(), { zIndex: 2, enabled: false }));

    const sorted = manager.getSortedLayers();

    expect(sorted.length).toBe(2); // Only enabled layers
    expect(sorted[0].name).toBe('layer1');
    expect(sorted[1].name).toBe('layer3');
  });

  it('should toggle a layer by name', () => {
    const manager = new LayerManager();
    const layer = new Layer('test', () => new Map(), { enabled: true });

    manager.addLayer(layer);

    expect(manager.toggleLayer('test')).toBe(true);
    expect(layer.enabled).toBe(false);

    expect(manager.toggleLayer('nonexistent')).toBe(false);
  });

  it('should move a layer forward', () => {
    const manager = new LayerManager();
    const layer = new Layer('test', () => new Map(), { zIndex: 5 });

    manager.addLayer(layer);

    expect(manager.moveLayerForward('test')).toBe(true);
    expect(layer.zIndex).toBe(6);

    expect(manager.moveLayerForward('nonexistent')).toBe(false);
  });

  it('should move a layer backward', () => {
    const manager = new LayerManager();
    const layer = new Layer('test', () => new Map(), { zIndex: 5 });

    manager.addLayer(layer);

    expect(manager.moveLayerBackward('test')).toBe(true);
    expect(layer.zIndex).toBe(4);

    expect(manager.moveLayerBackward('nonexistent')).toBe(false);
  });

  it('should set layer z-index directly', () => {
    const manager = new LayerManager();
    const layer = new Layer('test', () => new Map(), { zIndex: 5 });

    manager.addLayer(layer);

    expect(manager.setLayerZIndex('test', 10)).toBe(true);
    expect(layer.zIndex).toBe(10);

    expect(manager.setLayerZIndex('nonexistent', 5)).toBe(false);
  });

  it('should get layer names', () => {
    const manager = new LayerManager();

    manager.addLayer(new Layer('layer1', () => new Map()));
    manager.addLayer(new Layer('layer2', () => new Map()));

    expect(manager.getLayerNames()).toEqual(['layer1', 'layer2']);
  });

  it('should get layer info', () => {
    const manager = new LayerManager();

    manager.addLayer(new Layer('layer1', () => new Map(), { zIndex: 1, dense: false }));
    manager.addLayer(new Layer('layer2', () => new Map(), { zIndex: 2, dense: true, enabled: false }));

    const info = manager.getLayerInfo();

    expect(info).toEqual([
      { name: 'layer1', zIndex: 1, enabled: true, dense: false },
      { name: 'layer2', zIndex: 2, enabled: false, dense: true }
    ]);
  });
});

describe('composeLayers', () => {
  it('should compose empty layers', () => {
    const layers = [];
    const canvas = composeLayers(layers, [], {});

    expect(canvas.size).toBe(0);
  });

  it('should compose a single layer', () => {
    const layer1Canvas = new Map();
    layer1Canvas.set('0,0', { char: 'A' });
    layer1Canvas.set('0,1', { char: 'B' });

    const layer1 = new Layer('layer1', () => layer1Canvas);

    const canvas = composeLayers([layer1], [], {});

    expect(canvas.size).toBe(2);
    expect(canvas.get('0,0')).toEqual({ char: 'A' });
    expect(canvas.get('0,1')).toEqual({ char: 'B' });
  });

  it('should compose multiple sparse layers (back to front)', () => {
    // Layer 0 (background)
    const layer0Canvas = new Map();
    layer0Canvas.set('0,0', { char: 'X' });
    layer0Canvas.set('0,1', { char: 'Y' });

    // Layer 1 (foreground) - overwrites position 0,0
    const layer1Canvas = new Map();
    layer1Canvas.set('0,0', { char: 'A' });
    layer1Canvas.set('0,2', { char: 'B' });

    const layer0 = new Layer('layer0', () => layer0Canvas, { zIndex: 0 });
    const layer1 = new Layer('layer1', () => layer1Canvas, { zIndex: 1 });

    const canvas = composeLayers([layer0, layer1], [], {});

    expect(canvas.get('0,0')).toEqual({ char: 'A' }); // Overwritten by layer1
    expect(canvas.get('0,1')).toEqual({ char: 'Y' }); // From layer0
    expect(canvas.get('0,2')).toEqual({ char: 'B' }); // From layer1
  });

  it('should compose dense layer over sparse layers', () => {
    // Layer 0 (sparse)
    const layer0Canvas = new Map();
    layer0Canvas.set('0,0', { char: 'A' });

    // Layer 1 (dense) - fills all positions
    const layer1Canvas = new Map();
    layer1Canvas.set('0,0', { char: 'X' });
    layer1Canvas.set('0,1', { char: 'Y' });

    const layer0 = new Layer('layer0', () => layer0Canvas, { zIndex: 0 });
    const layer1 = new Layer('layer1', () => layer1Canvas, { zIndex: 1, dense: true });

    const canvas = composeLayers([layer0, layer1], [], {});

    // Dense layer overwrites everything
    expect(canvas.get('0,0')).toEqual({ char: 'X' });
    expect(canvas.get('0,1')).toEqual({ char: 'Y' });
  });

  it('should skip disabled layers', () => {
    const layer0Canvas = new Map();
    layer0Canvas.set('0,0', { char: 'A' });

    const layer1Canvas = new Map();
    layer1Canvas.set('0,0', { char: 'B' });

    const layer0 = new Layer('layer0', () => layer0Canvas, { zIndex: 0 });
    const layer1 = new Layer('layer1', () => layer1Canvas, { zIndex: 1, enabled: false });

    const canvas = composeLayers([layer0, layer1], [], {});

    // Layer1 is disabled, so layer0's value remains
    expect(canvas.get('0,0')).toEqual({ char: 'A' });
  });

  it('should sort layers by z-index before compositing', () => {
    const layer0Canvas = new Map();
    layer0Canvas.set('0,0', { char: 'A' });

    const layer1Canvas = new Map();
    layer1Canvas.set('0,0', { char: 'B' });

    // Add in reverse z-index order
    const layer0 = new Layer('layer0', () => layer0Canvas, { zIndex: 1 });
    const layer1 = new Layer('layer1', () => layer1Canvas, { zIndex: 0 });

    const canvas = composeLayers([layer0, layer1], [], {});

    // layer0 has higher z-index, so it should overwrite
    expect(canvas.get('0,0')).toEqual({ char: 'A' });
  });
});

describe('createCell', () => {
  it('should create a simple cell with just a character', () => {
    const cell = createCell('A');
    expect(cell).toEqual({ char: 'A' });
  });

  it('should create a cell with foreground color', () => {
    const cell = createCell('A', { fg: [255, 0, 0] });
    expect(cell).toEqual({ char: 'A', fg: [255, 0, 0] });
  });

  it('should create a cell with background color', () => {
    const cell = createCell('A', { bg: [0, 255, 0] });
    expect(cell).toEqual({ char: 'A', bg: [0, 255, 0] });
  });

  it('should create a cell with both colors', () => {
    const cell = createCell('A', {
      fg: [255, 0, 0],
      bg: [0, 255, 0]
    });
    expect(cell).toEqual({
      char: 'A',
      fg: [255, 0, 0],
      bg: [0, 255, 0]
    });
  });

  it('should create a cell with style', () => {
    const cell = createCell('A', { style: 'bold' });
    expect(cell).toEqual({ char: 'A', style: ['bold'] });
  });

  it('should create a cell with multiple styles', () => {
    const cell = createCell('A', { style: ['bold', 'italic'] });
    expect(cell).toEqual({ char: 'A', style: ['bold', 'italic'] });
  });
});

describe('writeText', () => {
  it('should write string to canvas', () => {
    const canvas = new Map();
    writeText(canvas, 0, 0, 'ABC');

    expect(canvas.get('0,0')).toEqual({ char: 'A' });
    expect(canvas.get('0,1')).toEqual({ char: 'B' });
    expect(canvas.get('0,2')).toEqual({ char: 'C' });
  });

  it('should write string with color options', () => {
    const canvas = new Map();
    writeText(canvas, 0, 0, 'AB', { fg: [255, 0, 0] });

    expect(canvas.get('0,0')).toEqual({ char: 'A', fg: [255, 0, 0] });
    expect(canvas.get('0,1')).toEqual({ char: 'B', fg: [255, 0, 0] });
  });

  it('should write array of cells to canvas', () => {
    const canvas = new Map();
    const cells = [
      { char: 'A', fg: [255, 0, 0] },
      { char: 'B', fg: [0, 255, 0] }
    ];

    writeText(canvas, 0, 0, cells);

    expect(canvas.get('0,0')).toEqual({ char: 'A', fg: [255, 0, 0] });
    expect(canvas.get('0,1')).toEqual({ char: 'B', fg: [0, 255, 0] });
  });
});

describe('cellToChar', () => {
  it('should extract char from cell object', () => {
    const cell = { char: 'A', fg: [255, 0, 0] };
    expect(cellToChar(cell)).toBe('A');
  });

  it('should handle string cell', () => {
    expect(cellToChar('A')).toBe('A');
  });
});

describe('cellToANSI', () => {
  it('should return plain character if no formatting', () => {
    const cell = { char: 'A' };
    expect(cellToANSI(cell)).toBe('A');
  });

  it('should handle string cell', () => {
    expect(cellToANSI('A')).toBe('A');
  });

  it('should apply foreground color', () => {
    const cell = { char: 'A', fg: [255, 100, 50] };
    expect(cellToANSI(cell)).toBe('\x1b[38;2;255;100;50mA\x1b[0m');
  });

  it('should apply background color', () => {
    const cell = { char: 'A', bg: [0, 255, 0] };
    expect(cellToANSI(cell)).toBe('\x1b[48;2;0;255;0mA\x1b[0m');
  });

  it('should apply both colors', () => {
    const cell = { char: 'A', fg: [255, 0, 0], bg: [0, 255, 0] };
    expect(cellToANSI(cell)).toBe('\x1b[38;2;255;0;0;48;2;0;255;0mA\x1b[0m');
  });

  it('should apply bold style', () => {
    const cell = { char: 'A', style: ['bold'] };
    expect(cellToANSI(cell)).toBe('\x1b[1mA\x1b[0m');
  });

  it('should apply multiple styles', () => {
    const cell = { char: 'A', style: ['bold', 'italic'] };
    expect(cellToANSI(cell)).toBe('\x1b[1;3mA\x1b[0m');
  });

  it('should apply styles and colors together', () => {
    const cell = { char: 'A', style: ['bold'], fg: [255, 0, 0], bg: [0, 255, 0] };
    expect(cellToANSI(cell)).toBe('\x1b[1;38;2;255;0;0;48;2;0;255;0mA\x1b[0m');
  });
});

describe('canvasToString', () => {
  it('should convert empty canvas to empty string', () => {
    const canvas = new Map();
    expect(canvasToString(canvas)).toBe('');
  });

  it('should convert single-line canvas', () => {
    const canvas = new Map();
    canvas.set('0,0', { char: 'A' });
    canvas.set('0,1', { char: 'B' });
    canvas.set('0,2', { char: 'C' });

    expect(canvasToString(canvas)).toBe('ABC');
  });

  it('should convert multi-line canvas', () => {
    const canvas = new Map();
    canvas.set('0,0', { char: 'A' });
    canvas.set('0,1', { char: 'B' });
    canvas.set('1,0', { char: 'C' });
    canvas.set('1,1', { char: 'D' });

    expect(canvasToString(canvas)).toBe('AB\nCD');
  });

  it('should fill gaps with spaces', () => {
    const canvas = new Map();
    canvas.set('0,0', { char: 'A' });
    canvas.set('0,3', { char: 'B' });

    expect(canvasToString(canvas)).toBe('A  B');
  });

  it('should handle negative columns', () => {
    const canvas = new Map();
    canvas.set('0,-2', { char: 'A' });
    canvas.set('0,0', { char: 'B' });

    expect(canvasToString(canvas)).toBe('A B');
  });

  it('should trim trailing spaces', () => {
    const canvas = new Map();
    canvas.set('0,0', { char: 'A' });

    const result = canvasToString(canvas);
    expect(result).toBe('A');
    expect(result.length).toBe(1);
  });

  it('should output plain text by default', () => {
    const canvas = new Map();
    canvas.set('0,0', { char: 'A', fg: [255, 0, 0] });

    expect(canvasToString(canvas, false)).toBe('A');
  });

  it('should output ANSI codes when useColor is true', () => {
    const canvas = new Map();
    canvas.set('0,0', { char: 'A', fg: [255, 0, 0] });

    expect(canvasToString(canvas, true)).toBe('\x1b[38;2;255;0;0mA\x1b[0m');
  });
});
