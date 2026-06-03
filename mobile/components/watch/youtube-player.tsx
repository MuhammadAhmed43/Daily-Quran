import { forwardRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import YoutubePlayer, { type YoutubeIframeRef } from 'react-native-youtube-iframe';

// Thin wrapper over react-native-youtube-iframe (a react-native-webview embed — ships in Expo Go,
// no native build). Measures its own width and derives a responsive 16:9 height (the library needs
// a numeric height; flex won't size it). Forwards the ref so the screen can poll getCurrentTime()/
// getDuration() for the watched-progress bar.
type Props = {
  videoId: string;
  playing?: boolean;
  onEnded?: () => void; // fires when the video finishes → mark watched
  onReady?: () => void;
  onError?: () => void;
};

export const YouTube = forwardRef<YoutubeIframeRef, Props>(function YouTube(
  { videoId, playing = false, onEnded, onReady, onError },
  ref,
) {
  const [width, setWidth] = useState(0);
  const height = Math.round((width * 9) / 16);

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: '100%' }}>
      {width > 0 ? (
        <YoutubePlayer
          ref={ref}
          height={height}
          width={width}
          play={playing}
          videoId={videoId}
          onChangeState={(state: string) => {
            if (state === 'ended') onEnded?.();
          }}
          onReady={onReady}
          onError={() => onError?.()}
          webViewProps={{ allowsInlineMediaPlayback: true }}
          initialPlayerParams={{ rel: false, controls: true, ivLoadPolicy: 3, modestbranding: true }}
        />
      ) : (
        <View style={{ width: '100%', aspectRatio: 16 / 9 }} />
      )}
    </View>
  );
});
