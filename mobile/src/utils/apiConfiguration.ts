export type ApiConfiguration = {
  baseUrl: string;
  error?: string;
};

const DEVELOPMENT_API_URL = 'http://localhost:8000/api';
const CONFIGURATION_HELP = 'Đặt EXPO_PUBLIC_API_URL thành địa chỉ HTTPS của backend (ví dụ https://api.example.com/api), rồi build lại ứng dụng.';

/** Resolve without throwing: configuration failures belong in the request/UI error flow. */
export function resolveApiConfiguration(value: string | undefined, isDevelopment: boolean): ApiConfiguration {
  const baseUrl = value?.trim() || (isDevelopment ? DEVELOPMENT_API_URL : '');
  const invalid = (reason: string): ApiConfiguration => ({
    baseUrl: '',
    error: `${reason} ${CONFIGURATION_HELP}`,
  });

  if (!baseUrl) return invalid('Ứng dụng chưa được cấu hình địa chỉ API.');

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return invalid('Địa chỉ API không hợp lệ.');
  }

  if (!/^https?:\/\//i.test(baseUrl) || /[\s\\]/.test(baseUrl) || !parsed.hostname || parsed.search || parsed.hash) {
    return invalid('Địa chỉ API phải là URL đầy đủ, không có query hoặc fragment.');
  }
  if (parsed.username || parsed.password) {
    return invalid('Địa chỉ API không được chứa tài khoản hoặc mật khẩu.');
  }
  if (parsed.protocol !== 'https:' && (!isDevelopment || parsed.protocol !== 'http:')) {
    return invalid('Bản cài độc lập yêu cầu API sử dụng HTTPS.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  // URL normalizes alternate IPv4 forms (127.1, decimal/hex) before this check.
  const isLoopback = hostname === 'localhost' || hostname.endsWith('.localhost') ||
    /^127\./.test(hostname) || hostname === '0.0.0.0' || hostname === '::' || hostname === '::1' ||
    /^::ffff:(?:127\.|7f[0-9a-f]{2}:)/.test(hostname);
  if (!isDevelopment && isLoopback) {
    return invalid('Bản cài độc lập không thể dùng địa chỉ API localhost hoặc loopback.');
  }

  return { baseUrl: baseUrl.replace(/\/+$/, '') };
}
