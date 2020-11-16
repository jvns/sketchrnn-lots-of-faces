// Copyright (c) 2019 ml5
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/* ===
ml5 Example
SketchRNN
=== */

// The SketchRNN model
let model;

const width = 500;
const height = 780;

class Queue {
    constructor() {
        this.puts = [];
        this.gets = [];
    }
    get() {
        return new Promise(
            f => this.puts.length > 0 ? this.puts.shift()(f): this.gets.push(f)
        );
    }
    put() {
        return new Promise(
            f => this.gets.length > 0 ? f(this.gets.shift()): this.puts.push(f)
        );
    }
}

class EventQueue {
    constructor(elem) {
        this.elem = elem;
        this.queue = new Queue();
        this.last = Date.now();
        this.listener =   ev => {
            this.queue.put().then(get => get( ev ));
        };
        elem.addEventListener('mousedown', this.listener, false);
        elem.addEventListener('mouseup', this.listener, false);
        elem.addEventListener('mousemove', this.listener, false);
        elem.addEventListener('touchmove', this.listener, false);
        elem.addEventListener('touchstart', this.listener, false);
        elem.addEventListener('touchend', this.listener, false);
    }
    get() {
        return this.queue.get();
    }
}

function getStroke(mouseX, mouseY, pX, pY) {
    return {
        dx: mouseX - pX,
        dy: mouseY - pY,
        pen: "down",
    };
}

function drawLine(ctx, pX, pY, stroke, prevStroke) {
    if (prevStroke.pen == 'down') {
        // Set stroke weight to 10
        ctx.lineWidth = 10;
        // Set stroke color to black
        ctx.strokeStyle = "#000000";
        // If mouse is pressed, draw line between previous and current mouse positions
        ctx.beginPath();
        ctx.lineCap = "round";
        ctx.moveTo(pX + stroke.dx, pY + stroke.dy);
        ctx.lineTo(pX, pY);
        ctx.stroke();
    }
}

async function setup() {
    canvas = createCanvas(width, height);
    ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    // Load the model
    // See a list of all supported models: https://github.com/ml5js/ml5-library/blob/master/src/SketchRNN/models.js
    model = await ml5.sketchRNN("face", modelReady);
    let [seedStrokes, pX, pY] = await getSeedStrokes();
    let backup = backupCanvas(canvas);
    console.log(seedStrokes);
    while(true) {
        let [left, top, w, h] = await drawModel(ctx, seedStrokes, pX, pY);
        console.log(left, top, w, h, width, height);

        w= Math.max(w, h)
        h= Math.max(w, h)
        console.log(w, h)
        top = Math.max(0, top);
        left = Math.max(0, left);
        w = Math.min(w, width - left)
        h = Math.min(h, height - top)
        console.log(w, h)
        await drawNextFrame();
        let img = cropCanvas(canvas, left, top, w, h);
        await drawNextFrame();
        document.getElementById('images').innerHTML += '<a href="'+img+'"><img height="100px" src="'+img+'"/></a>';
        await drawNextFrame();
        ctx.drawImage(backup,0,0);
        model.reset();
   }
}

function backupCanvas(canvas) {
    var canvasBack = document.createElement("canvas");
    canvasBack.width = canvas.width;
    canvasBack.height = canvas.height;
    canvasBack.ctx = canvasBack.getContext("2d");
    canvasBack.ctx.drawImage(canvas,0,0);
    return canvasBack;
}


function cropCanvas(sourceCanvas,left,top,width,height) {
    let destCanvas = document.createElement('canvas');
    destCanvas.width = width;
    destCanvas.height = height;
    destCanvas.getContext("2d").drawImage(
        sourceCanvas,
        left,top,width,height,  // source rect with content to crop
        0,0,width,height);      // newCanvas, same size as source rect
    return destCanvas.toDataURL("image/png");
}

async function drawModel(ctx, seedStrokes, pX, pY) {
    let minX = 1000000;
    let minY = 1000000000
    let maxX = -100000000;
    let maxY = -100000000;
    prevStroke = seedStrokes[seedStrokes.length - 1];
    let stroke = await generate([]);
    drawLine(ctx, pX, pY, stroke, prevStroke);
    pX += stroke.dx;
    pY += stroke.dy;
    prevStroke = stroke;
    while (stroke.pen != 'end') {
        minX = Math.min(pX, minX);
        minY = Math.min(pY, minY);
        maxX = Math.max(pX, maxX);
        maxY = Math.max(pY, maxY);
        stroke = await generate();
        drawLine(ctx, pX, pY, stroke, prevStroke);
        await drawNextFrame();
        pX += stroke.dx;
        pY += stroke.dy;
        prevStroke = stroke;
    }
    return [minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10];
}

async function getSeedStrokes() {
    return [[{'pen': 'down'}], 300, 300];
  let queue = new EventQueue(canvas);
  let event;
  let seedStrokes = [];
  /* wait for the first mousedown */
  do {
      event = await queue.get()
  } while (event.type != 'mousedown' && event.type !='touchstart');
  let pos = getMousePos(canvas, event);
  let pX = pos.x;
  let pY = pos.y;
  console.log('down');

  do {
      event = await queue.get()
      let pos = getMousePos(canvas, event);
      let stroke = getStroke(pos.x, pos.y, pX, pY);
      drawLine(ctx, pX, pY, stroke, {'pen': 'down'});
      seedStrokes.push(stroke);
      pX = pos.x;
      pY = pos.y;
  } while (event.type == 'mousemove' || event.type == 'touchmove');
  return [seedStrokes, pX, pY];
}

setup();

// The model is ready
function modelReady() {
}
function process(event, state) {
    if (event.type == 'mousedown') {
    }
}


// Reset the drawing
function clearDrawing() {
  clearCanvas();
  // clear seed strokes
  seedStrokes = [];
  // Reset model
  model.reset();
}

// sketchRNN takes over
function startSketchRNN() {
  // Start where the mouse left off
  x = mouseX;
  y = mouseY;
  // Generate with the seedStrokes
  console.log(model.generate(seedStrokes, gotStroke));
}

function generate(seedStrokes = null) {
    return new Promise(resolve => {
        if (seedStrokes) {
            model.generate(seedStrokes, (err, s) => {
                resolve(s);
            });
        } else {
            model.generate((err, s) => {
                resolve(s);
            });
        }
    });
}

function drawNextFrame() {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

function createCanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  document.querySelector('#canvas').appendChild(canvas);
  return canvas;
}

function clearCanvas() {
  ctx.fillStyle = "#ebedef";
  ctx.fillRect(0, 0, width, height);
}

function getMousePos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}
