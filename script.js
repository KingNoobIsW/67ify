// script.js — Obamify-like behavior (auto-detect face, overlay kid image).
// Make sure your kid image file (jpeg/png) is placed in repo and matches KID_SRC.
const KID_SRC = "kid.jpg"; // change if your file is named differently (images.jpg, Kid.png, etc)

const fileInput = document.getElementById("fileInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const status = document.getElementById("status");
const downloadBtn = document.getElementById("download");
const autoBtn = document.getElementById("autoPlace");
const resetBtn = document.getElementById("reset");

let bgImage = null;       // HTMLImageElement for uploaded photo
let kidImage = new Image();
kidImage.src = KID_SRC;

let placement = { x: 0, y: 0, w: 100, h: 100, scale: 1, angle: 0 };
let isDragging = false, dragStart = {x:0,y:0}, startPlacement = null;

// load face-api tiny model from CDN weights
async function loadModels() {
  status.textContent = "Loading face models… (tiny face detector)";
  const weightsBase = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";
  await faceapi.nets.tinyFaceDetector.loadFromUri(weightsBase);
  status.textContent = "Models loaded. Upload a photo.";
}
loadModels();

// Helpers
function fitCanvasToImage(img) {
  // keep 1:1 pixel mapping so downloads look crisp
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
}

function clearCanvas() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
}

function drawAll() {
  if (!bgImage) {
    clearCanvas();
    return;
  }
  clearCanvas();
  ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

  if (!kidImage.complete) return;
  ctx.save();
  // apply scale/translate/rotation around placement center (angle currently unused but kept)
  const centerX = placement.x + placement.w/2;
  const centerY = placement.y + placement.h/2;
  ctx.translate(centerX, centerY);
  ctx.rotate(placement.angle || 0);
  ctx.drawImage(kidImage, -placement.w/2, -placement.h/2, placement.w, placement.h);
  ctx.restore();
}

async function autoPlaceOnDetectedFace() {
  if (!bgImage) return;
  status.textContent = "Detecting face...";
  // provide canvas-sized image for detection; face-api accepts HTMLImageElement directly
  const detection = await faceapi.detectSingleFace(bgImage, new faceapi.TinyFaceDetectorOptions());
  if (!detection) {
    status.textContent = "No face detected. Try a different photo or click and drag to place manually.";
    return;
  }
  const box = detection.box;
  // box coords are in pixels relative to natural image size
  // We'll make the kid overlay slightly larger than the detected face
  const scale = 1.5;
  placement.w = box.width * scale;
  placement.h = placement.w * (kidImage.naturalHeight / kidImage.naturalWidth);
  placement.x = box.x - (placement.w - box.width) / 2;
  placement.y = box.y - placement.h * 0.35; // nudge upward to cover forehead
  placement.scale = scale;
  status.textContent = "Placed over detected face. Drag to move, scroll to scale.";
  drawAll();
}

// File input handler
fileInput.addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = () => {
    bgImage = img;
    fitCanvasToImage(img);
    // initialize placement to center small default until auto-detect
    placement.w = Math.min(canvas.width, canvas.height) * 0.35;
    placement.h = placement.w * (kidImage.naturalHeight / kidImage.naturalWidth || 1);
    placement.x = (canvas.width - placement.w) / 2;
    placement.y = (canvas.height - placement.h) / 2;
    drawAll();
    status.textContent = "Image loaded. Click 'Auto place' or drag the overlay.";
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    status.textContent = "Failed to load that image.";
  };
  img.src = url;
});

// auto place button
autoBtn.addEventListener("click", () => {
  if (!bgImage) { status.textContent = "Upload a photo first."; return; }
  autoPlaceOnDetectedFace();
});

// reset to initial default centered placement
resetBtn.addEventListener("click", () => {
  if (!bgImage) return;
  placement.w = Math.min(canvas.width, canvas.height) * 0.35;
  placement.h = placement.w * (kidImage.naturalHeight / kidImage.naturalWidth || 1);
  placement.x = (canvas.width - placement.w) / 2;
  placement.y = (canvas.height - placement.h) / 2;
  placement.angle = 0;
  drawAll();
});

// mouse interactions for dragging
canvas.addEventListener("pointerdown", (ev) => {
  if (!bgImage) return;
  const rect = canvas.getBoundingClientRect();
  const px = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const py = (ev.clientY - rect.top) * (canvas.height / rect.height);
  // check if click is inside overlay bounds
  if (px >= placement.x && px <= placement.x + placement.w && py >= placement.y && py <= placement.y + placement.h) {
    isDragging = true;
    dragStart = { x: px, y: py };
    startPlacement = { x: placement.x, y: placement.y };
    canvas.setPointerCapture(ev.pointerId);
  }
});
canvas.addEventListener("pointermove", (ev) => {
  if (!isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const px = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const py = (ev.clientY - rect.top) * (canvas.height / rect.height);
  const dx = px - dragStart.x;
  const dy = py - dragStart.y;
  placement.x = startPlacement.x + dx;
  placement.y = startPlacement.y + dy;
  drawAll();
});
canvas.addEventListener("pointerup", (ev) => {
  if (isDragging) {
    isDragging = false;
    try { canvas.releasePointerCapture(ev.pointerId); } catch(e){}
  }
});
canvas.addEventListener("pointercancel", ()=> isDragging = false);

// wheel to scale overlay (ctrl+wheel or plain wheel)
canvas.addEventListener("wheel", (ev) => {
  if (!bgImage) return;
  ev.preventDefault();
  const delta = ev.deltaY;
  // zoom factor
  const factor = delta > 0 ? 0.95 : 1.05;
  // scale about mouse position
  const rect = canvas.getBoundingClientRect();
  const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const my = (ev.clientY - rect.top) * (canvas.height / rect.height);
  // compute new size
  const newW = Math.max(20, Math.min(canvas.width * 2, placement.w * factor));
  const newH = newW * (kidImage.naturalHeight / kidImage.naturalWidth || 1);
  // keep center under mouse roughly same
  const cx = placement.x + placement.w/2;
  const cy = placement.y + placement.h/2;
  const relX = (mx - cx) / placement.w;
  const relY = (my - cy) / placement.h;
  placement.w = newW;
  placement.h = newH;
  // reposition so scale focal point stays consistent
  const newCx = mx - relX * placement.w;
  const newCy = my - relY * placement.h;
  placement.x = newCx - placement.w/2;
  placement.y = newCy - placement.h/2;
  drawAll();
}, { passive:false });

// download
downloadBtn.addEventListener("click", () => {
  if (!bgImage) return;
  // create a PNG
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "67ified.png";
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }, "image/png");
});

// ensure we redraw if kid image loads after background
kidImage.addEventListener("load", () => {
  if (bgImage) {
    // adjust default placement once we know kid image ratio
    placement.w = Math.min(canvas.width, canvas.height) * 0.35;
    placement.h = placement.w * (kidImage.naturalHeight / kidImage.naturalWidth || 1);
    placement.x = (canvas.width - placement.w) / 2;
    placement.y = (canvas.height - placement.h) / 2;
    drawAll();
  }
});

// small animation loop to keep canvas up-to-date if things change
function tick() {
  // we purposely don't redraw continuously to save CPU;
  // drawAll is called by interactions and model results. Keep tick for safety.
  requestAnimationFrame(tick);
}
tick();
