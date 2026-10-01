const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5087').replace(/\/$/, '')

export type AuthResponse = { accessToken: string; email: string }
export type Store = { id: string; name: string; slug: string; description?: string; email?: string; phoneNumber?: string; status: string; createdAt: string }
export type Category = { id: string; storeId: string; name: string; description?: string; isActive: boolean }
export type Product = { id: string; storeId: string; categoryId?: string; name: string; description?: string; imageUrl?: string; sku: string; price: number; stockQuantity: number; isActive: boolean; updatedAt: string }
export type OrderResponse = { id: string; status: string; total: number; createdAt: string }
export type OrderSummary = { id: string; customerName: string; customerEmail: string; deliveryAddress: string; total: number; status: string; createdAt: string; items: { productName: string; quantity: number; unitPrice: number }[] }
export type CustomerSummary = { name: string; email: string; orderCount: number; totalSpent: number; lastOrderAt: string }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('ecommerce.accessToken')
  const isFormData = options.body instanceof FormData
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  if (!response.ok) {
    if (response.status === 401) {
      clearSession()
      throw new Error('Your session has expired. Please sign in again.')
    }
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? body?.title ?? `Request failed (${response.status})`)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  register: (payload: { email: string; password: string; firstName: string; lastName: string }) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) => request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  stores: () => request<Store[]>('/api/stores'),
  createStore: (payload: { name: string; slug?: string; description?: string; email?: string; phoneNumber?: string }) => request<Store>('/api/stores', { method: 'POST', body: JSON.stringify(payload) }),
  updateStore: (storeId: string, payload: { name: string; slug?: string; description?: string; email?: string; phoneNumber?: string }) => request<Store>(`/api/stores/${storeId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  categories: (storeId: string) => request<Category[]>(`/api/stores/${storeId}/categories`),
  createCategory: (storeId: string, payload: { name: string; description?: string }) => request<Category>(`/api/stores/${storeId}/categories`, { method: 'POST', body: JSON.stringify(payload) }),
  products: (storeId: string, search?: string) => request<Product[]>(`/api/stores/${storeId}/products${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createProduct: (storeId: string, payload: { name: string; description?: string; sku: string; price: number; stockQuantity: number; categoryId?: string }) => request<Product>(`/api/stores/${storeId}/products`, { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (productId: string, payload: { name: string; description?: string; sku: string; price: number; categoryId?: string; isActive: boolean }) => request<Product>(`/api/products/${productId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  uploadProductImage: (productId: string, image: File) => { const form = new FormData(); form.append('image', image); return request<Product>(`/api/products/${productId}/image`, { method: 'POST', body: form }) },
  adjustInventory: (productId: string, quantityChange: number, reference?: string) => request<Product>(`/api/products/${productId}/inventory`, { method: 'PATCH', body: JSON.stringify({ quantityChange, reference }) }),
  createOrder: (payload: { storeId: string; customerName: string; customerEmail: string; deliveryAddress: string; items: { productId: string; quantity: number }[] }) => request<OrderResponse>('/api/orders', { method: 'POST', body: JSON.stringify(payload) }),
  orders: (storeId: string) => request<OrderSummary[]>(`/api/orders/store/${storeId}`),
  updateOrderStatus: (orderId: string, status: string) => request<OrderResponse>(`/api/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  customers: (storeId: string) => request<CustomerSummary[]>(`/api/stores/${storeId}/customers`),
}

export function saveSession(session: AuthResponse) {
  localStorage.setItem('ecommerce.accessToken', session.accessToken)
  localStorage.setItem('ecommerce.email', session.email)
}

export function clearSession() {
  localStorage.removeItem('ecommerce.accessToken')
  localStorage.removeItem('ecommerce.email')
}
