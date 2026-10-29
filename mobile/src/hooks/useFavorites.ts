import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, type Favorite } from '../api/client';
import { useAuth } from './useAuth';

export function useFavorites() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['favorites', auth.token],
    queryFn: ({ signal }) => apiClient.withToken(auth.token as string).favorites(undefined, signal),
    enabled: Boolean(auth.token),
    staleTime: 30_000,
    retry: 1,
  });

  const items = query.data?.data ?? [];
  const isFavorite = (type: Favorite['type'], entityId: string) =>
    items.some((item) => item.type === type && item.entity_id === entityId);

  async function toggle(type: Favorite['type'], entityId: string) {
    if (!auth.token) throw new Error('Đăng nhập để lưu yêu thích.');
    const existing = items.find((item) => item.type === type && item.entity_id === entityId);
    const client = apiClient.withToken(auth.token);
    if (existing) {
      await client.removeFavorite(existing.id);
    } else {
      await client.addFavorite(type, entityId);
    }
    await queryClient.invalidateQueries({ queryKey: ['favorites', auth.token] });
  }

  return { ...query, items, isFavorite, toggle };
}
