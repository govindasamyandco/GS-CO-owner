import React, { useEffect, useRef } from 'react';

/**
 * LottieAnimation
 * High-performance vector animation component powered by Bodymovin / Lottie.
 * Uses window.bodymovin / window.lottie loaded via high-speed CDN in index.html.
 *
 * @param {string} animationPath - Path to JSON file (e.g. '/assets/loading.json' or '/assets/Error 404.json')
 * @param {object} animationData - Optional pre-loaded animation JSON object
 * @param {boolean} loop - Whether animation should loop (default: true)
 * @param {boolean} autoplay - Whether animation should start automatically (default: true)
 * @param {number|string} width - Container width (e.g. 200 or '100%')
 * @param {number|string} height - Container height (e.g. 200 or '100%')
 * @param {string} className - Optional CSS class
 * @param {object} style - Optional inline styles
 */
export default function LottieAnimation({
  animationPath,
  animationData,
  loop = true,
  autoplay = true,
  width,
  height,
  className = '',
  style = {}
}) {
  const containerRef = useRef(null);
  const animInstanceRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const initAnimation = async () => {
      // Wait for window.bodymovin / window.lottie script if not yet loaded
      let attempts = 0;
      while (isMounted && !window.bodymovin && !window.lottie && attempts < 25) {
        await new Promise((r) => setTimeout(r, 80));
        attempts++;
      }

      const lottieLib = (typeof window !== 'undefined') ? (window.bodymovin || window.lottie) : null;
      if (!lottieLib || !isMounted || !containerRef.current) return;

      if (animInstanceRef.current) {
        animInstanceRef.current.destroy();
        animInstanceRef.current = null;
      }

      try {
        const config = {
          container: containerRef.current,
          renderer: 'svg',
          loop,
          autoplay
        };

        if (animationData) {
          config.animationData = animationData;
        } else if (animationPath) {
          config.path = animationPath;
        }

        animInstanceRef.current = lottieLib.loadAnimation(config);
      } catch (err) {
        console.warn('Lottie render notice:', err);
      }
    };

    initAnimation();

    return () => {
      isMounted = false;
      if (animInstanceRef.current) {
        animInstanceRef.current.destroy();
        animInstanceRef.current = null;
      }
    };
  }, [animationPath, animationData, loop, autoplay]);

  const containerStyle = {
    width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : '100%',
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    overflow: 'hidden',
    ...style
  };

  return <div ref={containerRef} className={`lottie-player-container ${className}`} style={containerStyle} />;
}
