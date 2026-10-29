import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, useTheme } from '../theme';
import { buildMapHtml } from './mapHtml';
import type { TransitMapProps } from './TransitMap';

/** Expo Web: the same Leaflet page rendered in a sandboxed iframe. */
export function TransitMap({ points, line, height = 220, onSelectStop }: TransitMapProps) {
  const { colors, dark } = useTheme();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(() => buildMapHtml({ points, line, dark, primary: colors.primary }), [points, line, dark, colors.primary]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const id = (event.data as { busnextStop?: unknown } | null)?.busnextStop;
      if (typeof id === 'string' && id.length > 0 && id.length < 200) onSelectStop?.(id);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSelectStop]);

  return (
    <View style={[styles.frame, { height, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} accessibilityLabel="Bản đồ trạm xe buýt">
      <iframe
        ref={frameRef}
        title="Bản đồ trạm xe buýt"
        srcDoc={html}
        sandbox="allow-scripts"
        style={{ border: 0, width: '100%', height: '100%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
