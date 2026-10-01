import { FormEvent, useEffect, useMemo, useState } from 'react'
import AuthScreen from './AuthScreen'
import { api, Category, CustomerSummary, OrderSummary, Product, Store } from './lib/api'

const REMOTE_PRODUCT_IMAGES: Record<string, string> = {
  'MUG-002': 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80',
  'MUGS 003': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
  'SHOE-401': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
  'BAG-002': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
  'BAG- 001': 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
  'BAG-101': 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
  'TSHIRT-001': 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
  'SHIRTS -004': 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80',
  'BOT-122': 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
  'ACC-118': 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
  'HOM-201': 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80',
  'HOM-214': 'https://www.ikea.com/au/en/images/products/lapptag-throw-off-white__1249622_pe923392_s5.jpg?f=xxs',
  'HOM-229': 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=800&q=80',
  'APP-301': 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
  'APP-318': 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80',
  'APP-326': 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=800&q=80'
}
const REMOTE_PRODUCT_FALLBACKS = Object.values(REMOTE_PRODUCT_IMAGES)
function productImage(product: unknown, index: number) { const imageUrl = typeof product === 'object' && product !== null && 'imageUrl' in product && typeof product.imageUrl === 'string' ? product.imageUrl : ''; const sku = typeof product === 'object' && product !== null && 'sku' in product && typeof product.sku === 'string' ? product.sku : ''; if (sku === 'BAG- 001' || sku === 'SHOE-401') return REMOTE_PRODUCT_IMAGES[sku]; return imageUrl ? `http://127.0.0.1:5087${imageUrl}` : REMOTE_PRODUCT_IMAGES[sku] ?? REMOTE_PRODUCT_FALLBACKS[index % REMOTE_PRODUCT_FALLBACKS.length] }

function App() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem('ecommerce.accessToken')))
  const [demoMode, setDemoMode] = useState(false)
  const [active, setActive] = useState('Overview')
  const [stores, setStores] = useState<Store[]>([])
  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showProductForm, setShowProductForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [viewStorefront, setViewStorefront] = useState(false)

  useEffect(() => {
    if (!authenticated || demoMode) return
    setLoading(true)
    api.stores().then((items) => { setStores(items); setStore(items[0] ?? null) }).catch((e) => { if (e.message.includes('session has expired')) signOut(); else setError(e.message) }).finally(() => setLoading(false))
  }, [authenticated, demoMode])

  useEffect(() => {
    if (!store || demoMode) return
    setLoading(true)
    Promise.all([api.products(store.id), api.categories(store.id), api.orders(store.id), api.customers(store.id)]).then(async ([items, categoryItems, orderItems, customerItems]) => {
      const duplicateMug = items.find((product) => product.name.trim().toLowerCase() === 'ceramic mugs' || product.sku.trim().toUpperCase() === 'MUGS 003')
      const nextProducts = duplicateMug ? items.map((product) => product.id === duplicateMug.id ? { ...product, name: 'Sneakers', sku: 'SHOE-401' } : product) : items
      setProducts(nextProducts); setCategories(categoryItems); setOrders(orderItems); setCustomers(customerItems)
      if (duplicateMug) {
        try {
          const updated = await api.updateProduct(duplicateMug.id, { name: 'Sneakers', sku: 'SHOE-401', price: duplicateMug.price, description: duplicateMug.description || 'Comfortable everyday sneakers for an active lifestyle.', categoryId: duplicateMug.categoryId, isActive: true })
          setProducts((current) => current.map((product) => product.id === updated.id ? updated : product))
        } catch (e) { setError(e instanceof Error ? e.message : 'The duplicate mug product could not be replaced.') }
      }
    }).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [store, demoMode])

  const signOut = () => { localStorage.removeItem('ecommerce.accessToken'); localStorage.removeItem('ecommerce.email'); setAuthenticated(false); setDemoMode(false) }
  async function adjustStock(productId: string, quantityChange: number) {
    try {
      const updated = await api.adjustInventory(productId, quantityChange, 'Dashboard adjustment')
      setProducts((current) => current.map((product) => product.id === updated.id ? updated : product))
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update stock.') }
  }
  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase())), [products, search])
  useEffect(() => {
    if (demoMode) return
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.row-menu'))
    const handlers = buttons.map((button, index) => {
      const handler = () => setEditingProduct(filteredProducts[index] ?? null)
      button.addEventListener('click', handler)
      return { button, handler }
    })
    return () => handlers.forEach(({ button, handler }) => button.removeEventListener('click', handler))
  }, [demoMode, filteredProducts])
  if (!authenticated && !demoMode) return <AuthScreen onAuthenticated={() => setAuthenticated(true)} onDemo={() => setDemoMode(true)} />
  if (!demoMode && !loading && stores.length === 0) return <StoreSetup onCreated={(created) => { setStores([created]); setStore(created) }} onSignOut={signOut} />
  if (active === 'Orders') return <OrdersPage store={store} orders={orders} onBack={() => setActive('Overview')} onSignOut={signOut} />
  if (active === 'Customers') return <CustomersPage store={store} customers={customers} onBack={() => setActive('Overview')} onSignOut={signOut} />
  if (active === 'Store settings') return <StoreSettingsPage store={store} onUpdated={setStore} onBack={() => setActive('Overview')} onSignOut={signOut} />
  if (editingProduct && !demoMode && store) return <ProductEditForm product={editingProduct} categories={categories} onSaved={(updated) => { setProducts((current) => current.map((item) => item.id === updated.id ? updated : item)); setEditingProduct(null) }} onCancel={() => setEditingProduct(null)} />
  if (active !== 'Overview') return <AdminTabPage active={active} store={store} products={products} onBack={() => setActive('Overview')} onSignOut={signOut} />
  if (viewStorefront) return <Storefront store={store} products={demoMode ? [] : products.filter((product) => product.isActive)} onBack={() => setViewStorefront(false)} />

  const displayedProducts = demoMode ? [{ name: 'Everyday Tote', sku: 'TOTE-001', price: 42, stockQuantity: 24 }, { name: 'Stoneware Mug', sku: 'MUG-014', price: 18, stockQuantity: 8 }, { name: 'Linen Overshirt', sku: 'LIN-203', price: 68, stockQuantity: 3 }] : filteredProducts
  const lowStock = displayedProducts.filter((product) => product.stockQuantity < 5).length
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">e</span><span>Ecommerce<span className="brand-light">Project</span></span></div><div className="store-switcher"><span className="store-avatar">{(store?.name ?? 'M')[0]}</span><span><strong>{store?.name ?? 'Demo store'}</strong><small>Merchant store</small></span><span className="chevron">⌄</span></div><nav>{['Overview', 'Products', 'Orders', 'Customers', 'Store settings'].map((item) => <button className={active === item ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item)} key={item}><span className="nav-icon">{({ Overview: '⌂', Products: '▦', Orders: '↗', Customers: '♙', 'Store settings': '⚙' } as Record<string, string>)[item]}</span>{item}</button>)}</nav><div className="sidebar-bottom"><div className="help-card"><span className="help-icon">?</span><div><strong>Need a hand?</strong><small>Visit the quick-start guide</small></div></div><button className="profile"><span className="profile-avatar">M</span><span><strong>Merchant account</strong><small>{localStorage.getItem('ecommerce.email') ?? 'Preview mode'}</small></span></button><button className="sign-out" onClick={signOut}>Sign out</button></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> {active}</div><div className="top-actions"><button className="icon-button">⌕</button><button className="icon-button notification">♢<i /></button><button className="view-store" onClick={() => setViewStorefront(true)}>View storefront ↗</button></div></header><section className="page-content"><div className="page-heading"><div><p className="eyebrow">Thursday, September 25, 2026</p><h1>Good morning, merchant <span>✦</span></h1><p className="subheading">Here’s what’s happening with your store today.</p></div><button className="primary-button" onClick={() => setShowProductForm(true)}>＋ Add product</button></div>{error && <div className="auth-error" role="alert">{error}</div>}<div className="metrics"><Metric label="Products" value={String(displayedProducts.length)} detail="In your catalogue" positive /><Metric label="Categories" value={String(demoMode ? 3 : categories.length)} detail="Organize your store" positive /><Metric label="Low stock" value={String(lowStock)} detail={lowStock ? 'Needs attention' : 'All stocked'} warning={lowStock > 0} /><Metric label="Store status" value={store?.status ?? 'Preview'} detail="Ready to sell" positive /></div><div className="content-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Sales overview</h2><p>Connect payments to see live revenue here.</p></div><span className="progress-ring">{store ? 'LIVE' : 'DEMO'}</span></div><div className="empty-state"><strong>Your sales workspace is ready</strong><span>Products and inventory are now connected to your account.</span></div></section><section className="panel tasks-panel"><div className="panel-heading"><div><h2>Store setup</h2><p>{store ? '1 of 3 steps complete' : 'Get started'}</p></div></div><div className="progress-bar"><span style={{ width: store ? '34%' : '0%' }} /></div><ul className="task-list"><li className="done"><span>✓</span><div><strong>Create your store</strong><small>{store ? 'Your storefront is live' : 'Complete store setup'}</small></div></li><li><span className="empty-check" /><div><strong>Add your first product</strong><small>{products.length} products added</small></div><button className="task-action" onClick={() => setShowProductForm(true)}>Start</button></li><li><span className="empty-check" /><div><strong>Connect payments</strong><small>Accept payments from customers</small></div><button className="task-action">Start</button></li></ul></section></div><section className="panel products-panel"><div className="panel-heading"><div><h2>Products</h2><p>Keep your catalogue fresh and ready to sell.</p></div><div className="panel-actions">{store && !demoMode && <StarterCatalogButton storeId={store.id} categories={categories} products={products} onUpdated={(newCategories, newProducts) => { setCategories(newCategories); setProducts(newProducts) }} />}<button className="secondary-button" onClick={() => setShowCategoryForm(true)}>＋ Category</button><button className="secondary-button" onClick={() => setShowProductForm(true)}>＋ Add product</button></div></div><div className="table-toolbar"><div className="search-box">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></div><button className="filter-button">Filter <span>☷</span></button></div><div className="product-table"><div className="table-row table-header"><span>Product</span><span>SKU</span><span>Price</span><span>Stock</span><span /></div>{displayedProducts.map((product, index) => <div className="table-row" key={product.sku}><span className="product-name"><span className={`product-thumb ${['sand', 'blue', 'green'][index % 3]}`}><img src={productImage(product, index)} alt="" /></span><span><strong>{product.name}</strong><small>{product.sku}</small></span></span><span className="muted">{product.sku}</span><span>${Number(product.price).toFixed(2)}</span><span className={product.stockQuantity < 5 ? 'stock low' : 'stock'}><button className="stock-step" disabled={demoMode || product.stockQuantity === 0} onClick={() => !demoMode && 'id' in product && adjustStock(product.id, -1)}>−</button><i />{product.stockQuantity}<button className="stock-step" disabled={demoMode} onClick={() => !demoMode && 'id' in product && adjustStock(product.id, 1)}>＋</button></span><button className="row-menu">•••</button></div>)}</div>{!displayedProducts.length && <div className="empty-state"><strong>No products yet</strong><span>Add your first product to start building your catalogue.</span></div>}</section>{showProductForm && !demoMode && store && <ProductForm storeId={store.id} categories={categories} onCreated={(product) => { setProducts((current) => [...current, product]); setShowProductForm(false) }} onNewCategory={() => setShowCategoryForm(true)} onCancel={() => setShowProductForm(false)} />}{showCategoryForm && !demoMode && store && <CategoryForm storeId={store.id} onCreated={(category) => { setCategories((current) => [...current, category]); setShowCategoryForm(false) }} onCancel={() => setShowCategoryForm(false)} />}</section></main></div>
}

function StoreSetup({ onCreated, onSignOut }: { onCreated: (store: Store) => void; onSignOut: () => void }) { const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { onCreated(await api.createStore({ name, description })) } catch (e) { const message = e instanceof Error ? e.message : 'Unable to create store.'; if (message.includes('session has expired')) onSignOut(); else setError(message) } finally { setBusy(false) } } return <main className="auth-shell"><section className="auth-visual"><div className="auth-brand"><span className="brand-mark">e</span><span>Ecommerce<span className="brand-light">Project</span></span></div><div className="auth-message"><p className="eyebrow">Your first step</p><h1>Let’s create your store.</h1><p>Give your storefront a name and we’ll prepare your merchant workspace.</p></div></section><section className="auth-card-wrap"><div className="auth-card"><div className="auth-heading"><p className="eyebrow">Store setup</p><h2>Create your store</h2><p>This information can be updated later.</p></div><form onSubmit={submit}><label>Store name<input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Maison North" /></label><label>Description <span className="muted">(optional)</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What makes your store special?" rows={3} /></label>{error && <div className="auth-error">{error}</div>}<button className="auth-submit" disabled={busy}>{busy ? 'Creating…' : 'Create store'} <span>→</span></button></form><button className="demo-link" onClick={onSignOut}>Sign out</button></div></section></main> }

function StoreSettingsPage({ store, onUpdated, onBack, onSignOut }: { store: Store | null; onUpdated: (store: Store) => void; onBack: () => void; onSignOut: () => void }) {
  const [form, setForm] = useState({ name: store?.name ?? '', slug: store?.slug ?? '', description: store?.description ?? '', email: store?.email ?? '', phoneNumber: store?.phoneNumber ?? '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setForm({ name: store?.name ?? '', slug: store?.slug ?? '', description: store?.description ?? '', email: store?.email ?? '', phoneNumber: store?.phoneNumber ?? '' })
  }, [store])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!store) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const updated = await api.updateStore(store.id, form)
      onUpdated(updated)
      setMessage('Store settings saved successfully.')
    } catch (e) {
      const details = e instanceof Error ? e.message : 'Unable to save store settings.'
      if (details.includes('session has expired')) onSignOut()
      else setError(details)
    } finally {
      setBusy(false)
    }
  }

  return <div className="section-shell"><header className="section-header"><button className="back-link" onClick={onBack}>← Overview</button><div className="section-brand"><span className="brand-mark">e</span> EcommerceProject</div><button className="sign-out light-sign-out" onClick={onSignOut}>Sign out</button></header><main className="section-main"><p className="eyebrow">Workspace</p><h1>Store settings</h1><p className="section-description">Update your store identity and contact details. These changes are saved to your store account.</p>{store ? <form className="settings-form section-card" onSubmit={submit}><label>Store name<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Store URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/\s+/g, '-') })} /><small>Use lowercase letters, numbers, and single hyphens.</small></label><label>Description<textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What makes your store special?" /></label><div className="form-row"><label>Contact email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="hello@example.com" /></label><label>Phone number<input value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} placeholder="+1 555 000 0000" /></label></div>{error && <div className="auth-error" role="alert">{error}</div>}{message && <div className="settings-success" role="status">{message}</div>}<button className="auth-submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'} <span>→</span></button></form> : <div className="section-card empty-section"><h2>No store selected</h2><p>Create a store before editing its settings.</p></div>}</main></div>
}

function AdminTabPage({ active, store, products, onBack, onSignOut }: { active: string; store: Store | null; products: Product[]; onBack: () => void; onSignOut: () => void }) { const titles: Record<string, { eyebrow: string; title: string; description: string }> = { Products: { eyebrow: 'Catalogue', title: 'Manage your products', description: 'Create, organize, and keep your inventory accurate.' }, Orders: { eyebrow: 'Fulfilment', title: 'Orders will live here', description: 'Review new orders, update statuses, and keep customers informed.' }, Customers: { eyebrow: 'Relationships', title: 'Customer insights', description: 'Understand your customers and build lasting relationships.' }, 'Store settings': { eyebrow: 'Workspace', title: 'Store settings', description: 'Update your store identity, contact details, and selling preferences.' } }; const content = titles[active] ?? titles.Products; return <div className="section-shell"><header className="section-header"><button className="back-link" onClick={onBack}>← Overview</button><div className="section-brand"><span className="brand-mark">e</span> EcommerceProject</div><button className="sign-out light-sign-out" onClick={onSignOut}>Sign out</button></header><main className="section-main"><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p className="section-description">{content.description}</p>{active === 'Products' ? <div className="section-grid"><div className="section-stat"><strong>{products.length}</strong><span>Products in catalogue</span></div><div className="section-stat"><strong>{store?.name ?? 'Your store'}</strong><span>Current store</span></div><div className="section-card"><h2>Product management</h2><p>Use the Overview workspace to add products, categories, images, and stock adjustments.</p><button className="auth-submit" onClick={onBack}>Open product workspace <span>→</span></button></div></div> : active === 'Store settings' ? <div className="section-card settings-card"><h2>{store?.name ?? 'Your store'}</h2><p>{store?.description || 'Add a description to tell customers what makes your store special.'}</p><div className="settings-row"><span>Store URL</span><strong>/{store?.slug ?? 'your-store'}</strong></div><div className="settings-row"><span>Status</span><strong>{store?.status ?? 'Draft'}</strong></div><p className="section-note">Store editing controls will be connected here next.</p></div> : <div className="section-card empty-section"><span className="section-icon">✦</span><h2>This workspace is ready for the next phase</h2><p>The navigation is now active. {active} data and actions will be connected as the next requirement.</p><button className="secondary-button" onClick={onBack}>Return to overview</button></div>}</main></div> }

function CustomersPage({ store, customers, onBack, onSignOut }: { store: Store | null; customers: CustomerSummary[]; onBack: () => void; onSignOut: () => void }) {
  return <div className="section-shell"><header className="section-header"><button className="back-link" onClick={onBack}>← Overview</button><div className="section-brand"><span className="brand-mark">e</span> EcommerceProject</div><button className="sign-out light-sign-out" onClick={onSignOut}>Sign out</button></header><main className="section-main"><p className="eyebrow">Relationships</p><h1>Customers</h1><p className="section-description">Understand the people shopping with you and build lasting relationships.</p><div className="section-grid"><div className="section-stat"><strong>{customers.length}</strong><span>Total customers</span></div><div className="section-stat"><strong>{customers.reduce((sum, customer) => sum + customer.orderCount, 0)}</strong><span>Total orders</span></div><div className="section-stat"><strong>${customers.reduce((sum, customer) => sum + Number(customer.totalSpent), 0).toFixed(2)}</strong><span>Customer revenue</span></div></div>{customers.length ? <div className="customers-list">{customers.map((customer) => <article className="customer-card" key={customer.email}><div className="customer-avatar">{customer.name.charAt(0).toUpperCase()}</div><div className="customer-main"><strong>{customer.name}</strong><small>{customer.email}</small><span>Last order: {new Date(customer.lastOrderAt).toLocaleDateString()}</span></div><div className="customer-stat"><strong>{customer.orderCount}</strong><small>Orders</small></div><div className="customer-stat"><strong>${Number(customer.totalSpent).toFixed(2)}</strong><small>Total spent</small></div></article>)}</div> : <div className="section-card empty-section"><span className="section-icon">♙</span><h2>No customers yet</h2><p>Customers will appear here after they place an order through your storefront.</p><button className="secondary-button" onClick={onBack}>Return to overview</button></div>}</main></div>
}

function StarterCatalogButton({ storeId, categories, products, onUpdated }: { storeId: string; categories: Category[]; products: Product[]; onUpdated: (categories: Category[], products: Product[]) => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const starterCategories = ['Accessories', 'Home', 'Apparel']
  const starterProducts = [
    ['Canvas Crossbody Bag', 'BAG-101', 36, 18, 'Accessories'], ['Leather Card Holder', 'ACC-118', 24, 30, 'Accessories'], ['Insulated Travel Bottle', 'BOT-122', 28, 20, 'Accessories'],
    ['Soy Candle - Cedar', 'HOM-201', 22, 16, 'Home'], ['Woven Throw Blanket', 'HOM-214', 54, 10, 'Home'], ['Minimal Desk Tray', 'HOM-229', 32, 14, 'Home'],
    ['Relaxed Cotton Tee', 'APP-301', 29, 25, 'Apparel'], ['Ribbed Lounge Set', 'APP-318', 76, 8, 'Apparel'], ['Classic Knit Cardigan', 'APP-326', 88, 7, 'Apparel']
  ] as const

  async function loadCatalogue() {
    setBusy(true); setMessage('')
    try {
      const nextCategories = [...categories]
      for (const name of starterCategories) {
        if (!nextCategories.some((category) => category.name.toLowerCase() === name.toLowerCase())) nextCategories.push(await api.createCategory(storeId, { name }))
      }
      const nextProducts = [...products]
      for (const [name, sku, price, stockQuantity, categoryName] of starterProducts) {
        if (nextProducts.some((product) => product.sku.toLowerCase() === sku.toLowerCase())) continue
        const category = nextCategories.find((item) => item.name === categoryName)
        nextProducts.push(await api.createProduct(storeId, { name, sku, price, stockQuantity, categoryId: category?.id }))
      }
      onUpdated(nextCategories, nextProducts)
      setMessage('Starter catalogue added.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to add starter products.') } finally { setBusy(false) }
  }

  return <button className="secondary-button starter-button" onClick={loadCatalogue} disabled={busy}>{busy ? 'Adding items…' : '＋ Starter catalogue'}{message && <small>{message}</small>}</button>
}

function OrdersPage({ store, orders, onBack, onSignOut }: { store: Store | null; orders: OrderSummary[]; onBack: () => void; onSignOut: () => void }) {
  const [items, setItems] = useState(orders)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const statuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled']

  async function updateStatus(orderId: string, status: string) {
    setBusyId(orderId)
    setError('')
    try {
      await api.updateOrderStatus(orderId, status)
      setItems((current) => current.map((order) => order.id === orderId ? { ...order, status } : order))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update order status.')
    } finally {
      setBusyId('')
    }
  }

  return <div className="section-shell"><header className="section-header"><button className="back-link" onClick={onBack}>← Overview</button><div className="section-brand"><span className="brand-mark">e</span> EcommerceProject</div><button className="sign-out light-sign-out" onClick={onSignOut}>Sign out</button></header><main className="section-main"><p className="eyebrow">Fulfilment</p><h1>Orders</h1><p className="section-description">Review customer purchases and keep fulfilment moving.</p>{error && <div className="auth-error" role="alert">{error}</div>}<div className="section-grid"><div className="section-stat"><strong>{items.length}</strong><span>Total orders</span></div><div className="section-stat"><strong>{items.filter((order) => order.status === 'Pending').length}</strong><span>Pending fulfilment</span></div><div className="section-stat"><strong>{store?.name ?? 'Your store'}</strong><span>Current store</span></div></div>{items.length ? <div className="orders-list">{items.map((order) => <article className="order-card" key={order.id}><div className="order-card-heading"><div><strong>{order.customerName}</strong><small>{order.customerEmail}</small></div><span className="order-status">{order.status}</span></div><div className="order-card-meta"><span>{new Date(order.createdAt).toLocaleString()}</span><strong>${Number(order.total).toFixed(2)}</strong></div><div className="order-items">{order.items.map((item, index) => <span key={`${order.id}-${index}`}>{item.quantity} × {item.productName}</span>)}</div><small className="order-address">Deliver to: {order.deliveryAddress}</small><div className="order-actions"><label>Update status<select value={order.status} disabled={busyId === order.id} onChange={(event) => updateStatus(order.id, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>{busyId === order.id && <small>Saving…</small>}</div></article>)}</div> : <div className="section-card empty-section"><span className="section-icon">✓</span><h2>No orders yet</h2><p>Orders placed through your storefront will appear here with customer and fulfilment details.</p><button className="secondary-button" onClick={onBack}>Return to overview</button></div>}</main></div>
}

function ProductForm({ storeId, categories, onCreated, onNewCategory, onCancel }: { storeId: string; categories: Category[]; onCreated: (product: Product) => void; onNewCategory: () => void; onCancel: () => void }) { const [form, setForm] = useState({ name: '', sku: '', price: '', stockQuantity: '0', categoryId: '' }); const [image, setImage] = useState<File | null>(null); const [preview, setPreview] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { const created = await api.createProduct(storeId, { name: form.name, sku: form.sku, price: Number(form.price), stockQuantity: Number(form.stockQuantity), categoryId: form.categoryId || undefined }); const saved = image ? await api.uploadProductImage(created.id, image) : created; onCreated(saved) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create product.') } finally { setBusy(false) } } return <div className="modal-backdrop"><section className="auth-card modal-card"><div className="auth-heading"><p className="eyebrow">Catalogue</p><h2>Add a product</h2><p>Create a product that will be saved to your store.</p></div><form onSubmit={submit}><label>Product image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0] ?? null; setImage(file); setPreview(file ? URL.createObjectURL(file) : '') }} />{preview && <img className="image-preview" src={preview} alt="Selected product preview" />}<small className="field-hint">JPG, PNG, or WebP up to 5 MB.</small></label><label>Product name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Everyday Tote" /></label><div className="form-row"><label>SKU<input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="TOTE-001" /></label><label>Price<input required min="0.01" step="0.01" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="42.00" /></label></div><div className="form-row"><label>Stock<input required min="0" type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} /></label><label>Category<select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button type="button" className="inline-link" onClick={onNewCategory}>＋ Create a category</button></label></div>{error && <div className="auth-error">{error}</div>}<div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="auth-submit" disabled={busy}>{busy ? 'Saving…' : 'Save product'} <span>→</span></button></div></form></section></div> }

function ProductEditForm({ product, categories, onSaved, onCancel }: { product: Product; categories: Category[]; onSaved: (product: Product) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: product.name, sku: product.sku, price: String(product.price), categoryId: product.categoryId ?? '', description: product.description ?? '' })
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState(product.imageUrl ? `http://127.0.0.1:5087${product.imageUrl}` : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const updated = await api.updateProduct(product.id, { name: form.name, sku: form.sku, price: Number(form.price), categoryId: form.categoryId || undefined, description: form.description, isActive: true })
      onSaved(image ? await api.uploadProductImage(updated.id, image) : updated)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update product.') } finally { setBusy(false) }
  }
  async function archiveProduct() {
    setBusy(true); setError('')
    try {
      const archived = await api.updateProduct(product.id, { name: form.name, sku: form.sku, price: Number(form.price), categoryId: form.categoryId || undefined, description: form.description, isActive: false })
      onSaved(archived)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to archive product.') } finally { setBusy(false) }
  }
  return <main className="auth-shell"><section className="auth-visual"><div className="auth-brand"><span className="brand-mark">e</span><span>Ecommerce<span className="brand-light">Project</span></span></div><div className="auth-message"><p className="eyebrow">Catalogue</p><h1>Edit your product.</h1><p>Keep product details, pricing, and imagery accurate for your customers.</p></div></section><section className="auth-card-wrap"><div className="auth-card"><div className="auth-heading"><p className="eyebrow">Product management</p><h2>Edit {product.name}</h2><p>Changes are saved to your catalogue.</p></div><form onSubmit={submit}><label>Product image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; setImage(file); setPreview(file ? URL.createObjectURL(file) : preview) }} />{preview && <img className="image-preview" src={preview} alt={`${form.name} preview`} />}<small className="field-hint">JPG, PNG, or WebP up to 5 MB.</small></label><label>Product name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div className="form-row"><label>SKU<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label><label>Price<input required min="0.01" step="0.01" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label></div><div className="form-row"><label>Description<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Category<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Uncategorized</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>{error && <div className="auth-error" role="alert">{error}</div>}<div className="form-actions"><button type="button" className="danger-button" onClick={archiveProduct} disabled={busy}>Archive product</button><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="auth-submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <span>→</span></button></div></form></div></section></main>
}

function CategoryForm({ storeId, onCreated, onCancel }: { storeId: string; onCreated: (category: Category) => void; onCancel: () => void }) { const [name, setName] = useState(''); const [error, setError] = useState(''); async function submit(event: FormEvent) { event.preventDefault(); try { onCreated(await api.createCategory(storeId, { name })) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create category.') } } return <div className="modal-backdrop"><section className="auth-card modal-card"><div className="auth-heading"><p className="eyebrow">Catalogue</p><h2>Create a category</h2><p>Keep your products easy to browse.</p></div><form onSubmit={submit}><label>Category name<input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Accessories" /></label>{error && <div className="auth-error">{error}</div>}<div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="auth-submit">Save category <span>→</span></button></div></form></section></div> }

type CartLine = { product: Product; quantity: number }

function Storefront({ store, products, onBack }: { store: Store | null; products: Product[]; onBack: () => void }) {
  const [cart, setCart] = useState<CartLine[]>([])
  const [showCart, setShowCart] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [orderId, setOrderId] = useState('')
  const addToCart = (product: Product) => setCart((items) => {
    const existing = items.find((item) => item.product.id === product.id)
    if (existing) return items.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stockQuantity) } : item)
    return [...items, { product, quantity: 1 }]
  })
  const updateQuantity = (productId: string, quantity: number) => setCart((items) => quantity < 1 ? items.filter((item) => item.product.id !== productId) : items.map((item) => item.product.id === productId ? { ...item, quantity: Math.min(quantity, item.product.stockQuantity) } : item))
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0)
  const finishOrder = (createdOrderId: string) => {
    setOrderId(createdOrderId)
    setSubmitted(true)
  }

  return <div className="storefront">
    <header className="storefront-header"><button className="back-link" onClick={onBack}>← Merchant dashboard</button><div className="storefront-brand">{store?.name ?? 'Your Store'}</div><button className="cart-button" onClick={() => setShowCart(true)}>Cart <span>{cartCount}</span></button></header>
    <main className="storefront-main">
      <section className="storefront-hero"><p className="eyebrow">Welcome to {store?.name ?? 'our store'}</p><h1>Thoughtfully chosen.<br /><em>Ready for your everyday.</em></h1><p>Discover products selected to make your day more useful, beautiful, and effortless.</p></section>
      <div className="storefront-section-heading"><div><p className="eyebrow">The collection</p><h2>Shop the latest</h2></div><span>{products.length} products</span></div>
      {products.length ? <div className="storefront-grid">{products.map((product, index) => <article className="store-product" key={product.id}><div className={`store-product-image ${['sand', 'blue', 'green'][index % 3]}`}><img src={productImage(product, index)} alt={product.name} /></div><div className="store-product-info"><div><h3>{product.name}</h3><p>{product.sku}</p></div><strong>${Number(product.price).toFixed(2)}</strong></div><button className="store-add" onClick={() => addToCart(product)}>Add to cart <span>＋</span></button></article>)}</div> : <div className="storefront-empty"><h2>Your storefront is ready</h2><p>Add products from the merchant dashboard to start selling.</p></div>}
    </main>
    {showCart && <div className="cart-drawer-backdrop" onClick={() => setShowCart(false)}><aside className="cart-drawer" onClick={(event) => event.stopPropagation()}><div className="cart-heading"><div><p className="eyebrow">Your basket</p><h2>{checkout ? 'Checkout' : `Cart (${cart.length})`}</h2></div><button onClick={() => setShowCart(false)}>×</button></div>
      {submitted ? <div className="checkout-success"><span>✓</span><h2>Order received</h2><p>Your order has been saved successfully.</p><small>Order reference: {orderId.slice(0, 8).toUpperCase()}</small><button className="secondary-button" onClick={() => { setSubmitted(false); setCheckout(false); setCart([]); setShowCart(false) }}>Continue shopping</button></div> : checkout ? <CheckoutForm storeId={store?.id} cart={cart} total={total} onSuccess={finishOrder} onBack={() => setCheckout(false)} /> : cart.length ? <><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.product.id}><div><span>{item.product.name}</span><small>${Number(item.product.price).toFixed(2)} each</small></div><div className="cart-line-actions"><button type="button" onClick={() => updateQuantity(item.product.id, item.quantity - 1)} aria-label={`Decrease ${item.product.name}`}>−</button><strong>{item.quantity}</strong><button type="button" onClick={() => updateQuantity(item.product.id, item.quantity + 1)} aria-label={`Increase ${item.product.name}`} disabled={item.quantity >= item.product.stockQuantity}>＋</button></div></div>)}</div><div className="cart-total"><span>Total</span><strong>${total.toFixed(2)}</strong></div><button className="auth-submit" onClick={() => setCheckout(true)}>Continue to checkout <span>→</span></button></> : <div className="empty-state"><strong>Your cart is empty</strong><span>Add something you love.</span></div>}
    </aside></div>}
  </div>
}

function CheckoutForm({ storeId, cart, total, onSuccess, onBack }: { storeId?: string; cart: CartLine[]; total: number; onSuccess: (orderId: string) => void; onBack: () => void }) {
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!storeId) { setError('This preview store cannot accept orders yet.'); return }
    setBusy(true)
    setError('')
    try {
      const order = await api.createOrder({ storeId, customerName, customerEmail, deliveryAddress, items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })) })
      onSuccess(order.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to place this order.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="checkout-form" onSubmit={submit}><label>Full name<input required value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Jordan Davis" /></label><label>Email address<input required type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="you@example.com" /></label><label>Delivery address<textarea required rows={3} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Street, city, country" /></label>{error && <div className="auth-error" role="alert">{error}</div>}<div className="cart-total"><span>Total</span><strong>${total.toFixed(2)}</strong></div><button className="auth-submit" disabled={busy}>{busy ? 'Saving order…' : 'Place order'} <span>→</span></button><button type="button" className="back-link" onClick={onBack}>← Back to cart</button></form>
}

function Metric({ label, value, detail, positive, warning }: { label: string; value: string; detail: string; positive?: boolean; warning?: boolean }) { return <div className="metric-card"><span className="metric-label">{label}</span><strong>{value}</strong><span className={positive ? 'metric-detail positive' : warning ? 'metric-detail warning' : 'metric-detail'}>{detail}</span></div> }
export default App
