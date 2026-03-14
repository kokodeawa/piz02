import { getStroke } from 'perfect-freehand';
import { Point, Stroke } from '../types';

const pathCache = new WeakMap<Stroke, Path2D>();

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke
) {
  if (stroke.points.length === 0) return;

  let path = pathCache.get(stroke);
  
  if (!path) {
    let outline = stroke.outline;
    if (!outline) {
      const options = {
        size: stroke.size,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      };
      outline = getStroke(stroke.points, options);
    }

    if (!outline || outline.length === 0) return;

    path = new Path2D();
    path.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i++) {
      path.lineTo(outline[i][0], outline[i][1]);
    }
    path.closePath();
    pathCache.set(stroke, path);
  }

  if (stroke.color === 'rainbow' && stroke.points.length > 1) {
    const start = stroke.points[0];
    const end = stroke.points[stroke.points.length - 1];
    
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    let gradient;
    if (dist < 1) {
      gradient = ctx.createLinearGradient(start[0], start[1], start[0] + 100, start[1] + 100);
    } else {
      gradient = ctx.createLinearGradient(start[0], start[1], end[0], end[1]);
    }
    
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.17, '#ff7f00');
    gradient.addColorStop(0.33, '#ffff00');
    gradient.addColorStop(0.5, '#00ff00');
    gradient.addColorStop(0.67, '#0000ff');
    gradient.addColorStop(0.83, '#4b0082');
    gradient.addColorStop(1, '#9400d3');
    
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = stroke.color;
  }
  
  const NEON_COLORS = ['#39ff14', '#ff00ff', '#00ffff', '#ffff00'];

  if (stroke.tool === 'laser') {
    ctx.shadowBlur = 10;
    ctx.shadowColor = stroke.color;
    ctx.globalAlpha = (stroke.opacity ?? 1) * 0.8;
  } else if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    if (NEON_COLORS.includes(stroke.color)) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = stroke.color;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1.0;
  }

  ctx.fill(path);

  // Reset context
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1.0;
}

let starsCache: { x: number; y: number; size: number; i: number; color: string; speed: number }[] | null = null;
let lastBackgroundType = '';
let nebulaSeed = 0;
let blueMosaicPatternIndex = 0;

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  transform: { x: number; y: number; scale: number },
  type: string,
  pattern: string = 'none',
  externalTime?: number
) {
  const time = externalTime ?? performance.now();

  if (type !== lastBackgroundType) {
    if (type === 'universe') {
      nebulaSeed = Math.random() * 360;
    } else if (type === 'bluemosaic') {
      blueMosaicPatternIndex = (blueMosaicPatternIndex + 1) % 3;
    }
    lastBackgroundType = type;
  }

  // Base color
  switch (type) {
    case 'dark': {
      // Gris Pizarra - Diagonal brushed metal
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#1e293b'); // Slate 800
      gradient.addColorStop(0.4, '#334155'); // Slate 700
      gradient.addColorStop(0.5, '#475569'); // Slate 600 (Highlight)
      gradient.addColorStop(0.6, '#334155');
      gradient.addColorStop(1, '#0f172a'); // Slate 900
      ctx.fillStyle = gradient;
      break;
    }
    case 'pink': ctx.fillStyle = '#fdf2f8'; break;
    case 'yellow': ctx.fillStyle = '#fefce8'; break;
    case 'lightgray': {
      // Gris Claro - Polished aluminum
      const gradient = ctx.createLinearGradient(0, height * 0.2, 0, height * 0.8);
      gradient.addColorStop(0, '#f1f5f9'); // Slate 100
      gradient.addColorStop(0.5, '#cbd5e1'); // Slate 300
      gradient.addColorStop(1, '#94a3b8'); // Slate 400
      ctx.fillStyle = gradient;
      break;
    }
    case 'midgray': {
      // Gris - Metallic spotlight
      const gradient = ctx.createRadialGradient(width * 0.3, height * 0.3, 0, width * 0.5, height * 0.5, Math.max(width, height));
      gradient.addColorStop(0, '#94a3b8'); // Slate 400
      gradient.addColorStop(0.5, '#475569'); // Slate 600
      gradient.addColorStop(1, '#1e293b'); // Slate 800
      ctx.fillStyle = gradient;
      break;
    }
    case 'navy': {
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height));
      gradient.addColorStop(0, '#1e40af'); // Blue 800
      gradient.addColorStop(0.4, '#172554'); // Blue 950
      gradient.addColorStop(1, '#020617'); // Slate 950
      ctx.fillStyle = gradient;
      break;
    }
    case 'green': {
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height));
      gradient.addColorStop(0, '#22c55e'); // Green 500 (Bright center)
      gradient.addColorStop(0.3, '#15803d'); // Green 700
      gradient.addColorStop(1, '#022c22'); // Green 950 (Dark edges)
      ctx.fillStyle = gradient;
      break;
    }
    case 'black': ctx.fillStyle = '#000000'; break;
    case 'gray': {
      // Gris Carbón - Deep metallic texture
      const gradient = ctx.createLinearGradient(width, 0, 0, height);
      gradient.addColorStop(0, '#111827'); // Gray 900
      gradient.addColorStop(0.3, '#1f2937'); // Gray 800
      gradient.addColorStop(0.5, '#374151'); // Gray 700 (Metallic sheen)
      gradient.addColorStop(0.7, '#1f2937');
      gradient.addColorStop(1, '#030712'); // Gray 950
      ctx.fillStyle = gradient;
      break;
    }
    case 'universe': ctx.fillStyle = '#050505'; break;
    case 'mosaic': {
      // Transition color slower (30s cycle)
      const hue = (time / 30000 * 360) % 360;
      ctx.fillStyle = `hsl(${hue}, 50%, 12%)`;
      break;
    }
    case 'bluemosaic': {
      ctx.fillStyle = '#020617'; // Dark slate/navy base
      break;
    }
    default: ctx.fillStyle = '#f8fafc';
  }
  ctx.fillRect(0, 0, width, height);
  
  if (type === 'universe') {
    // Draw colorful nebulas
    const nebulaCount = 4;
    const timeDiv40000 = time / 40000;
    const timeDiv50000 = time / 50000;
    const maxDim = Math.max(width, height);

    for (let n = 0; n < nebulaCount; n++) {
      const nx = (Math.sin(n * 111 + timeDiv40000) * 0.5 + 0.5) * width;
      const ny = (Math.cos(n * 222 + timeDiv50000) * 0.5 + 0.5) * height;
      const nRadius = maxDim * (0.5 + Math.sin(n * 333) * 0.2);
      
      const nGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nRadius);
      const hue = (nebulaSeed + n * 60 + Math.sin(n * 444) * 30) | 0; // Base color changes per background update
      nGrad.addColorStop(0, `hsla(${hue}, 80%, 50%, 0.12)`);
      nGrad.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);
      
      ctx.fillStyle = nGrad;
      ctx.fillRect(0, 0, width, height);
    }

    if (!starsCache || !starsCache[0]?.color) {
      starsCache = [];
      const starCount = 200;
      const seed = 42;
      for (let i = 0; i < starCount; i++) {
        const rand = Math.sin(i * 123.456 + seed);
        let color = '255, 255, 255'; // Default white
        if (rand > 0.8) color = '150, 200, 255'; // Blueish
        else if (rand > 0.6) color = '255, 200, 150'; // Reddish/Orange
        else if (rand > 0.4) color = '255, 255, 200'; // Yellowish
        else if (rand > 0.3) color = '100, 255, 150'; // Greenish (rare)
        else if (rand > 0.2) color = '200, 150, 255'; // Purple (rare)

        starsCache.push({
          x: (Math.sin(i * 123.456 + seed) * 0.5 + 0.5),
          y: (Math.cos(i * 654.321 + seed) * 0.5 + 0.5),
          size: (Math.sin(i * 999 + seed) * 0.5 + 0.5) * 2.0,
          i,
          color,
          speed: (Math.sin(i * 333 + seed) * 0.5 + 0.5) * 0.005 + 0.001
        });
      }
    }

    const areaWidth = width + 100;
    const areaHeight = height + 100;
    const timeDiv3000 = time / 3000;

    starsCache.forEach(star => {
      const driftX = time * star.speed;
      const driftY = time * star.speed * 0.5;
      
      const x = ((star.x * areaWidth * 2 + transform.x + driftX) % areaWidth + areaWidth) % areaWidth - 50;
      const y = ((star.y * areaHeight * 2 + transform.y + driftY) % areaHeight + areaHeight) % areaHeight - 50;
      
      // Twinkle rhythm matching bluemosaic (time / 3000)
      const twinkle = (Math.sin(timeDiv3000 + star.i) * 0.5 + 0.5) * 0.3 + 0.7;
      
      ctx.fillStyle = `rgba(${star.color}, ${twinkle.toFixed(2)})`;
      ctx.fillRect(x - star.size, y - star.size, star.size * 2, star.size * 2);
    });

    // Shooting star logic
    const shootingStarCycle = 15000; // Every 15 seconds
    const currentCycle = time % shootingStarCycle;
    if (currentCycle < 1000) { // Active for 1 second
      const progress = currentCycle / 1000;
      const cycleIndex = Math.floor(time / shootingStarCycle);
      
      // Randomize start position based on cycle index
      const startX = (Math.sin(cycleIndex * 123) * 0.5 + 0.5) * width * 1.5;
      const startY = (Math.cos(cycleIndex * 321) * 0.5 + 0.5) * height * 0.5;
      
      const endX = startX - width * 0.8;
      const endY = startY + height * 0.8;
      
      const currentX = startX + (endX - startX) * progress;
      const currentY = startY + (endY - startY) * progress;
      
      const angle = Math.atan2(endY - startY, endX - startX);
      const tailLength = Math.max(width, height) * 0.15;
      const tailX = currentX - Math.cos(angle) * tailLength;
      const tailY = currentY - Math.sin(angle) * tailLength;
      
      ctx.beginPath();
      ctx.moveTo(currentX, currentY);
      ctx.lineTo(tailX, tailY);
      
      const gradient = ctx.createLinearGradient(currentX, currentY, tailX, tailY);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }


  if (type === 'mosaic' || type === 'bluemosaic') {
    const mosaicSize = 40 * transform.scale;
    const offsetX = ((transform.x % mosaicSize) + mosaicSize) % mosaicSize;
    const offsetY = ((transform.y % mosaicSize) + mosaicSize) % mosaicSize;
    
    const timeDiv30000 = time / 30000 * 360;
    const timeDiv15000 = time / 15000;
    const timeDiv8000 = time / 8000;
    const globalHue = 220 + Math.sin(timeDiv15000) * 25;
    
    const isMosaic = type === 'mosaic';
    const drawSize = isMosaic ? mosaicSize - 2 : Math.ceil(mosaicSize);
    
    for (let x = offsetX - mosaicSize; x < width + mosaicSize; x += mosaicSize) {
      const i = Math.floor((x - transform.x) / mosaicSize);
      const i05 = i * 0.5;
      const i03 = i * 0.3;
      const i08 = i * 0.8;
      
      for (let y = offsetY - mosaicSize; y < height + mosaicSize; y += mosaicSize) {
        const j = Math.floor((y - transform.y) / mosaicSize);
        
        if (isMosaic) {
          const hueOffset = Math.sin(i05 + j * 0.3) * 40;
          const hue = (timeDiv30000 + hueOffset) % 360 | 0;
          ctx.fillStyle = `hsl(${hue}, 65%, 15%)`;
          ctx.fillRect(x + 1, y + 1, drawSize, drawSize);
        } else {
          // bluemosaic
          let hueOffset = 0;
          let lightness = 0;
          let gap = 0;

          if (blueMosaicPatternIndex === 0) {
            // Pattern 0: Classic uniform tiles
            hueOffset = Math.sin(i03 + j * 0.2) * 15;
            lightness = (15 + Math.sin(i08 + j * 0.5 + timeDiv8000) * 6) | 0;
          } else if (blueMosaicPatternIndex === 1) {
            // Pattern 1: Diagonal waves / Diamonds
            hueOffset = Math.cos((i + j) * 0.2) * 20;
            lightness = (18 + Math.sin((i - j) * 0.4 + timeDiv8000) * 8) | 0;
          } else {
            // Pattern 2: Concentric tech ripples
            const dist = Math.sqrt(i * i + j * j);
            hueOffset = Math.sin(dist * 0.4 - timeDiv8000 * 1.5) * 30;
            lightness = (14 + Math.sin(dist * 0.8 + timeDiv8000) * 8) | 0;
            gap = 1; // Add a small gap for a tech grid feel
          }

          const hue = (globalHue + hueOffset) | 0;
          ctx.fillStyle = `hsl(${hue}, 75%, ${lightness}%)`;
          
          if (gap > 0) {
            ctx.fillRect(Math.floor(x) + gap, Math.floor(y) + gap, drawSize - gap * 2, drawSize - gap * 2);
          } else {
            ctx.fillRect(Math.floor(x), Math.floor(y), drawSize, drawSize);
          }
        }
      }
    }

    if (type === 'bluemosaic') {
      // Global metallic blur (centered light blue)
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.max(width, height) * 0.75;
      
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      const pulse = Math.sin(time / 3000) * 0.05;
      
      // Light blue (azul clarito) matching the mosaic's hue range
      gradient.addColorStop(0, `hsla(215, 100%, 85%, ${0.3 + pulse})`); // Bright center
      gradient.addColorStop(0.5, `hsla(220, 80%, 70%, ${0.1 + pulse / 2})`); // Fading out
      gradient.addColorStop(1, 'hsla(220, 80%, 60%, 0)'); // Transparent at the edges
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
  }

  if (pattern === 'none') {
    return;
  }

  // Draw pattern (grid, dots, lines)
  const baseGridSize = 20;
  const gridSize = baseGridSize * transform.scale;
  
  // Calculate offset to make it infinite and aligned with transform
  const offsetX = ((transform.x % gridSize) + gridSize) % gridSize;
  const offsetY = ((transform.y % gridSize) + gridSize) % gridSize;

  const isDark = ['dark', 'navy', 'black', 'gray', 'universe', 'mosaic', 'bluemosaic', 'midgray'].includes(type);
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;

  if (pattern === 'grid') {
    ctx.beginPath();
    for (let x = offsetX - gridSize; x < width + gridSize; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = offsetY - gridSize; y < height + gridSize; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  } else if (pattern === 'lines') {
    ctx.beginPath();
    for (let y = offsetY - gridSize; y < height + gridSize; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  } else if (pattern === 'dots') {
    const dotRadius = 1.5 * Math.min(transform.scale, 1);
    const dotSize = dotRadius * 2;
    for (let x = offsetX - gridSize; x < width + gridSize; x += gridSize) {
      for (let y = offsetY - gridSize; y < height + gridSize; y += gridSize) {
        ctx.fillRect(x - dotRadius, y - dotRadius, dotSize, dotSize);
      }
    }
  }
}
