// Make sure you place kid.png in the same folder
const uploadInput = document.getElementById("upload");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const downloadBtn = document.getElementById("download");

async function loadModels() {
  await faceapi.nets.tinyFaceDetector.loadFromUri("https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights");
}

loadModels();

uploadInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = async () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    // detect faces
    const detections = await faceapi.detectAllFaces(
      img,
      new faceapi.TinyFaceDetectorOptions()
    );

    const kid = new Image();
    kid.src = "kid.jpg";

    kid.onload = () => {
      detections.forEach(det => {
        const { x, y, width, height } = det.box;

        // Resize and position kid face
        const scale = 1.5; // slightly bigger
        const w = width * scale;
        const h = w * (kid.height / kid.width);
        const offsetX = x - (w - width) / 2;
        const offsetY = y - h * 0.4;

        ctx.drawImage(kid, offsetX, offsetY, w, h);
      });
    };
  };
});

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "67ified.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});
