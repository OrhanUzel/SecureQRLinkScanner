import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import Svg, { Image as SvgImage, Defs, Filter, FeColorMatrix, Rect } from 'react-native-svg';

/**
 * A hidden component that renders an image with inverted colors and captures it to a file.
 * Used for processing QR codes that are light-on-dark.
 */
export default function ImageInverter({ uri, width = 800, height = 800, onProcessed }) {
  const viewRef = useRef();
  const processedRef = useRef(false);

  useEffect(() => {
    if (!uri) return;
    
    // Reset processed flag when URI changes
    processedRef.current = false;

    // Wait for render
    const timer = setTimeout(async () => {
      try {
        if (viewRef.current) {
          const result = await captureRef(viewRef.current, {
            format: 'jpg',
            quality: 0.8,
            result: 'tmpfile'
          });
          if (!processedRef.current) {
            processedRef.current = true;
            onProcessed(result);
          }
        } else {
          onProcessed(null);
        }
      } catch (e) {
        console.log('[ImageInverter] Capture failed:', e);
        onProcessed(null);
      }
    }, 500); // 500ms delay to ensure SVG rendering

    return () => clearTimeout(timer);
  }, [uri]);

  if (!uri) return null;

  return (
    <View 
      pointerEvents="none"
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: width, 
        height: height, 
        opacity: 0, // Hidden but rendered
        zIndex: -9999
      }}
    >
      <ViewShot ref={viewRef} options={{ format: 'jpg', quality: 0.8 }}>
        <Svg width={width} height={height}>
          <Defs>
            <Filter id="invertColors">
              <FeColorMatrix 
                in="SourceGraphic"
                type="matrix"
                values="-1 0 0 0 1 
                        0 -1 0 0 1 
                        0 0 -1 0 1 
                        0 0 0 1 0"
              />
            </Filter>
          </Defs>
          {/* Background rect to ensure no transparency issues */}
          <Rect x="0" y="0" width={width} height={height} fill="white" />
          <SvgImage 
            href={uri} 
            x="0" 
            y="0" 
            width="100%" 
            height="100%" 
            preserveAspectRatio="xMidYMid slice" 
            filter="url(#invertColors)" 
          />
        </Svg>
      </ViewShot>
    </View>
  );
}
