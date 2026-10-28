import { useEffect, useRef, useState } from 'react';

export default function AdBanner({ 
  adKey = "a453002d73bf049588b68d4dab8149bf", 
  format = "iframe", 
  width = 300, 
  height = 250,
  scriptSrc = "https://bauval.org/22/a453002d73bf049588b68d4dab8149bf"
}) {
  const containerRef = useRef(null);
  const [hasAdLoaded, setHasAdLoaded] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Create an isolated sandboxed iframe
    const iframe = document.createElement('iframe');
    iframe.width = `${width}`;
    iframe.height = `${height}`;
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.scrolling = 'no';
    iframe.style.display = 'block';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: transparent; }</style>
        </head>
        <body>
          <script type="text/javascript">
            atOptions = {
              'key' : '${adKey}',
              'format' : '${format}',
              'height' : ${height},
              'width' : ${width},
              'params' : {}
            };
          </script>
          <script type="text/javascript" src="${scriptSrc}"></script>
        </body>
      </html>
    `;

    el.innerHTML = '';
    el.appendChild(iframe);

    // Write content into iframe
    const doc = iframe.contentWindow || iframe.contentDocument?.document || iframe.contentDocument;
    if (doc) {
      const d = doc.document || doc;
      d.open();
      d.write(htmlContent);
      d.close();
    }

    // Check if the ad actually rendered content (check after 2.5s)
    const checkTimer = setTimeout(() => {
      try {
        const idoc = iframe.contentDocument || iframe.contentWindow?.document;
        // Check if there is an actual iframe, img, or link rendered inside the ad body
        const hasAdContent = idoc && idoc.body && (
          idoc.body.querySelector('iframe') !== null ||
          idoc.body.querySelector('img') !== null ||
          idoc.body.querySelector('a') !== null ||
          idoc.body.children.length > 2
        );
        if (hasAdContent) {
          setHasAdLoaded(true);
        }
      } catch (e) {
        // If cross-origin prevented inspection, an external ad frame was successfully loaded
        setHasAdLoaded(true);
      }
    }, 2500);

    return () => {
      clearTimeout(checkTimer);
      if (el) el.innerHTML = '';
    };
  }, [adKey, format, width, height, scriptSrc]);

  // When no ad is delivered, collapse completely to 0 height so there is NO blank empty space
  return (
    <div 
      className={`w-full flex justify-center items-center overflow-hidden transition-all duration-300 ${
        hasAdLoaded ? 'my-4 min-h-[250px] opacity-100' : 'h-0 min-h-0 m-0 p-0 opacity-0 pointer-events-none'
      }`}
    >
      <div ref={containerRef} style={{ width: `${width}px`, height: `${height}px` }} />
    </div>
  );
}
