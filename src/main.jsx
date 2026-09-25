import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowRight, ChevronDown, Coffee, Heart, Loader2, LogOut, Menu as MenuIcon, Minus, Package,
  Plus, Search, ShoppingBag, Sparkles, Store, User, X, MapPin, Clock3, ShieldCheck, CheckCircle2,
  AlertCircle, CreditCard, Trash2, BarChart3, Boxes, ClipboardList, Home as HomeIcon, Settings, ImagePlus
} from "lucide-react";
import "./styles.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const GCASH_QR_URL = import.meta.env.VITE_GCASH_QR_URL || "";
const MAYA_QR_URL = import.meta.env.VITE_MAYA_QR_URL || "";
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const demoProducts = [
  { id: "demo-1", name: "Kai Latte", slug: "kai-latte", description: "Smooth espresso, steamed milk and a mellow caramel finish.", price: 145, is_featured: true, is_available: true, category: { name: "Coffee", slug: "coffee" } },
  { id: "demo-2", name: "Cold Brew", slug: "cold-brew", description: "Slow-steeped coffee with a clean, chocolatey finish.", price: 150, is_featured: true, is_available: true, category: { name: "Iced Coffee", slug: "iced-coffee" } },
  { id: "demo-3", name: "Spanish Latte", slug: "spanish-latte", description: "Espresso, fresh milk and sweetened condensed milk.", price: 155, is_featured: true, is_available: true, category: { name: "Coffee", slug: "coffee" } },
  { id: "demo-4", name: "Ube Cream Latte", slug: "ube-cream-latte", description: "A Filipino-inspired latte with a soft ube cream finish.", price: 165, is_featured: true, is_available: true, category: { name: "Non-Coffee", slug: "non-coffee" } },
  { id: "demo-5", name: "Butter Croissant", slug: "butter-croissant", description: "Flaky, buttery and baked for the morning rush.", price: 110, is_featured: false, is_available: true, category: { name: "Pastries", slug: "pastries" } }
];

const money = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const imageFor = (p) => p.image_url || `https://images.unsplash.com/${({
  "kai-latte": "photo-1495474472287-4d71bcdd2085",
  "cold-brew": "photo-1517701604599-bb29b565090c",
  "spanish-latte": "photo-1509042239860-f550ce710b93",
  "ube-cream-latte": "photo-1498804103079-a6351b050096",
  "butter-croissant": "photo-1555507036-ab1f4038808a"
}[p.slug] || "photo-1447933601403-0c6688de566e")}?auto=format&fit=crop&w=1000&q=85`;

function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s) await loadProfile(s.user.id); else setProfile(null);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  async function loadProfile(id) {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).single();
    setProfile(data || null);
  }
  return { session, profile, loading, refreshProfile: () => session && loadProfile(session.user.id) };
}

function App() {
  const auth = useAuth();
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem("kai-phe-cart") || "[]"));
  useEffect(() => localStorage.setItem("kai-phe-cart", JSON.stringify(cart)), [cart]);
  useEffect(() => { if (auth.session) syncCart(auth.session.user.id, cart); }, [auth.session]);
  async function syncCart(userId, items) {
    if (!supabase) return;
    let { data: existing } = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
    if (!existing) {
      const r = await supabase.from("carts").insert({ user_id: userId }).select().single();
      existing = r.data;
    }
    if (existing) {
      await supabase.from("cart_items").delete().eq("cart_id", existing.id);
      const rows = items.filter(i => !String(i.id).startsWith("demo-")).map(i => ({ cart_id: existing.id, product_id: i.id, quantity: i.qty }));
      if (rows.length) await supabase.from("cart_items").insert(rows);
    }
  }
  const addToCart = (product) => {
    setCart(prev => {
      const found = prev.find(x => x.id === product.id);
      return found ? prev.map(x => x.id === product.id ? { ...x, qty: x.qty + 1 } : x) : [...prev, { ...product, qty: 1 }];
    });
  };
  const changeQty = (id, delta) => setCart(prev => prev.map(x => x.id === id ? { ...x, qty: x.qty + delta } : x).filter(x => x.qty > 0));
  const clearCart = () => setCart([]);
  return <AppContext.Provider value={{ ...auth, cart, addToCart, changeQty, clearCart }}><RoutesWrap /></AppContext.Provider>;
}
const AppContext = React.createContext(null);
const useApp = () => React.useContext(AppContext);

function RoutesWrap() {
  return <Routes>
    <Route path="/" element={<StoreLayout />}><Route index element={<Home />} /><Route path="menu" element={<Menu />} /><Route path="menu/:slug" element={<ProductPage />} /><Route path="cart" element={<Cart />} /><Route path="checkout" element={<Protected><Checkout /></Protected>} /><Route path="orders" element={<Protected><Orders /></Protected>} /><Route path="account" element={<Protected><Account /></Protected>} /><Route path="auth" element={<Auth />} /><Route path="order-success/:id" element={<Protected><OrderSuccess /></Protected>} /></Route>
    <Route path="/admin/*" element={<AdminGuard><Admin /></AdminGuard>} />
  </Routes>
}

function Protected({ children }) { const { session, loading } = useApp(); if (loading) return <FullLoader />; return session ? children : <Navigate to="/auth?next=/checkout" replace /> }
function AdminGuard({ children }) { const { session, profile, loading } = useApp(); if (loading) return <FullLoader />; if (!session) return <Navigate to="/auth?next=/admin" replace />; if (profile?.role !== "admin") return <Navigate to="/" replace />; return children }
function FullLoader() { return <div className="screen-loader"><Loader2 className="spin" /> <span>Loading Kai Phe Han…</span></div> }

function StoreLayout() {
  const { cart, session, profile } = useApp(); const [open, setOpen] = useState(false);
  const nav = [["/", "Home"], ["/menu", "Menu"], ["/orders", "Orders"], ["/account", "Account"]];
  return <div className="app-shell">
    <header className="site-header">
      <Link to="/" className="brand" onClick={() => setOpen(false)}><span className="brand-mark"><Coffee size={19} /></span><span>Kai Phe Han</span></Link>
      <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Open menu">{open ? <X /> : <MenuIcon />}</button>
      <nav className={open ? "main-nav open" : "main-nav"}>{nav.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}>{label}</NavLink>)}<Link to="/cart" className="cart-link" onClick={() => setOpen(false)}><ShoppingBag size={18} /> Cart {cart.length > 0 && <b>{cart.reduce((a, x) => a + x.qty, 0)}</b>}</Link>{session ? <span className="user-chip">{profile?.full_name?.split(" ")[0] || "Customer"}</span> : <Link className="header-signin" to="/auth" onClick={() => setOpen(false)}>Sign in</Link>}</nav>
    </header>
    <main><OutletShim /></main>
    <Footer />
  </div>
}
function OutletShim() { const loc = useLocation(); return <Routes><Route path="*" element={<PageByPath path={loc.pathname} />} /></Routes> }
function PageByPath({ path }) { return <Routes><Route path="/" element={<Home />} /><Route path="/menu" element={<Menu />} /><Route path="/menu/:slug" element={<ProductPage />} /><Route path="/cart" element={<Cart />} /><Route path="/checkout" element={<Protected><Checkout /></Protected>} /><Route path="/orders" element={<Protected><Orders /></Protected>} /><Route path="/account" element={<Protected><Account /></Protected>} /><Route path="/auth" element={<Auth />} /><Route path="/order-success/:id" element={<Protected><OrderSuccess /></Protected>} /></Routes> }

function Footer() { return <footer><div className="footer-inner"><div><Link to="/" className="brand"><span className="brand-mark"><Coffee size={18} /></span>Kai Phe Han</Link><p className="muted footer-copy">Good coffee, warm corners, and everyday moments worth slowing down for.</p></div><div><b>Visit</b><p>Mon–Sun · 7:00 AM–10:00 PM</p><p>Quezon City, Metro Manila</p></div><div><b>Contact</b><p>hello@kaiphe.cafe</p><p>0917 000 0000</p></div></div><div className="footer-bottom">© {new Date().getFullYear()} Kai Phe Han. All rights reserved.</div></footer> }

function Home() {
  const { addToCart } = useApp(); const [products, setProducts] = useState(demoProducts);
  useEffect(() => { if (supabase) supabase.from("products").select("*,category:categories(*)").eq("is_available", true).order("created_at", { ascending: false }).then(({ data }) => data?.length && setProducts(data)); }, []);
  return <><section className="hero"><div className="hero-copy"><span className="eyebrow">COFFEE · PASTRIES · GOOD COMPANY</span><h1>Your daily cup,<br /><em>the Kai Phe Han way.</em></h1><p>Thoughtfully brewed coffee and Filipino-inspired favorites, served fresh from our neighborhood counter in Quezon City.</p><div className="hero-actions"><Link className="btn btn-dark" to="/menu">Explore the menu <ArrowRight size={17} /></Link><a className="text-link" href="#story">Our story</a></div></div><div className="hero-photo"><div className="photo-badge"><span>Open today</span><strong>7 AM — 10 PM</strong></div></div></section>
    <section className="section featured"><div className="section-head"><div><span className="eyebrow">FROM THE BAR</span><h2>What we're pouring</h2></div><Link to="/menu" className="text-link">View full menu <ArrowRight size={16} /></Link></div><div className="product-grid">{products.filter(x => x.is_featured).slice(0, 4).map(p => <ProductCard key={p.id} p={p} add={addToCart} />)}</div></section>
    <section id="story" className="story-section"><div className="story-photo"></div><div className="story-copy"><span className="eyebrow">THE Kai Phe Han STORY</span><h2>Made for slow mornings and late conversations.</h2><p>Kai Phe Han started with a simple idea: make the neighborhood café feel like your favorite seat at home. We pair approachable coffee with familiar Filipino flavors, source thoughtfully, and keep the room warm, unfussy, and welcoming.</p><p>Whether it's your first cup of the day or a catch-up that runs past sunset, there's a place for you here.</p><Link className="btn btn-outline" to="/menu">Find your favorite</Link></div></section>
    <section className="visit-section"><div><span className="eyebrow">COME BY</span><h2>A little corner for your everyday.</h2><p className="muted">Quezon City, Metro Manila</p><div className="visit-grid"><div><Clock3 /><b>Hours</b><span>Daily · 7:00 AM–10:00 PM</span></div><div><MapPin /><b>Location</b><span>Neighborhood café · Quezon City</span></div><div><Store /><b>Pickup</b><span>Order online, pick up in store</span></div></div></div><div className="visit-card"><Coffee size={30} /><b>See you over coffee.</b><span>Freshly brewed, every day.</span></div></section>
  </>;
}
function ProductCard({ p, add }) { return <article className="product-card"><Link to={`/menu/${p.slug}`} className="product-image"><img src={imageFor(p)} alt={p.name} />{p.is_featured && <span className="product-tag">Kai favorite</span>}</Link><div className="product-info"><div><span className="category-label">{p.category?.name}</span><Link to={`/menu/${p.slug}`}><h3>{p.name}</h3></Link></div><div className="product-bottom"><strong>{money(p.price)}</strong><button className="add-btn" onClick={() => add(p)} aria-label={`Add ${p.name}`}><Plus size={18} /></button></div></div></article> }

function Menu() {
  const [products, setProducts] = useState(demoProducts), [q, setQ] = useState(""), [cat, setCat] = useState("All");
  const { addToCart } = useApp();
  useEffect(() => { if (supabase) supabase.from("products").select("*,category:categories(*)").eq("is_available", true).order("name").then(({ data }) => data?.length && setProducts(data)); }, []);
  const cats = ["All", ...Array.from(new Set(products.map(p => p.category?.name).filter(Boolean)))];
  const shown = products.filter(p => (cat === "All" || p.category?.name === cat) && `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase()));
  return <section className="page-section"><div className="page-title"><div><span className="eyebrow">THE MENU</span><h1>Good things, brewed daily.</h1><p>Classic coffee, iced favorites, non-coffee sips, and something buttery on the side.</p></div><div className="search-box"><Search size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the menu" /></div></div><div className="filter-row">{cats.map(c => <button key={c} className={cat === c ? "filter active" : "filter"} onClick={() => setCat(c)}>{c}</button>)}</div><div className="product-grid menu-grid">{shown.map(p => <ProductCard key={p.id} p={p} add={addToCart} />)}</div>{!shown.length && <EmptyState title="Nothing on the counter" text="Try another search or category." />}</section>
}

function ProductPage() {
  const { slug } = useParams(); const { addToCart } = useApp(); const [p, setP] = useState(() => demoProducts.find(x => x.slug === slug)); const [loading, setLoading] = useState(!!supabase);
  useEffect(() => { if (supabase) supabase.from("products").select("*,category:categories(*)").eq("slug", slug).maybeSingle().then(({ data }) => { if (data) setP(data); setLoading(false) }); }, [slug]);
  if (loading) return <FullLoader />; if (!p) return <EmptyState title="We couldn't find that drink." text="It may have sold out or moved off the menu." />;
  return <section className="detail-section"><div className="detail-image"><img src={imageFor(p)} alt={p.name} /></div><div className="detail-copy"><span className="eyebrow">{p.category?.name}</span><h1>{p.name}</h1><p className="detail-description">{p.description}</p><strong className="detail-price">{money(p.price)}</strong><div className="detail-meta"><span><CheckCircle2 size={16} /> Available today</span><span><Coffee size={16} /> Prepared to order</span></div><button className="btn btn-dark wide" onClick={() => addToCart(p)}>Add to cart <Plus size={18} /></button><Link className="text-link back-link" to="/menu">← Back to menu</Link></div></section>
}

function Cart() {
  const { cart, changeQty, clearCart } = useApp(); const sub = cart.reduce((a, x) => a + x.price * x.qty, 0), fee = cart.length ? 49 : 0;
  return <section className="page-section narrow"><div className="page-title simple"><div><span className="eyebrow">YOUR ORDER</span><h1>Shopping bag</h1></div></div>{!cart.length ? <EmptyState title="Your bag is empty" text="Add a coffee and we'll keep it here." action={<Link className="btn btn-dark" to="/menu">Browse menu</Link>} /> : <div className="cart-layout"><div className="cart-items">{cart.map(x => <div className="cart-row" key={x.id}><img src={imageFor(x)} alt="" /><div className="cart-item-main"><span className="category-label">{x.category?.name}</span><h3>{x.name}</h3><span>{money(x.price)}</span></div><div className="qty"><button onClick={() => changeQty(x.id, -1)}><Minus /></button><b>{x.qty}</b><button onClick={() => changeQty(x.id, 1)}><Plus /></button></div></div>)}<button className="text-button danger" onClick={clearCart}><Trash2 size={15} /> Clear cart</button></div><aside className="summary"><h3>Summary</h3><div><span>Subtotal</span><b>{money(sub)}</b></div><div><span>Delivery</span><b>{money(fee)}</b></div><hr /><div className="total"><span>Total</span><b>{money(sub + fee)}</b></div><Link className="btn btn-dark wide" to="/checkout">Proceed to checkout <ArrowRight size={17} /></Link></aside></div>}</section>
}

function Checkout() {
  const { cart, profile, session, clearCart } = useApp(); const nav = useNavigate();
  const [form, setForm] = useState({ name: profile?.full_name || "", mobile: profile?.mobile || "", address: "", barangay: "", city: "Quezon City", notes: "", payment: "cod" });
  const [receipt, setReceipt] = useState(null); const [loading, setLoading] = useState(false);
  const sub = cart.reduce((a, x) => a + x.price * x.qty, 0), fee = cart.length ? 49 : 0;
  if (!cart.length) return <EmptyState title="Nothing to check out" text="Your cart is empty." action={<Link className="btn btn-dark" to="/menu">Go to menu</Link>} />;
  const set = (k, v) => setForm({ ...form, [k]: v });
  const isOnline = form.payment !== "cod";
  async function placeOrder(e) {
    e.preventDefault();
    if (!supabase) return alert("Connect Supabase first using .env.local.");
    if (isOnline && !receipt) return alert(`Please upload your ${form.payment.toUpperCase()} payment receipt before placing the order.`);
    if (receipt && receipt.size > 5 * 1024 * 1024) return alert("Receipt must be 5MB or smaller.");
    setLoading(true);
    try {
     const ids = cart
  .filter(x => !String(x.id).startsWith("demo-"))
  .map(x => x.id);

let current = cart;

if (ids.length) {
  const { data, error: productError } = await supabase
    .from("products")
    .select("id,name,price,is_available")
    .in("id", ids);

  if (productError) throw productError;

  current = cart.map(x => {
    const fresh = data?.find(p => p.id === x.id);
    return fresh ? { ...x, ...fresh } : x;
  });
}

if (current.some(x => x.is_available === false)) {
  throw new Error("One of the selected products is no longer available.");
}

const subtotal = current.reduce(
  (sum, x) => sum + Number(x.price || 0) * Number(x.qty || 0),
  0
);

const total = subtotal + 49;
   
      
      const { data: order, error: orderError } = await supabase.from("orders").insert({user_id: session.user.id, customer_name: form.name, mobile: form.mobile, address_line: form.address, barangay: form.barangay, city: form.city, notes: form.notes,subtotal: subtotal, delivery_fee: 49, total: total, payment_method: form.payment, payment_status: "pending" }).select().single();
      if (orderError) throw orderError;
      const { error: itemError } = await supabase.from("order_items").insert(current.map(x => ({ order_id: order.id, product_id: String(x.id).startsWith("demo-") ? null : x.id, product_name: x.name, quantity: x.qty, unit_price: x.price })));
      if (itemError) throw itemError;
      let receiptPath = null;
      if (isOnline) {
        const ext = (receipt.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        receiptPath = `${session.user.id}/${order.id}-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("payment-receipts").upload(receiptPath, receipt, { contentType: receipt.type || "image/jpeg", upsert: false });
        if (uploadError) throw uploadError;
      }
      const { error: paymentError } = await supabase.from("payments").insert({ order_id: order.id, method: form.payment, status: "pending", amount: total, provider: "manual_qr", receipt_path: receiptPath });
      if (paymentError) throw paymentError;
      clearCart(); nav(`/order-success/${order.id}`);
    } catch (err) { alert(err.message || "Could not place order. Please try again."); } finally { setLoading(false); }
  }
  return <section className="page-section narrow"><div className="page-title simple"><div><span className="eyebrow">CHECKOUT</span><h1>Let's get your coffee to you.</h1></div></div><form className="checkout-grid" onSubmit={placeOrder}><div className="form-panel"><h3>Delivery details</h3><Field label="Customer name" value={form.name} onChange={v => set("name", v)} required /><Field label="Mobile / CP number" value={form.mobile} onChange={v => set("mobile", v)} required /><Field label="Delivery address" value={form.address} onChange={v => set("address", v)} required /><div className="form-two"><Field label="Barangay" value={form.barangay} onChange={v => set("barangay", v)} required /><Field label="City" value={form.city} onChange={v => set("city", v)} required /></div><label className="field"><span>Order notes</span><textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Gate details, delivery notes, etc." /></label><h3 className="payment-heading">Payment method</h3><div className="payment-options">{[["cod", "Cash on Delivery", "Pay when your order arrives"], ["gcash", "GCash", "Scan the QR code, then upload your receipt"], ["maya", "Maya", "Scan the QR code, then upload your receipt"]].map(([v, t, s]) => <label className={form.payment === v ? "payment-option selected" : "payment-option"} key={v}><input type="radio" name="payment" value={v} checked={form.payment === v} onChange={e => { set("payment", e.target.value); setReceipt(null) }} /><span><b>{t}</b><small>{s}</small></span><CreditCard size={19} /></label>)}</div>{isOnline && <QrPayment method={form.payment} receipt={receipt} setReceipt={setReceipt} total={sub + fee} />}</div><aside className="summary"><h3>Order summary</h3>{cart.map(x => <div className="mini-line" key={x.id}><span>{x.qty} × {x.name}</span><b>{money(x.qty * x.price)}</b></div>)}<hr /><div><span>Subtotal</span><b>{money(sub)}</b></div><div><span>Delivery</span><b>{money(fee)}</b></div><div className="total"><span>Total</span><b>{money(sub + fee)}</b></div><button disabled={loading} className="btn btn-dark wide">{loading ? <Loader2 className="spin" /> : <>Place order <ArrowRight size={17} /></>}</button><p className="secure-note"><ShieldCheck size={15} /> Online payment is manually verified from the uploaded receipt.</p></aside></form></section>
}
function QrPayment({ method, receipt, setReceipt, total }) { const qr = method === "gcash" ? GCASH_QR_URL : MAYA_QR_URL; return <div className="qr-payment"><div className="qr-heading"><div><span className="eyebrow">PAYMENT INSTRUCTIONS</span><h4>{method.toUpperCase()} QR</h4></div><b>{money(total)}</b></div>{qr ? <img className="payment-qr" src={qr} alt={`${method} payment QR code`} /> : <div className="qr-missing"><AlertCircle size={17} /> Add VITE_{method.toUpperCase()}_QR_URL in .env.local to show your QR code.</div>}<ol><li>Open {method.toUpperCase()} on your phone.</li><li>Scan the Kai Phe Han QR code and pay exactly <b>{money(total)}</b>.</li><li>Save your successful transaction receipt.</li><li>Upload the receipt below for manual verification.</li></ol><label className="receipt-upload"><span>Payment receipt <b>*</b></span><input type="file" accept="image/*,application/pdf" onChange={e => setReceipt(e.target.files?.[0] || null)} required /><small>{receipt ? `Selected: ${receipt.name}` : "JPG, PNG or PDF · max 5MB"}</small></label></div> }

function Field({ label, value, onChange, required, type = "text" }) { return <label className="field"><span>{label}</span><input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} /></label> }

function Auth() {
  const { session } = useApp(); const nav = useNavigate(); const loc = useLocation(); const next = new URLSearchParams(loc.search).get("next") || "/"; const [mode, setMode] = useState("signin"); const [form, setForm] = useState({ name: "", email: "", password: "" }); const [loading, setLoading] = useState(false); const [message, setMessage] = useState("");
  if (session) return <Navigate to={next} />;
  async function submit(e) {
    e.preventDefault(); setLoading(true); setMessage(""); if (!supabase) { setMessage("Add Supabase environment variables first."); setLoading(false); return; } try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { full_name: form.name } }
        }); if (error) throw error; setMessage("Account created. Check your email if email confirmation is enabled."); setMode("signin");
      } else if (mode === "signin") { const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password }); if (error) throw error; nav(next); } else {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: form.name
            }
          }
        }); if (error) throw error; setMessage("Password reset instructions sent if the account exists.");
      }
    } catch (err) { setMessage(err.message || "Something went wrong."); } finally { setLoading(false); }
  }
  return <section className="auth-page"><div className="auth-card"><div className="auth-logo"><span className="brand-mark"><Coffee /></span><b>Kai Phe Han</b></div><span className="eyebrow">{mode === "signup" ? "JOIN THE TABLE" : "WELCOME BACK"}</span><h1>{mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Sign in to Kai Phe Han"}</h1><p className="muted">{mode === "signup" ? "Save your details, track orders, and make your next cup easier." : mode === "forgot" ? "We'll send a secure password reset link to your email." : "Your next order is only a few clicks away."}</p>{message && <div className="notice"><AlertCircle size={16} />{message}</div>}<form onSubmit={submit}>{mode === "signup" && <Field label="Full name" value={form.name} onChange={v => setForm({ ...form, name: v })} required />}<Field label="Email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} required />{mode !== "forgot" && <Field label="Password" type="password" value={form.password} onChange={v => setForm({ ...form, password: v })} required />}<button className="btn btn-dark wide" disabled={loading}>{loading ? <Loader2 className="spin" /> : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}</button></form><div className="auth-switch">{mode === "signin" && <button onClick={() => setMode("forgot")}>Forgot password?</button>}<button onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>{mode === "signup" ? "Already have an account? Sign in" : "Create a new account"}</button></div></div></section>
}

function Orders() {
  const { session } = useApp(); const [orders, setOrders] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const load = async () => {
    if (!supabase || !session?.user?.id) { setLoading(false); return; }
    setLoading(true); setError("");
    const { data, error } = await supabase.from("orders").select("*,order_items(*)").eq("user_id", session.user.id).order("created_at", { ascending: false });
    if (error) setError(error.message); else setOrders(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [session?.user?.id]);
  return <section className="page-section narrow"><div className="page-title simple"><div><span className="eyebrow">YOUR ORDERS</span><h1>Order history</h1></div></div>{loading ? <div className="empty-state"><Loader2 className="spin" size={28} /><h2>Loading your orders</h2><p>Please wait a moment.</p></div> : error ? <div className="empty-state"><AlertCircle size={28} /><h2>Couldn't load your orders</h2><p>{error}</p><button className="btn btn-dark" onClick={load}>Try again</button></div> : !orders.length ? <EmptyState title="No orders yet" text="Your first Kai Phe Han order will show up here." action={<Link className="btn btn-dark" to="/menu">Order coffee</Link>} /> : <div className="order-list">{orders.map(o => <OrderCard key={o.id} o={o} />)}</div>}</section>
}
function OrderCard({ o }) { return <article className="order-card"><div className="order-top"><div><span className="eyebrow">{o.order_number}</span><h3>{new Date(o.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</h3></div><Status status={o.status} /></div><div className="order-products">{o.order_items?.map(i => <div key={i.id}><span>{i.quantity} × {i.product_name}</span><b>{money(i.line_total)}</b></div>)}</div><div className="order-bottom"><span>Payment: {o.payment_method.toUpperCase()} · {o.payment_status}</span><strong>{money(o.total)}</strong></div></article> }
function Status({ status }) { return <span className={`status ${status}`}>{String(status).replaceAll("_", " ")}</span> }

function Account() {
  const { profile, session, refreshProfile } = useApp();
  const loc = useLocation();
  const navigate = useNavigate();
  const tab = new URLSearchParams(loc.search).get("tab") || "profile";
  const [form, setForm] = useState({ name: profile?.full_name || "", mobile: profile?.mobile || "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState({ next: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [notifications, setNotifications] = useState(() => localStorage.getItem("kai-phe-notifications") !== "off");

  useEffect(() => setForm({ name: profile?.full_name || "", mobile: profile?.mobile || "" }), [profile]);
  useEffect(() => { setMessage(""); setPassword({ next: "", confirm: "" }); }, [tab]);

  async function save(e) {
    e.preventDefault(); setSaving(true); setMessage("");
    if (!supabase) { setMessage("Supabase is not configured."); setSaving(false); return; }
    const { error } = await supabase.from("profiles").update({ full_name: form.name.trim(), mobile: form.mobile.trim(), updated_at: new Date().toISOString() }).eq("id", session.user.id);
    if (error) setMessage(error.message); else { await refreshProfile(); setMessage("Profile information saved."); }
    setSaving(false);
  }

  async function changePassword(e) {
    e.preventDefault(); setPasswordBusy(true); setMessage("");
    if (password.next.length < 8) { setMessage("Use a password with at least 8 characters."); setPasswordBusy(false); return; }
    if (password.next !== password.confirm) { setMessage("The passwords do not match."); setPasswordBusy(false); return; }
    const { error } = await supabase.auth.updateUser({ password: password.next });
    setMessage(error ? error.message : "Password updated successfully.");
    if (!error) setPassword({ next: "", confirm: "" });
    setPasswordBusy(false);
  }

  async function changeEmail() {
    setMessage("");
    const next = window.prompt("Enter your new email address:", session?.user?.email || "");
    if (!next || next === session?.user?.email) return;
    const { error } = await supabase.auth.updateUser({ email: next.trim() });
    setMessage(error ? error.message : "A confirmation email has been sent to your new address.");
  }

  function toggleNotifications() {
    const next = !notifications; setNotifications(next); localStorage.setItem("kai-phe-notifications", next ? "on" : "off");
    setMessage(next ? "Notifications preference enabled." : "Notifications preference disabled.");
  }

  async function signout() { await supabase.auth.signOut(); }
  const email = profile?.email || session?.user?.email || "";
  const joined = session?.user?.created_at ? new Date(session.user.created_at).toLocaleDateString("en-PH", { dateStyle: "medium" }) : "—";

  return <section className="page-section narrow">
    <div className="page-title simple"><div><span className="eyebrow">YOUR ACCOUNT</span><h1>Profile & settings</h1><p>Manage your personal information, account security, and preferences.</p></div></div>
    <div className="filter-row account-tabs">
      <button className={tab === "profile" ? "filter active" : "filter"} onClick={() => navigate("/account?tab=profile")}>Profile</button>
      <button className={tab === "information" ? "filter active" : "filter"} onClick={() => navigate("/account?tab=information")}>Account information</button>
      <button className={tab === "settings" ? "filter active" : "filter"} onClick={() => navigate("/account?tab=settings")}>Settings</button>
      <button className={tab === "orders" ? "filter active" : "filter"} onClick={() => navigate("/account?tab=orders")}>Orders</button>
    </div>
    {message && <div className="notice" role="status"><CheckCircle2 size={17} /> {message}</div>}

    {tab === "profile" && <div className="account-layout">
      <form className="form-panel" onSubmit={save}>
        <span className="eyebrow">PROFILE</span><h3>Personal details</h3><p className="muted">Keep your contact information up to date for orders and delivery.</p>
        <Field label="Full name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
        <Field label="Email" value={email} onChange={() => { }} />
        <Field label="Mobile number" value={form.mobile} onChange={v => setForm({ ...form, mobile: v })} />
        <button className="btn btn-dark" disabled={saving}>{saving ? <><Loader2 className="spin" /> Saving…</> : "Save changes"}</button>
      </form>
      <div className="account-links">
        <Link to="/orders"><Package /> Order history <ArrowRight /></Link>
        <Link to="/menu"><Coffee /> Browse menu <ArrowRight /></Link>
        <button onClick={signout}><LogOut /> Sign out <ArrowRight /></button>
      </div>
    </div>}

    {tab === "information" && <div className="account-layout">
      <div className="form-panel"><span className="eyebrow">ACCOUNT INFORMATION</span><h3>Your account</h3>
        <div className="account-info-list">
          <div><span>Email address</span><strong>{email || "Not available"}</strong></div>
          <div><span>Account ID</span><strong>{session?.user?.id || "—"}</strong></div>
          <div><span>Member since</span><strong>{joined}</strong></div>
          <div><span>Account role</span><strong>{profile?.role || "customer"}</strong></div>
          <div><span>Authentication</span><strong>Email & password</strong></div>
        </div>
      </div>
      <div className="form-panel"><span className="eyebrow">EMAIL</span><h3>Change email address</h3><p className="muted">We'll send a confirmation message before the new email becomes active.</p><button className="btn btn-outline" onClick={changeEmail}>Change email</button></div>
    </div>}

    {tab === "settings" && <div className="account-layout">
      <form className="form-panel" onSubmit={changePassword}><span className="eyebrow">SECURITY</span><h3>Password</h3><p className="muted">Choose a new password for your Kai Phe Han account.</p>
        <Field label="New password" type="password" value={password.next} onChange={v => setPassword({ ...password, next: v })} />
        <Field label="Confirm new password" type="password" value={password.confirm} onChange={v => setPassword({ ...password, confirm: v })} />
        <button className="btn btn-dark" disabled={passwordBusy}>{passwordBusy ? <><Loader2 className="spin" /> Updating…</> : "Update password"}</button>
      </form>
      <div className="form-panel"><span className="eyebrow">PREFERENCES</span><h3>Notifications</h3><p className="muted">Control whether Kai Phe Han remembers your notification preference on this device.</p>
        <button className="account-setting-row" onClick={toggleNotifications}><span><b>Order & account notifications</b><small>{notifications ? "Enabled" : "Disabled"}</small></span><span className={notifications ? "setting-toggle on" : "setting-toggle"}>{notifications ? "ON" : "OFF"}</span></button>
      </div>
    </div>}

    {tab === "orders" && <div className="account-layout"><div className="form-panel"><span className="eyebrow">ORDERS</span><h3>Your orders</h3><p className="muted">View your complete order history and payment status.</p><Link className="btn btn-dark" to="/orders">Open order history <ArrowRight size={17} /></Link></div></div>}
  </section>;
}

function OrderSuccess() { const { id } = useParams(); const [o, setO] = useState(null); useEffect(() => { if (supabase) supabase.from("orders").select("*").eq("id", id).single().then(({ data }) => setO(data)); }, [id]); return <section className="success-page"><div className="success-icon"><CheckCircle2 /></div><span className="eyebrow">ORDER CONFIRMED</span><h1>Thanks for choosing Kai Phe Han.</h1><p>Your order {o?.order_number || "is being prepared"} is now in our queue. We'll keep you updated as it moves.</p><div className="success-actions"><Link className="btn btn-dark" to="/orders">View order</Link><Link className="btn btn-outline" to="/menu">Order again</Link></div></section> }

function EmptyState({ title, text, action }) { return <div className="empty-state"><Coffee size={28} /><h2>{title}</h2><p>{text}</p>{action}</div> }

function Admin() {
  const loc = useLocation(), path = loc.pathname; const { profile } = useApp(); const [mobileNav, setMobileNav] = useState(false);
 const links = [
  ["/admin", "Overview", HomeIcon],
  ["/admin/orders", "Orders", ClipboardList],
  ["/admin/products", "Products", Boxes],
  ["/admin/sales", "Sales", BarChart3]
];
  const page = path === "/admin" ? "overview" : path.includes("/orders") ? "orders" : path.includes("/products") ? "products" : "sales";
  return <div className="admin-shell"><aside className={mobileNav ? "admin-sidebar open" : "admin-sidebar"}><div className="admin-brand"><span className="brand-mark"><Coffee /></span><div><b>Kai Phe Han</b><small>Admin</small></div></div><nav>{links.map(([to, label, Icon]) => <Link className={path === to ? "active" : ""} to={to} onClick={() => setMobileNav(false)} key={to}><Icon size={18} />{label}</Link>)}</nav><div className="admin-side-bottom"><span><User size={16} /> {profile?.full_name || "Admin"}</span><Link to="/"><ArrowRight /> Storefront</Link></div></aside><div className="admin-main"><header className="admin-header"><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? <X /> : <MenuIcon />}</button><div><span className="eyebrow">Kai Phe Han · ADMIN</span><h1>{page[0].toUpperCase() + page.slice(1)}</h1></div><Link to="/account" className="admin-avatar"><User /></Link></header>{page === "overview" && <AdminOverview />}{page === "orders" && <AdminOrders />}{page === "products" && <AdminProducts />}{page === "sales" && <AdminSales />}</div></div>
}

function useAdminOrders() { const [orders, setOrders] = useState([]), [loading, setLoading] = useState(true); const load = async () => { const { data } = await supabase.from("orders").select("*,order_items(*)").order("created_at", { ascending: false }); setOrders(data || []); setLoading(false) }; useEffect(() => { load() }, []); return { orders, loading, load } }
function AdminOverview() { const { orders, loading } = useAdminOrders(); const today = new Date().toDateString(); const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today); const gross = todayOrders.filter(o => o.status !== "cancelled").reduce((a, o) => a + Number(o.total), 0); return <div className="admin-content">{loading ? <FullLoader /> : <><div className="stat-grid"><Stat label="Today's gross income" value={money(gross)} /><Stat label="Today's sales" value={String(todayOrders.length)} /><Stat label="Pending orders" value={String(orders.filter(o => o.status === "pending").length)} /><Stat label="Completed" value={String(orders.filter(o => o.status === "completed").length)} /></div><div className="admin-panel"><div className="panel-head"><div><span className="eyebrow">LIVE QUEUE</span><h2>Recent orders</h2></div><Link to="/admin/orders" className="text-link">View all <ArrowRight size={15} /></Link></div><AdminOrderTable orders={orders.slice(0, 8)} compact /></div></>}</div> }
function Stat({ label, value }) { return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div> }
function AdminOrders() { const { orders, loading, load } = useAdminOrders(); return <div className="admin-content"><div className="admin-panel"><div className="panel-head"><div><span className="eyebrow">ORDER MANAGEMENT</span><h2>All orders</h2></div><button className="btn btn-small btn-outline" onClick={load}>Refresh</button></div>{loading ? <FullLoader /> : <AdminOrderTable orders={orders} />}</div></div> }
function AdminOrderTable({ orders, compact = false }) { const [updating, setUpdating] = useState(null); const statuses = ["pending", "confirmed", "preparing", "out_for_delivery", "completed", "cancelled"]; async function update(id, status) { setUpdating(id); await supabase.from("orders").update({ status, updated_at: new Date().toISOString(), payment_status: status === "completed" ? "paid" : undefined }).eq("id", id); if (status === "completed") { const { data: o } = await supabase.from("orders").select("total").eq("id", id).single(); if (o) await supabase.from("sales").upsert({ order_id: id, gross_income: o.total, sale_date: new Date().toISOString().slice(0, 10) }, { onConflict: "order_id" }); } setUpdating(null); window.location.reload(); } return <div className="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td><b>{o.order_number}</b><small>{new Date(o.created_at).toLocaleString("en-PH")}</small></td><td><b>{o.customer_name}</b><small>{o.mobile}</small><small>{o.address_line}, {o.barangay}, {o.city}</small></td><td>{o.order_items?.map(i => <div key={i.id}>{i.quantity} × {i.product_name}</div>)}</td><td><b>{money(o.total)}</b></td><td>{o.payment_method.toUpperCase()}<small>{o.payment_status}</small><ReceiptLink orderId={o.id} /></td><td><select disabled={updating === o.id} value={o.status} onChange={e => update(o.id, e.target.value)}>{statuses.map(s => <option key={s}>{s}</option>)}</select></td></tr>)}</tbody></table>{!orders.length && <EmptyState title="No orders" text="New customer orders will appear here." />}</div> }
function ReceiptLink({ orderId }) { const [url, setUrl] = useState(null); useEffect(() => { supabase.from("payments").select("receipt_path").eq("order_id", orderId).maybeSingle().then(async ({ data }) => { if (data?.receipt_path) { const { data: s } = await supabase.storage.from("payment-receipts").createSignedUrl(data.receipt_path, 300); if (s?.signedUrl) setUrl(s.signedUrl) } }) }, [orderId]); return url ? <a className="receipt-link" href={url} target="_blank" rel="noreferrer">View receipt</a> : null }
function AdminProducts() { const [products, setProducts] = useState([]), [cats, setCats] = useState([]), [editing, setEditing] = useState(null), [loading, setLoading] = useState(true); const load = async () => { const [{ data: p }, { data: c }] = await Promise.all([supabase.from("products").select("*,category:categories(*)").order("created_at", { ascending: false }), supabase.from("categories").select("*").order("sort_order")]); setProducts(p || []); setCats(c || []); setLoading(false) }; useEffect(() => load(), []); async function remove(id) { if (!confirm("Delete this product?")) return; await supabase.from("products").delete().eq("id", id); load() } return <div className="admin-content"><div className="panel-head admin-page-head"><div><span className="eyebrow">CATALOG</span><h2>Products</h2></div><button className="btn btn-dark" onClick={() => setEditing({ name: "", slug: "", description: "", price: 0, category_id: cats[0]?.id || "", is_available: true, is_featured: false, image_url: "" })}><Plus size={17} /> Add product</button></div>{editing && <ProductEditor product={editing} cats={cats} close={() => setEditing(null)} saved={() => { setEditing(null); load() }} />}{loading ? <FullLoader /> : <div className="admin-product-grid">{products.map(p => <div className="admin-product" key={p.id}><img src={imageFor(p)} alt="" /><div><span className="category-label">{p.category?.name}</span><h3>{p.name}</h3><b>{money(p.price)}</b><span className={p.is_available ? "availability on" : "availability"}>{p.is_available ? "Available" : "Hidden"}</span></div><div className="admin-product-actions"><button onClick={() => setEditing(p)}>Edit</button><button className="danger" onClick={() => remove(p.id)}>Delete</button></div></div>)}</div>}</div> }
function ProductEditor({ product, cats, close, saved }) { const [p, setP] = useState({ ...product }), [saving, setSaving] = useState(false); const set = (k, v) => setP({ ...p, [k]: v }); async function save(e) { e.preventDefault(); setSaving(true); const payload = { name: p.name, slug: p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), description: p.description, price: Number(p.price), category_id: p.category_id || null, is_available: p.is_available, is_featured: p.is_featured, image_url: p.image_url || null }; const r = p.id ? await supabase.from("products").update(payload).eq("id", p.id) : await supabase.from("products").insert(payload); if (r.error) alert(r.error.message); else saved(); setSaving(false) } return <div className="editor-panel"><div className="panel-head"><h3>{p.id ? "Edit product" : "New product"}</h3><button onClick={close}><X /></button></div><form onSubmit={save}><div className="form-two"><Field label="Name" value={p.name} onChange={v => set("name", v)} required /><Field label="Slug" value={p.slug} onChange={v => set("slug", v)} /></div><label className="field"><span>Description</span><textarea value={p.description} onChange={e => set("description", e.target.value)} /></label><div className="form-two"><Field label="Price" type="number" value={p.price} onChange={v => set("price", v)} required /><label className="field"><span>Category</span><select value={p.category_id || ""} onChange={e => set("category_id", e.target.value)}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><Field label="Product image URL (or upload to Storage and paste its public URL)" value={p.image_url || ""} onChange={v => set("image_url", v)} /><div className="check-row"><label><input type="checkbox" checked={p.is_available} onChange={e => set("is_available", e.target.checked)} /> Available</label><label><input type="checkbox" checked={p.is_featured} onChange={e => set("is_featured", e.target.checked)} /> Featured</label></div><div className="editor-actions"><button type="button" className="btn btn-outline" onClick={close}>Cancel</button><button className="btn btn-dark">{saving ? <Loader2 className="spin" /> : "Save product"}</button></div></form></div> }
function AdminSales() { const [range, setRange] = useState("month"), [orders, setOrders] = useState([]); useEffect(() => { supabase.from("orders").select("created_at,total,status").order("created_at").then(({ data }) => setOrders(data || [])) }, []); const now = new Date(); const filtered = orders.filter(o => { const d = new Date(o.created_at); if (o.status === "cancelled") return false; if (range === "today") return d.toDateString() === now.toDateString(); if (range === "week") { const w = new Date(now); w.setDate(now.getDate() - 6); return d >= w } if (range === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); if (range === "year") return d.getFullYear() === now.getFullYear(); return true }); const gross = filtered.reduce((a, o) => a + Number(o.total), 0); return <div className="admin-content"><div className="sales-controls"><div><span className="eyebrow">SALES</span><h2>Revenue overview</h2></div><select value={range} onChange={e => setRange(e.target.value)}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option></select></div><div className="stat-grid"><Stat label="Gross income" value={money(gross)} /><Stat label="Orders" value={filtered.length} /><Stat label="Average order" value={money(filtered.length ? gross / filtered.length : 0)} /></div><div className="admin-panel"><div className="panel-head"><div><span className="eyebrow">HISTORY</span><h2>Sales by day</h2></div></div><div className="sales-bars">{Object.entries(filtered.reduce((a, o) => { const d = new Date(o.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" }); a[d] = (a[d] || 0) + Number(o.total); return a }, {})).map(([d, v]) => <div className="bar-item" key={d}><div className="bar"><span style={{ height: `${Math.max(8, Math.min(100, v / (Math.max(...Object.values(filtered.reduce((a, o) => { const d = new Date(o.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" }); a[d] = (a[d] || 0) + Number(o.total); return a }, {}))) || 1) * 100))}%` }}></span></div><small>{d}</small><b>{money(v)}</b></div>)}</div>{!filtered.length && <EmptyState title="No sales in this period" text="Completed sales will appear here." />}</div></div> }
function NotFound() { return <EmptyState title="Page not found" text="Let's get you back to the counter." action={<Link className="btn btn-dark" to="/">Home</Link>} /> }

createRoot(document.getElementById("root")).render(<BrowserRouter><App /></BrowserRouter>);