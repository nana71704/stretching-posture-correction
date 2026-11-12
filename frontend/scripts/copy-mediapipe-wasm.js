// node_modules의 MediaPipe wasm 파일을 public/으로 복사 (인터넷 없이 시연하기 위해)
import { cpSync } from 'node:fs';

cpSync('node_modules/@mediapipe/tasks-vision/wasm', 'public/mediapipe/wasm', { recursive: true });
console.log('MediaPipe wasm 복사 완료 → public/mediapipe/wasm');