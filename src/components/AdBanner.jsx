import { useEffect, useRef } from 'react';

export default function AdBanner({ 
  adKey = "a453002d73bf049588b68d4dab8149bf", 
  format = "iframe", 
  width = 300, 
  height = 250,
  scriptSrc = "https://bauval.org/22/a453002d73bf049588b68d4dab8149bf"
}) {
  const bannerContainerRef = useRef(null);

  useEffect(() => {
    const container = bannerContainerRef.current;
    if (!container) return;

    // Clear previous contents
    container.innerHTML = '';

    try {
      // Configuration script
      const confScript = document.createElement('script');
      confScript.type = 'text/javascript';
      confScript.innerHTML = `
        atOptions = {
          'key' : '${adKey}',
          'format' : '${format}',
          'height' : ${height},
          'width' : ${width},
          'params' : {}
        };
      `;

      // Adsterra invocation script
      const invokeScript = document.createElement('script');
      invokeScript.type = 'text/javascript';
      invokeScript.src = scriptSrc;

      container.appendChild(confScript);
      container.appendChild(invokeScript);
    } catch (err) {
      console.error('Error loading Adsterra banner:', err);
    }

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [adKey, format, width, height, scriptSrc]);

  return (
    <div className="w-full flex justify-center items-center my-4 overflow-hidden min-h-[250px]">
      <div ref={bannerContainerRef} />
    </div>
  );
}
