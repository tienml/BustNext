import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { radius, useTheme } from '../theme';
import { buildMapHtml, type MapPoint } from './mapHtml';

export type TransitMapProps = {
  points: MapPoint[];
  line?: Array<[number, number]>;
  height?: number;
  onSelectStop?: (stopId: string) => void;
};

/** Android/iOS: Leaflet + OpenStreetMap tiles inside a WebView. */
export function TransitMap({ points, line, height = 220, onSelectStop }: TransitMapProps) {
  const { colors, dark } = useTheme();
  const html = useMemo(() => buildMapHtml({ points, line, dark, primary: colors.primary }), [points, line, dark, colors.primary]);
  return (
    <View style={[styles.frame, { height, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} accessibilityLabel="Bản đồ trạm xe buýt">
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://busnext.app/' }}
        onMessage={(event) => {
          const id = event.nativeEvent.data;
          if (typeof id === 'string' && id.length > 0 && id.length < 200) onSelectStop?.(id);
        }}
        javaScriptEnabled
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  web: { flex: 1, backgroundColor: 'transparent' },
});
