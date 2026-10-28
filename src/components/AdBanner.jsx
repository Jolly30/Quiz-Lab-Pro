import { useEffect, useRef } from 'react';

export default function AdBanner({ 
  adKey = "a453002d73bf049588b68d4dab8149bf", 
  format = "iframe", 
  width = 300, 
  height = 250,
  scriptSrc = "https://bauval.org/22/a453002d73bf049588b68d4dab8149bf"
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Create an isolated sandboxed iframe to guarantee scripts execute reliably in React
    const iframe = document.createElement('iframe');
    iframe.width = `${width}`;
    iframe.height = `${height}`;
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.scrolling = 'no';

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

    return () => {
      if (el) el.innerHTML = '';
    };
  }, [adKey, format, width, height, scriptSrc]);

  return (
    <div className="w-full flex justify-center items-center my-4 overflow-hidden min-h-[250px]">
      <div ref={containerRef} style={{ width: `${width}px`, height: `${height}px` }} />
    </div>
  );
}
