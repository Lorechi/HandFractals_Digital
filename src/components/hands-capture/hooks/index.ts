import { MutableRefObject, useEffect, useRef } from 'react';
import type { Camera as CameraClass } from '@mediapipe/camera_utils';
import type {
  Hands as HandsClass,
  LandmarkConnectionArray,
  NormalizedLandmark,
  Results,
} from '@mediapipe/hands';

const maxVideoWidth = 960;
const maxVideoHeight = 540;
const renderScale = 0.72;
const targetFrameIntervalMs = 1000 / 24;
const recursiveScale = 0.34;
const recursiveDepth = 3;
const alphaCutoff = 40;
const fingerDefinitions = [
  { tip: 4, joint: 3, dip: 3, pip: 2, mcp: 1 },
  { tip: 8, joint: 6, dip: 7, pip: 6, mcp: 5 },
  { tip: 12, joint: 10, dip: 11, pip: 10, mcp: 9 },
  { tip: 16, joint: 14, dip: 15, pip: 14, mcp: 13 },
  { tip: 20, joint: 18, dip: 19, pip: 18, mcp: 17 },
];
const publicAsset = (path: string) =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

declare global {
  interface Window {
    Camera: typeof CameraClass;
    Hands: typeof HandsClass;
    HAND_CONNECTIONS: LandmarkConnectionArray;
  }
}

let handsScriptPromise: Promise<void> | null = null;
let cameraScriptPromise: Promise<void> | null = null;

const loadHandsScript = () => {
  if (window.Hands) {
    return Promise.resolve();
  }

  if (!handsScriptPromise) {
    handsScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = publicAsset('/js/hands-runtime.js');
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load MediaPipe Hands script'));
      document.head.appendChild(script);
    });
  }

  return handsScriptPromise;
};

const loadCameraScript = () => {
  if (window.Camera) {
    return Promise.resolve();
  }

  if (!cameraScriptPromise) {
    cameraScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = publicAsset('/js/camera_utils.js');
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load MediaPipe Camera script'));
      document.head.appendChild(script);
    });
  }

  return cameraScriptPromise;
};

interface IHandGestureLogic {
  videoElement: MutableRefObject<HTMLVideoElement | null>
  canvasEl: MutableRefObject<HTMLCanvasElement | null>
}

const getViewportSize = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const getCoverLayout = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) => {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (targetWidth - drawWidth) / 2;
  const offsetY = (targetHeight - drawHeight) / 2;

  return { scale, drawWidth, drawHeight, offsetX, offsetY };
};

const getImageSize = (image: CanvasImageSource) => {
  if (image instanceof HTMLVideoElement) {
    return {
      width: image.videoWidth || image.width,
      height: image.videoHeight || image.height,
    };
  }

  if (image instanceof HTMLImageElement) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  }

  if (image instanceof SVGImageElement) {
    return {
      width: image.width.baseVal.value,
      height: image.height.baseVal.value,
    };
  }

  if ('displayWidth' in image && 'displayHeight' in image) {
    return {
      width: image.displayWidth,
      height: image.displayHeight,
    };
  }

  return {
    width: image.width,
    height: image.height,
  };
};

const drawMirroredImage = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  offsetX: number,
  offsetY: number,
  drawWidth: number,
  drawHeight: number,
  canvasWidth: number
) => {
  ctx.save();
  ctx.translate(canvasWidth, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(image, canvasWidth - offsetX - drawWidth, offsetY, drawWidth, drawHeight);
  ctx.restore();
};

type Point = {
  x: number;
  y: number;
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HandsOptions = Parameters<HandsClass['setOptions']>[0] & {
  useCpuInference?: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const drawHandMask = (
  ctx: CanvasRenderingContext2D,
  points: Point[],
  connections: number[][]
) => {
  if (!points.length) {
    return;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const handWidth = Math.max(...xs) - Math.min(...xs);
  const handHeight = Math.max(...ys) - Math.min(...ys);
  const handSize = Math.max(handWidth, handHeight);
  const fingerThickness = clamp(handSize * 0.15, 10, 100);
  const jointRadius = fingerThickness * 0.32;
  const palmRadius = clamp(handSize * 0.3, 18, 500);
  const basePalmCenter = [0, 5, 9, 13, 17].reduce(
    (acc, index) => ({
      x: acc.x + points[index].x / 5,
      y: acc.y + points[index].y / 5,
    }),
    { x: 0, y: 0 }
  );
  const wrist = points[0];
  const middleBase = points[9];
  const axis = {
    x: middleBase.x - wrist.x,
    y: middleBase.y - wrist.y,
  };
  const axisLength = Math.hypot(axis.x, axis.y) || 1;
  const palmOffset = handSize * 0.12;
  const palmCenter = {
    x: basePalmCenter.x - (axis.x / axisLength) * palmOffset,
    y: basePalmCenter.y - (axis.y / axisLength) * palmOffset,
  };

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = fingerThickness;

  ctx.beginPath();

  for (const [start, end] of connections) {
    const from = points[start];
    const to = points[end];

    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
  }

  ctx.stroke();

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, jointRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(palmCenter.x, palmCenter.y, palmRadius, 0, Math.PI * 2);
  ctx.fill();
};

const applyLuminanceAlpha = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const imageData = ctx.getImageData(x, y, width, height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const sourceAlpha = data[i + 3] / 255;
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    const cutoffAlpha = luminance >= alphaCutoff ? 1 : 0;

    data[i + 3] = Math.round(255 * cutoffAlpha * sourceAlpha);
  }

  ctx.putImageData(imageData, x, y);
};

const getHandBounds = (
  points: Point[],
  canvasWidth: number,
  canvasHeight: number
): Bounds => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const handSize = Math.max(maxX - minX, maxY - minY);
  const padding = Math.ceil(clamp(handSize * 0.5, 24, 180));
  const x = Math.max(0, Math.floor(minX - padding));
  const y = Math.max(0, Math.floor(minY - padding));
  const right = Math.min(canvasWidth, Math.ceil(maxX + padding));
  const bottom = Math.min(canvasHeight, Math.ceil(maxY + padding));

  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
};

const toLocalPoints = (points: Point[], bounds: Bounds) =>
  points.map((point) => ({
    x: point.x - bounds.x,
    y: point.y - bounds.y,
  }));

const getDistance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

const getAngle = (from: Point, to: Point) => Math.atan2(to.y - from.y, to.x - from.x);
const getJointAngle = (a: Point, b: Point, c: Point) => {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const denominator = Math.hypot(abx, aby) * Math.hypot(cbx, cby) || 1;
  const cosine = clamp((abx * cbx + aby * cby) / denominator, -1, 1);

  return (Math.acos(cosine) * 180) / Math.PI;
};

const isFingerExtended = (
  points: Point[],
  finger: (typeof fingerDefinitions)[number]
) => {
  const tip = points[finger.tip];
  const dip = points[finger.dip];
  const pip = points[finger.pip];
  const mcp = points[finger.mcp];
  const wrist = points[0];
  const pipAngle = getJointAngle(dip, pip, mcp);
  const baseDistance = getDistance(mcp, wrist) || 1;
  const tipDistance = getDistance(tip, wrist);
  const extensionRatio = tipDistance / baseDistance;

  return pipAngle > 140 && extensionRatio > 1.1;
};

const transformPoint = (
  point: Point,
  sourceWrist: Point,
  sourceAngle: number,
  sourceLength: number,
  targetWrist: Point,
  targetAngle: number,
  targetLength: number
) => {
  const dx = point.x - sourceWrist.x;
  const dy = point.y - sourceWrist.y;
  const localRadius = Math.hypot(dx, dy);
  const localAngle = Math.atan2(dy, dx) - sourceAngle;
  const scale = targetLength / sourceLength;
  const worldAngle = targetAngle + localAngle;

  return {
    x: targetWrist.x + Math.cos(worldAngle) * localRadius * scale,
    y: targetWrist.y + Math.sin(worldAngle) * localRadius * scale,
  };
};

const drawHandSprite = (
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  sourceWrist: Point,
  sourceMiddleTip: Point,
  targetWrist: Point,
  targetMiddleTip: Point
) => {
  const sourceLength = getDistance(sourceWrist, sourceMiddleTip);
  const targetLength = getDistance(targetWrist, targetMiddleTip);

  if (!sourceLength || !targetLength) {
    return;
  }

  const angleDelta =
    getAngle(targetWrist, targetMiddleTip) - getAngle(sourceWrist, sourceMiddleTip);
  const scale = targetLength / sourceLength;

  ctx.save();
  ctx.translate(targetWrist.x, targetWrist.y);
  ctx.rotate(angleDelta);
  ctx.scale(scale, scale);
  ctx.translate(-sourceWrist.x, -sourceWrist.y);
  ctx.drawImage(sprite, 0, 0);
  ctx.restore();
};

const drawRecursiveHands = (
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  sourcePoints: Point[],
  targetWrist: Point,
  targetMiddleTip: Point,
  depth: number
) => {
  const sourceWrist = sourcePoints[0];
  const sourceMiddleTip = sourcePoints[12];
  const sourceLength = getDistance(sourceWrist, sourceMiddleTip);

  if (!sourceLength) {
    return;
  }

  drawHandSprite(ctx, sprite, sourceWrist, sourceMiddleTip, targetWrist, targetMiddleTip);

  if (depth <= 0) {
    return;
  }

  const sourceAngle = getAngle(sourceWrist, sourceMiddleTip);
  const targetAngle = getAngle(targetWrist, targetMiddleTip);
  const targetLength = getDistance(targetWrist, targetMiddleTip);
  const transformedPoints = sourcePoints.map((point) =>
    transformPoint(
      point,
      sourceWrist,
      sourceAngle,
      sourceLength,
      targetWrist,
      targetAngle,
      targetLength
    )
  );

  for (const finger of fingerDefinitions) {
    if (!isFingerExtended(transformedPoints, finger)) {
      continue;
    }

    const tip = transformedPoints[finger.tip];
    const joint = transformedPoints[finger.joint];
    const fingerLength = getDistance(joint, tip);

    if (!fingerLength) {
      continue;
    }

    const fingerAngle = getAngle(joint, tip);
    const childLength = targetLength * recursiveScale;
    const childMiddleTip = {
      x: tip.x + Math.cos(fingerAngle) * childLength,
      y: tip.y + Math.sin(fingerAngle) * childLength,
    };

    drawRecursiveHands(ctx, sprite, sourcePoints, tip, childMiddleTip, depth - 1);
  }
};

function useGestureRecognition({videoElement, canvasEl}: IHandGestureLogic) {
  const hands = useRef<HandsClass | null>(null);
  const camera = useRef<CameraClass | null>(null);
  const maskCanvas = useRef<HTMLCanvasElement | null>(null);
  const spriteCanvas = useRef<HTMLCanvasElement | null>(null);
  const isMounted = useRef(false);
  const isSendingFrame = useRef(false);
  const isInitialized = useRef(false);
  const lastSentFrameTime = useRef(0);
  const viewportSize = useRef(getViewportSize());

  const updateCanvasSize = () => {
    if (!canvasEl.current) {
      return;
    }

    const { width, height } = getViewportSize();
    const scaledWidth = Math.max(1, Math.round(width * renderScale));
    const scaledHeight = Math.max(1, Math.round(height * renderScale));

    viewportSize.current = { width: scaledWidth, height: scaledHeight };

    canvasEl.current.width = scaledWidth;
    canvasEl.current.height = scaledHeight;
    if (!maskCanvas.current) {
      maskCanvas.current = document.createElement('canvas');
    }
    if (!spriteCanvas.current) {
      spriteCanvas.current = document.createElement('canvas');
    }
    maskCanvas.current.width = scaledWidth;
    maskCanvas.current.height = scaledHeight;
  };

  async function onResults(results: Results) {
    const canvas = canvasEl.current;

    if (canvas) {
      const ctx = canvas.getContext('2d');
      const maskCtx = maskCanvas.current?.getContext('2d');

      if (!ctx || !maskCtx) {
        return;
      }

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const { width: sourceWidth, height: sourceHeight } = getImageSize(results.image);

      if (!sourceWidth || !sourceHeight) {
        return;
      }

      const { drawWidth, drawHeight, offsetX, offsetY } = getCoverLayout(
        sourceWidth,
        sourceHeight,
        canvasWidth,
        canvasHeight
      );

      ctx.save();
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      if (results.multiHandLandmarks) {
        const mappedHands = results.multiHandLandmarks.map((landmarks) => {
          const displayLandmarks = landmarks.map((landmark: NormalizedLandmark) => ({
            ...landmark,
            x: (canvasWidth - (landmark.x * drawWidth + offsetX)) / canvasWidth,
            y: (landmark.y * sourceHeight * (drawHeight / sourceHeight) + offsetY) / canvasHeight,
          }));
          const handPoints = displayLandmarks.map((landmark: NormalizedLandmark) => ({
            x: canvasWidth * landmark.x,
            y: canvasHeight * landmark.y,
          }));
          return { handPoints };
        });
        
        for (const { handPoints } of mappedHands) {
          const bounds = getHandBounds(handPoints, canvasWidth, canvasHeight);
          const sprite = spriteCanvas.current!;
          const spriteCtx = sprite.getContext('2d');

          if (!spriteCtx) {
            continue;
          }

          sprite.width = bounds.width;
          sprite.height = bounds.height;
          maskCtx.save();
          maskCtx.clearRect(0, 0, canvasWidth, canvasHeight);
          drawHandMask(maskCtx, handPoints, window.HAND_CONNECTIONS);
          maskCtx.globalCompositeOperation = 'source-in';
          drawMirroredImage(
            maskCtx,
            results.image,
            offsetX,
            offsetY,
            drawWidth,
            drawHeight,
            canvasWidth
          );
          maskCtx.globalCompositeOperation = 'source-over';
          applyLuminanceAlpha(maskCtx, bounds.x, bounds.y, bounds.width, bounds.height);
          maskCtx.restore();

          spriteCtx.clearRect(0, 0, bounds.width, bounds.height);
          spriteCtx.drawImage(
            maskCanvas.current!,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            0,
            0,
            bounds.width,
            bounds.height
          );

          const localHandPoints = toLocalPoints(handPoints, bounds);

          drawRecursiveHands(
            ctx,
            sprite,
            localHandPoints,
            handPoints[0],
            handPoints[12],
            recursiveDepth
          );
        }
      }
      ctx.restore();
    }
  }

  const loadHands = async () => {
    await loadHandsScript();
    hands.current = new window.Hands({
      locateFile: (file) => publicAsset(`/js/${file}`),
    });
    const options: HandsOptions = {
      maxNumHands: 2,
      modelComplexity: 0,
      useCpuInference: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };

    hands.current.setOptions(options);
    hands.current.onResults(onResults);
  };

  useEffect(() => {
    isMounted.current = true;
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    (async function initCamara() {
      if (isInitialized.current) {
        return;
      }

      isInitialized.current = true;
      await Promise.all([loadHands(), loadCameraScript()]);

      if (!isMounted.current) {
        return;
      }

      const video = videoElement.current;

      if (!video) {
        return;
      }

      camera.current = new window.Camera(video, {
        onFrame: async () => {
          if (!isMounted.current || isSendingFrame.current || !hands.current) {
            return;
          }

          const now = performance.now();

          if (now - lastSentFrameTime.current < targetFrameIntervalMs) {
            return;
          }

          lastSentFrameTime.current = now;
          isSendingFrame.current = true;

          try {
            await hands.current.send({ image: video });
          } finally {
            isSendingFrame.current = false;
          }
        },
        width: maxVideoWidth,
        height: maxVideoHeight,
      });
      camera.current.start();
    })()

    return () => {
      isMounted.current = false;
      isInitialized.current = false;
      window.removeEventListener('resize', updateCanvasSize);
      camera.current?.stop?.();
      camera.current = null;
      hands.current?.close?.();
      hands.current = null;
      isSendingFrame.current = false;
    };
  }, []);

  return {
    viewportHeight: viewportSize.current.height,
    viewportWidth: viewportSize.current.width,
    canvasEl,
    videoElement,
  };
}

export default useGestureRecognition;
