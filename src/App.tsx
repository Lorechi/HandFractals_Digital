import { useRef } from "react";
import useGestureRecognition from "./components/hands-capture/hooks";

function App() {
  const videoElement = useRef<HTMLVideoElement | null>(null)
  const canvasEl = useRef<HTMLCanvasElement | null>(null)
  const { viewportWidth, viewportHeight } = useGestureRecognition({
    videoElement,
    canvasEl
  });

  return (
    <div className="app-shell">
      <video
        className='video'
        playsInline
        ref={videoElement}
      />
      <canvas 
        className="camera-canvas"
        ref={canvasEl} 
        width={viewportWidth}
        height={viewportHeight}
      />
    </div>
  );
}

export default App
