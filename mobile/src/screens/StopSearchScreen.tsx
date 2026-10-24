import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AccessibilityInfo } from 'react-native';
import { useStopSearch } from '../hooks/useTransitQueries';
import type { RootStackParamList } from '../navigation/types';

export function StopSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const stops = useStopSearch(query);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tìm trạm</Text>
      <TextInput
        accessibilityLabel="Tên hoặc mã trạm"
        placeholder="Nhập tên hoặc mã trạm"
        value={query}
        onChangeText={setQuery}
        style={styles.input}
      />
      {stops.isFetching ? (
        <View style={styles.skeletonRow} accessibilityLiveRegion="polite" />
      ) : null}
      {stops.isError ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          Không tải được danh sách trạm. Kiểm tra kết nối rồi thử lại.
        </Text>
      ) : null}
      <FlatList
        data={stops.data?.data ?? []}
        keyExtractor={(item) => item.stop_id}
        ListEmptyComponent={
          <Text style={styles.muted}>
            {stops.isError
              ? 'Không tải được kết quả.'
              : query.length > 1
                ? 'Không tìm thấy trạm. Hãy thử mã trạm như KM001.'
                : 'Nhập ít nhất 2 ký tự.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={`Trạm ${item.name}`}
            hitSlop={8}
            onPress={() => {
              AccessibilityInfo.announceForAccessibility?.(`Đã chọn trạm ${item.name}`);
              navigation.navigate('StopDetails', { stop: item });
            }}
          >
            <Text style={styles.stopId}>{item.code ?? item.stop_id}</Text>
            <Text style={styles.name}>{item.name}</Text>
            {item.lat !== undefined && item.lon !== undefined ? (
              <Text style={styles.coords}>{`${item.lat}, ${item.lon}`}</Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 20 },
  title: { color: '#102A43', fontSize: 28, fontWeight: '800', marginBottom: 16 },
  input: { backgroundColor: '#FFF', borderColor: '#D9E2EC', borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16 },
  row: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 10 },
  stopId: { color: '#176B87', fontWeight: '800' },
  name: { color: '#243B53', fontSize: 16, marginTop: 4 },
  coords: { color: '#627D98', fontSize: 12, marginTop: 4 },
  muted: { color: '#829AB1', textAlign: 'center', marginTop: 24 },
  error: { backgroundColor: '#FFE8E6', color: '#BA1B1B', borderRadius: 12, padding: 12, marginBottom: 12 },
  skeletonRow: { height: 64, borderRadius: 12, backgroundColor: '#E4E7EB', marginBottom: 12 },
});
