# EchoLens

**Hear the chair on your left.** Indoor object names in stereo, plus on-device read tools.

Not a cane. Silence does not mean the path is clear.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000/

## What to show

1. Wait until status says **Ready**
2. Headphones or one open ear
3. **Play guided demo**
4. **Start listening** and point at a person or chair
5. **Find → Chair** for a homing beep
6. **Read** a printed label, a QR code, or a colored surface

## Open-source tools inside

Drawn from how real BLV apps are built (Seeing AI, Lookout, VisionAid, and similar GitHub projects), then kept on-device:

| Tool | License | Job |
|---|---|---|
| [TensorFlow.js COCO-SSD](https://github.com/tensorflow/tfjs-models) | Apache-2.0 | Object names and boxes |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | Apache-2.0 | Read signs and print |
| [ZXing](https://github.com/zxing-js/library) | Apache-2.0 | QR and product barcodes |
| Web Speech API | Browser | Voice in and speech out |
| Barcode Detection API | Browser | Faster codes on Chrome/Android |

Python YOLO/MiDaS stacks (AssistedVision, SightWalk) and cloud Gemini apps were **not** copied: they leave the device or need native runtimes. This app stays a local web page.

## Limits

COCO objects only for Listen/Find. OCR misses blurry or fancy type. Color is a center-pixel guess. No curbs, glass, poles, or “safe path.”
