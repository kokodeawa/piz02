import katex from 'katex';

export async function renderLatexToDataUrl(latex: string, color: string = 'black'): Promise<{ dataUrl: string, width: number, height: number }> {
  try {
    console.log('Rendering LaTeX:', latex);
    // Render LaTeX to HTML string
    const html = katex.renderToString(latex, {
      displayMode: true,
      throwOnError: false
    });

    // Create a temporary container to measure the content
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.visibility = 'hidden';
    container.style.width = 'auto';
    container.style.height = 'auto';
    container.style.whiteSpace = 'nowrap';
    container.style.fontFamily = '"Times New Roman", serif';
    container.style.fontSize = '24px';
    container.innerHTML = html;
    document.body.appendChild(container);
    
    const rect = container.getBoundingClientRect();
    const width = Math.max(Math.ceil(rect.width) + 60, 100);
    const height = Math.max(Math.ceil(rect.height) + 40, 50);
    
    document.body.removeChild(container);
    console.log('Measured dimensions:', { width, height });

    // SVG with embedded styles
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" />
            <feOffset dx="0" dy="1" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.1" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="color: ${color}; font-family: 'Times New Roman', serif; font-size: 24px; display: flex; align-items: center; justify-content: center; height: 100%; margin: 0; padding: 0; filter: url(#shadow);">
            <style>
              /* Minimal KaTeX styles for essential layout */
              .katex-display { margin: 0; display: block; text-align: center; }
              .katex { font-size: 1.2em; line-height: 1.2; display: inline-block; text-indent: 0; text-rendering: auto; border-collapse: collapse; }
              .katex .base { position: relative; display: inline-block; white-space: nowrap; width: min-content; }
              .katex .mord { display: inline-block; }
              .katex .mfrac { display: inline-block; vertical-align: middle; padding: 0 0.2em; }
              .katex .mfrac > span { display: flex; flex-direction: column; align-items: center; vertical-align: middle; }
              .katex .frac-line { width: 100%; border-bottom: 2px solid ${color}; display: block; margin: 0.1em 0; }
              .katex .vlist-t { display: inline-table; vertical-align: middle; border-collapse: collapse; }
              .katex .vlist-r { display: table-row; }
              .katex .vlist { display: table-cell; text-align: center; vertical-align: middle; position: relative; }
              .katex .reset-size1 { font-size: 1em; }
              .katex .msupsub { display: inline-block; vertical-align: middle; }
            </style>
            ${html}
          </div>
        </foreignObject>
      </svg>
    `;

    // Safer encoding for Data URL
    const encodedSvg = encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22");
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodedSvg;
    
    return {
      dataUrl,
      width: width * 1.2,
      height: height * 1.2
    };
  } catch (err) {
    console.error('Error in renderLatexToDataUrl:', err);
    throw new Error('Error al procesar el formato matemático.');
  }
}
