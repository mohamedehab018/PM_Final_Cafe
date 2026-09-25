type Role = "CASHIER" | "KITCHEN" | "WAITER" | "MANAGER";
type Category = string;
type OrderStatus = "AWAITING_PAYMENT" | "PENDING_APPROVAL" | "APPROVED" | "PREPARING" | "READY" | "PICKED_UP" | "DELIVERED" | "COMPLETED" | "REJECTED" | "CANCELLED";
type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "PARTIALLY_PAID";
type TableStatus = "AVAILABLE" | "OCCUPIED" | "WAITING_FOOD" | "FOOD_READY" | "FINISHED" | "NEEDS_CLEANING" | "RESERVED";
type ReservationEventType = "BIRTHDAY" | "ENGAGEMENT" | "ANNIVERSARY" | "GRADUATION" | "PRIVATE_GATHERING" | "OTHER";
type ReservationStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
type OrderSource = "DINE_IN_QR" | "WEBSITE" | "TAKEAWAY";

interface MenuItem {
  id: string;
  /** Numeric Django primary key — needed for any write call to /api/menu/{apiId}/...
   * (id above is public_id, a slug used for display/cart identity, not the DB pk). */
  apiId: number;
  name: string;
  category: Category;
  description: string;
  price: number;
  image: string;
  availability: "AVAILABLE" | "UNAVAILABLE" | "SOLD_OUT";
  tags: string[];
  ingredients: string;
  options?: { name: string; price_delta: number; active: boolean }[];
  addons?: { name: string; price: number; active: boolean }[];
}

interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
  options: string[];
  notes: string;
}

interface Order {
  id: string;
  backendId?: number;
  tableId: string;
  source: OrderSource;
  items: CartItem[];
  customRequest: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  paidAmount: number;
  total?: number;
  createdAt: string;
  rejectionReason?: string;
  cashierNote?: string;
  kitchenNote?: string;
}

interface Table {
  id: string;
  label: string;
  seats: number;
  guests: number;
  status: TableStatus;
  token: string;
  area?: string;
  sessions?: { id: string; total: number; closedAt: string }[];
}

interface StaffMember {
  id: string;
  name: string;
  role: Role;
  salary: number;
  start: string;
  end: string;
  active: boolean;
  bonuses: number;
  deductions: number;
  note: string;
}

interface Notice {
  id: string;
  title: string;
  body: string;
  tone: "success" | "warning" | "info" | "danger";
  audience: "CUSTOMER" | "STAFF";
  orderId?: string;
  createdAt: string;
}

interface AppState {
  customerTableId: string | null;
  cart: CartItem[];
  orders: Order[];
  tables: Table[];
  notices: Notice[];
  availability: Record<string, MenuItem["availability"]>;
  staffRole: Role | null;
  notes: { id: string; text: string; author: string; audience: string; createdAt: string }[];
  staff: StaffMember[];
}

/* ── Backend record shapes (Part 3A) ──────────────────────────────────────────
 * These mirror the DRF serializers exactly (see backend/cafe/serializers.py)
 * for the endpoints MANAGER and KITCHEN now call directly — no local mock
 * data is used for these roles. */
interface ApiTable {
  id: number; number: string; seats: number; location: string;
  status: TableStatus; active: boolean; qr_token: string;
}
interface ApiOffer {
  id: number; name: string; description: string; active: boolean; is_permanent: boolean;
  priority: number; discount_percent: string | null; fixed_price: string | null;
  starts_at: string | null; ends_at: string | null; is_currently_active: boolean;
}
interface ApiAdjustment {
  id: number; kind: "BONUS" | "DEDUCT"; amount: string; reason: string; date: string;
  notes: string; created_at: string;
}
interface ApiAttendance {
  id: number; staff: number; staff_name: string; date: string;
  status: "PRESENT" | "ABSENT" | "LATE"; notes: string;
}
interface ApiStaffMember {
  id: number; username: string; email: string; full_name: string; role: Role;
  phone: string; salary: string; start_date: string | null; end_date: string | null;
  start_time: string | null; end_time: string | null; active: boolean; notes: string;
  adjustments: ApiAdjustment[]; attendance: ApiAttendance[];
  total_bonuses: string; total_deductions: string; net_salary: string;
}
interface ApiKitchenItem {
  id: number; menu_item: number; name_snapshot: string; quantity: number;
  options: string[]; notes: string;
}
interface ApiKitchenOrder {
  id: number; number: string; source: OrderSource; table_number: string | null;
  status: string; priority: number; custom_request: string; kitchen_note: string;
  created_at: string; items: ApiKitchenItem[];
}

/* ── Menu management (Part 3A / Manager) ──────────────────────────────────────
 * Mirrors CategorySerializer / MenuItemSerializer exactly (see
 * backend/cafe/serializers.py). Distinct from the customer-facing MenuItem
 * interface above, which is a display-only projection built by hydrateMenu(). */
interface ApiMgrCategory {
  id: number; name: string; slug: string; active: boolean; position: number; image: string;
}
interface ApiMgrOption { id: number; name: string; price_delta: string; active: boolean; }
interface ApiMgrAddOn { id: number; name: string; price: string; active: boolean; }

/* ── Manager Menu Builder: image cropper + draft state (Part 3B) ──────────────
 * A file selected in the item/category form never uploads directly — it opens
 * a canvas-based cropper first (drag/pan, zoom, rotate, reset, square/wide
 * crop). Because the cropper takes over the modal, the parent form's typed
 * values are captured into a "draft" and the parent modal is re-opened
 * pre-filled from that draft once the crop is confirmed or cancelled — no
 * quantity of clicking around loses the manager's typed name/price/etc. */
interface MenuItemDraftValues {
  name: string; category: number; price: string; description: string; ingredients: string;
  active: boolean; soldOut: boolean; meal: boolean; existingId?: number;
}
interface CategoryDraftValues {
  name: string; position: number; slug: string; active: boolean; existingId?: number;
}
type CropShape = "square" | "wide";
interface CropperState {
  target: "item" | "category";
  draft: MenuItemDraftValues | CategoryDraftValues;
  img: HTMLImageElement;
  objectUrl: string;
  naturalW: number; naturalH: number;
  zoom: number; rotation: number; offsetX: number; offsetY: number; baseScale: number;
  shape: CropShape; dragging: boolean; lastX: number; lastY: number;
}
const CROP_BOX: Record<CropShape, { w: number; h: number }> = {
  square: { w: 300, h: 300 },
  wide: { w: 340, h: 220 },
};
let cropper: CropperState | null = null;
let mgrEditingItemId: number | undefined;
let mgrEditingCategoryId: number | undefined;
let pendingItemImageBlob: Blob | null = null;
let pendingItemImagePreviewUrl: string | null = null;
let pendingCategoryImageBlob: Blob | null = null;
let pendingCategoryImagePreviewUrl: string | null = null;
interface ApiMgrMenuItem {
  id: number; public_id: string; category: number; category_name: string;
  name: string; description: string; ingredients: string; price: string;
  image: string; image_url: string; image_source: string;
  active: boolean; sold_out: boolean; is_complete_meal: boolean;
  options: ApiMgrOption[]; addons: ApiMgrAddOn[];
}

/* ── Analytics (Manager dashboard) ─────────────────────────────────────────── */
interface ApiAnalytics {
  // DRF renders Decimal aggregates as strings (and an empty Sum as the number 0),
  // so every money field is normalised with Number() before it is displayed.
  revenue: number | string; revenue_today: number | string; order_count: number; active_tables: number;
  best_sellers: { name_snapshot: string; qty: number }[];
  best_categories: { menu_item__category__name: string | null; qty: number }[];
  table_revenue: { order__session__table__number: string; revenue: number | string }[];
  hourly_distribution: { hour: number; count: number }[];
  orders_by_source: { source: string; count: number }[];
  staff_count: number;
}

/* ── Backend record shapes (Part 3B) ──────────────────────────────────────────
 * Cashier, Waiter, real order flow, payments, receipts, notifications & notes. */
interface ApiOrderItemFull {
  id: number; menu_item: number; name_snapshot: string; unit_price: string;
  quantity: number; options: string[]; notes: string; line_total: string;
}
interface ApiPayment {
  id: number; order: number; amount: string; method: "CASH" | "CARD" | "INSTAPAY" | "VODAFONE_CASH";
  status: "UNPAID" | "PENDING" | "PAID" | "PARTIALLY_PAID" | "FAILED";
  reference_id: string; payer_phone: string; payer_account: string; card_last4: string; created_at: string;
}
interface ApiOrderHistory {
  id: number; status: string; changed_by_username: string; note: string; created_at: string;
}
interface ApiOrderFull {
  id: number; number: string; branch: number; source: OrderSource; session: number | null;
  table_number: string | null; status: string; priority: number;
  custom_request: string; cashier_note: string; kitchen_note: string;
  rejection_reason: string; customer_token: string; created_at: string;
  items: ApiOrderItemFull[]; payments: ApiPayment[]; history: ApiOrderHistory[]; total: string;
}
interface ApiNotificationRecord {
  id: number; order: number | null; table: number | null; table_number: string | null;
  sender: number | null; sender_name: string; audience: string;
  recipient_roles: string[]; recipient_staff: number[]; recipient_staff_names: string[];
  title: string; body: string; read_at: string | null; created_at: string;
}
interface ApiStaffNoteRecord {
  id: number; order: number | null; item: number | null; table: number | null; table_number: string | null;
  author_name: string; audience: string; text: string; created_at: string;
}
interface CustomerSession {
  token: string;
  table: ApiTable;
}

/* ── Reservations (Cashier) ───────────────────────────────────────────────── */
interface ApiReservation {
  id: number; branch: number; customer_name: string; phone: string;
  event_type: ReservationEventType; date: string; start_time: string; end_time: string;
  duration_minutes: number; guests: number;
  tables: number[]; table_numbers: string[]; table_count: number;
  price: string; deposit_amount: string;
  payment_status: "UNPAID" | "DEPOSIT_PAID" | "PAID";
  decoration: string; notes: string; status: ReservationStatus;
  created_by: number | null; created_by_name: string; created_at: string; updated_at: string;
}

const money = (value: number): string => `${value.toFixed(0)} EGP`;
let categories: Category[] = [];
const orderStatuses: OrderStatus[] = ["AWAITING_PAYMENT", "APPROVED", "PREPARING", "READY", "PICKED_UP", "DELIVERED", "COMPLETED"];
const rejectionReasons = ["Sold out", "Not available", "Ingredient unavailable", "Cannot prepare", "Not on menu", "Not offered", "Kitchen issue", "Temporary unavailable", "Other"];

/* The menu is loaded from Django.  Keeping it empty until the API responds prevents
   old prototype names/prices/images from becoming a second source of truth. */
let menu: MenuItem[] = [];

const initialTables: Table[] = [
  { id: "01", label: "Table 01", seats: 4, guests: 0, status: "AVAILABLE", token: "pm-t01-7c2", area: "Terrace", sessions: [{ id: "S-101", total: 520, closedAt: "Mon" }] },
  { id: "02", label: "Table 02", seats: 2, guests: 2, status: "OCCUPIED", token: "pm-t02-9d1", area: "Window", sessions: [{ id: "S-102", total: 320, closedAt: "Tue" }, { id: "S-118", total: 415, closedAt: "Wed" }] },
  { id: "03", label: "Table 03", seats: 6, guests: 4, status: "FOOD_READY", token: "pm-t03-4e8", area: "Main hall", sessions: [{ id: "S-103", total: 680, closedAt: "Tue" }] },
  { id: "04", label: "Table 04", seats: 4, guests: 0, status: "NEEDS_CLEANING", token: "pm-t04-2a4", area: "Main hall", sessions: [{ id: "S-104", total: 290, closedAt: "Wed" }] },
  { id: "05", label: "Table 05", seats: 4, guests: 3, status: "WAITING_FOOD", token: "pm-t05-5f6", area: "Garden", sessions: [{ id: "S-105", total: 560, closedAt: "Thu" }] },
  { id: "06", label: "Table 06", seats: 2, guests: 0, status: "AVAILABLE", token: "pm-t06-8b0", area: "Window", sessions: [{ id: "S-106", total: 210, closedAt: "Thu" }] },
  { id: "07", label: "Table 07", seats: 4, guests: 2, status: "OCCUPIED", token: "cbbf9ba1-283d-4eb0-8ccd-a292a83026c3", area: "Terrace", sessions: [{ id: "S-107", total: 520, closedAt: "Mon" }, { id: "S-111", total: 780, closedAt: "Tue" }, { id: "S-115", total: 420, closedAt: "Wed" }] },
  { id: "08", label: "Table 08", seats: 6, guests: 0, status: "AVAILABLE", token: "pm-t08-3d7", area: "Garden", sessions: [{ id: "S-108", total: 610, closedAt: "Thu" }] },
  { id: "09", label: "Table 09", seats: 2, guests: 0, status: "AVAILABLE", token: "pm-t09-6f1", area: "Bar", sessions: [{ id: "S-109", total: 185, closedAt: "Fri" }] },
  { id: "10", label: "Table 10", seats: 8, guests: 5, status: "WAITING_FOOD", token: "pm-t10-8a9", area: "Private room", sessions: [{ id: "S-110", total: 1240, closedAt: "Fri" }] }
];

const seededOrders: Order[] = [
  {
    id: "1042",
    tableId: "07",
    source: "DINE_IN_QR",
    items: [{ id: "seed-1042", menuItemId: "iced-coffee", name: "Iced Coffee", image: "🧋", unitPrice: 120, quantity: 1, options: ["Extra sauce"], notes: "Less ice" }],
    customRequest: "",
    status: "PENDING_APPROVAL",
    paymentStatus: "UNPAID",
    paymentMethod: "",
    paidAmount: 0,
    createdAt: "Just now"
  },
  {
    id: "1041",
    tableId: "03",
    source: "DINE_IN_QR",
    items: [{ id: "seed-1041", menuItemId: "cheese-burger", name: "Cheese Burger", image: "🍔", unitPrice: 295, quantity: 2, options: ["Double", "Extra cheese"], notes: "" }, { id: "seed-1041b", menuItemId: "classic-fries", name: "Classic Fries", image: "🍟", unitPrice: 95, quantity: 1, options: [], notes: "" }],
    customRequest: "",
    status: "READY",
    paymentStatus: "PAID",
    paymentMethod: "Instapay",
    paidAmount: 685,
    createdAt: "12 min ago"
  },
  {
    id: "1040",
    tableId: "02",
    source: "DINE_IN_QR",
    items: [{ id: "seed-1040", menuItemId: "pepperoni", name: "Pepperoni", image: "🍕", unitPrice: 280, quantity: 2, options: ["Large"], notes: "" }],
    customRequest: "",
    status: "PREPARING",
    paymentStatus: "UNPAID",
    paymentMethod: "Cash",
    paidAmount: 0,
    createdAt: "18 min ago"
  },
  {
    id: "1039", tableId: "—", source: "WEBSITE",
    items: [{ id: "seed-1039", menuItemId: "chocolate-cake", name: "Chocolate Cake", image: "🍰", unitPrice: 155, quantity: 2, options: ["Extra cream"], notes: "Call on arrival" }],
    customRequest: "Add a birthday message if possible", status: "APPROVED", paymentStatus: "PAID", paymentMethod: "Card", paidAmount: 310, createdAt: "24 min ago"
  },
  {
    id: "1038", tableId: "—", source: "TAKEAWAY",
    items: [{ id: "seed-1038", menuItemId: "bbq-chicken", name: "BBQ Chicken", image: "🍕", unitPrice: 310, quantity: 1, options: ["Large size"], notes: "Slice into 8" }],
    customRequest: "", status: "PREPARING", paymentStatus: "PARTIALLY_PAID", paymentMethod: "Vodafone Cash", paidAmount: 150, createdAt: "31 min ago"
  }
];

const defaultState: AppState = {
  customerTableId: null,
  cart: [],
  orders: [],
  tables: initialTables.map((table) => ({ ...table, sessions: [...(table.sessions || [])] })),
  notices: [{ id: "welcome", title: "Welcome to PM", body: "Scan your table to start an order.", tone: "info", audience: "CUSTOMER", createdAt: "Now" }],
  availability: {},
  staffRole: null,
  notes: [{ id: "note-1", text: "Table 07 requested extra napkins.", author: "Floor team", audience: "Manager/Admin", createdAt: "Today, 6:02 PM" }],
  staff: []
};

let state: AppState = loadState();
let customerView: "menu" | "orders" | "bill" = state.customerTableId ? "menu" : "menu";
const CUSTOMER_CATEGORY_SCROLL_KEY = "pm-cafe-category-scroll-left";
const CUSTOMER_CATEGORY_KEY = "pm-cafe-selected-category";
let selectedCategory: Category = safeGetStorage(CUSTOMER_CATEGORY_KEY) || "Pizza";
let activeProduct: MenuItem | null = null;
let staffSection = "overview";
let cashierFilter = "ALL";
let kitchenSearch = "";

/* ============================================================================
 * PART 3A — AUTH (JWT) for real backend-connected roles (MANAGER, KITCHEN).
 * Cashier/Waiter/Customer keep the existing localStorage prototype (unchanged,
 * out of scope for this part). Manager and Kitchen now authenticate against
 * Django's /api/auth/token/ (SimpleJWT) and every one of their actions goes
 * through the real API instead of the local mock arrays.
 * ========================================================================= */

interface AuthSession {
  access: string;
  refresh: string;
  role: Role;
  username: string;
  staffId: number;
}

function apiBase(): string {
  return String((window as any).PM_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

function loadAuth(): AuthSession | null {
  const raw = safeGetStorage("pm-cafe-auth");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

let authSession: AuthSession | null = loadAuth();

function saveAuth(): void {
  if (authSession) safeSetStorage("pm-cafe-auth", JSON.stringify(authSession));
}

function clearAuth(): void {
  authSession = null;
  try { localStorage.removeItem("pm-cafe-auth"); } catch { /* storage unavailable */ }
}

/** Refreshes the JWT access token using the stored refresh token. Returns
 * false (and clears the session) if the refresh token itself is invalid or
 * has expired, which forces the user back to the login screen. */
async function refreshAccessToken(): Promise<boolean> {
  if (!authSession?.refresh) return false;
  try {
    const response = await fetch(`${apiBase()}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: authSession.refresh }),
    });
    if (!response.ok) { clearAuth(); return false; }
    const data = await response.json();
    authSession = { ...authSession, access: data.access };
    saveAuth();
    return true;
  } catch {
    return false;
  }
}

/** Every Manager/Kitchen API call goes through here so the Bearer token is
 * always attached and a single 401 (expired access token) triggers exactly
 * one silent refresh-and-retry before giving up. */
async function authFetch(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(options.headers || {});
  if (authSession?.access) headers.set("Authorization", `Bearer ${authSession.access}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${apiBase()}${path}`, { ...options, headers });
  if (response.status === 401 && retry && authSession?.refresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return authFetch(path, options, false);
  }
  return response;
}

/** POST username/password to SimpleJWT, then verify the account's real role
 * via /api/staff/me/ (never trust the role button the person clicked).
 * Returns an error message on failure, or null on success. */
async function loginWithBackend(username: string, password: string, expectedRole: Role): Promise<string | null> {
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(`${apiBase()}/api/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    return "Could not reach the server. Is Django running?";
  }
  if (!tokenResponse.ok) return "Incorrect username or password.";
  const tokens = await tokenResponse.json();
  authSession = { access: tokens.access, refresh: tokens.refresh, role: expectedRole, username, staffId: 0 };
  saveAuth();
  const meResponse = await authFetch("/api/staff/me/");
  if (!meResponse.ok) { clearAuth(); return "This account has no staff profile."; }
  const profile = await meResponse.json();
  if (profile.role !== expectedRole) {
    clearAuth();
    return `This account is registered as ${formatStatus(profile.role)}, not ${formatStatus(expectedRole)}.`;
  }
  if (!profile.active) { clearAuth(); return "This staff account has been deactivated."; }
  authSession = { ...authSession, role: profile.role, staffId: profile.id };
  saveAuth();
  return null;
}

/* ── Manager live data (Part 3A) ──────────────────────────────────────────
 * null = not loaded yet (shows a loading state); [] = loaded and empty. */
let mgrTables: ApiTable[] | null = null;
let mgrOffers: ApiOffer[] | null = null;
let mgrStaff: ApiStaffMember[] | null = null;
let mgrAttendance: ApiAttendance[] | null = null;
let mgrAttendanceDate: string = new Date().toISOString().slice(0, 10);
let mgrCategories: ApiMgrCategory[] | null = null;
let mgrMenuItems: ApiMgrMenuItem[] | null = null;
let mgrAnalytics: ApiAnalytics | null = null;
let mgrError = "";
// Part 3A menu management + analytics UI state (server data stays the source of truth;
// these only remember which filter/search the Manager is looking at and whether a
// request is already in flight, so render() cannot start duplicate or endless loads).
let mgrMenuFilter: number | "ALL" = "ALL";
let mgrMenuSearch = "";
let mgrMenuLoading = false;
let mgrAnalyticsLoading = false;
let mgrAnalyticsTried = false;
let mgrAnalyticsError = "";

function resetManagerCaches(): void {
  mgrTables = null; mgrOffers = null; mgrStaff = null; mgrAttendance = null;
  mgrCategories = null; mgrMenuItems = null; mgrAnalytics = null; mgrError = "";
  mgrMenuFilter = "ALL"; mgrMenuSearch = ""; mgrMenuLoading = false;
  mgrAnalyticsLoading = false; mgrAnalyticsTried = false; mgrAnalyticsError = "";
}

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authFetch(path, options);
  if (response.status === 401 || response.status === 403) {
    clearAuth();
    state.staffRole = null;
    saveState();
    render();
    showToast("Session expired", "Please sign in again.", "warning");
    throw new Error("Not authorized");
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status}).`;
    try { const body = await response.json(); detail = body.detail || Object.values(body).flat().join(" ") || detail; } catch { /* non-JSON error body */ }
    throw new Error(detail);
  }
  if (response.status === 204) return undefined as unknown as T;
  return response.json();
}

async function loadManagerTables(): Promise<void> {
  try { mgrTables = await apiJson<ApiTable[]>("/api/tables/"); }
  catch (error) { mgrError = error instanceof Error ? error.message : "Could not load tables."; mgrTables = []; }
  render();
}

async function loadManagerOffers(): Promise<void> {
  try { mgrOffers = await apiJson<ApiOffer[]>("/api/offers/"); }
  catch (error) { mgrError = error instanceof Error ? error.message : "Could not load offers."; mgrOffers = []; }
  render();
}

async function loadManagerStaff(): Promise<void> {
  try { mgrStaff = await apiJson<ApiStaffMember[]>("/api/staff/"); }
  catch (error) { mgrError = error instanceof Error ? error.message : "Could not load employees."; mgrStaff = []; }
  render();
}

async function loadManagerAttendance(): Promise<void> {
  try {
    if (!mgrStaff) await loadManagerStaff();
    mgrAttendance = await apiJson<ApiAttendance[]>(`/api/attendance/?date=${mgrAttendanceDate}`);
  } catch (error) { mgrError = error instanceof Error ? error.message : "Could not load attendance."; mgrAttendance = []; }
  render();
}

async function loadManagerCategories(): Promise<void> {
  try { mgrCategories = await apiJson<ApiMgrCategory[]>("/api/categories/"); }
  catch (error) { mgrError = error instanceof Error ? error.message : "Could not load categories."; mgrCategories = []; }
  render();
}

async function loadManagerMenuItems(): Promise<void> {
  try { mgrMenuItems = await apiJson<ApiMgrMenuItem[]>("/api/menu/"); }
  catch (error) { mgrError = error instanceof Error ? error.message : "Could not load menu items."; mgrMenuItems = []; }
  render();
}

/** Menu Management needs both lists at once (item rows show + edit against
 * the category list), so this loads them together the same way loadManagerAttendance
 * loads mgrStaff first. */
async function loadManagerMenu(): Promise<void> {
  if (mgrMenuLoading) return;
  mgrMenuLoading = true;
  try {
    await Promise.all([
      mgrCategories === null ? loadManagerCategories() : Promise.resolve(),
      mgrMenuItems === null ? loadManagerMenuItems() : Promise.resolve(),
    ]);
  } finally { mgrMenuLoading = false; }
}

/** Re-read both lists from Django after any category/item write, then quietly refresh
 * the customer-facing menu so a shared browser shows the change immediately. */
async function refreshManagerMenu(): Promise<void> {
  mgrMenuLoading = true;
  try { await Promise.all([loadManagerCategories(), loadManagerMenuItems()]); }
  finally { mgrMenuLoading = false; }
  hydrateMenu().catch(() => { /* customer menu refresh is best-effort */ });
}

async function loadManagerAnalytics(): Promise<void> {
  if (mgrAnalyticsLoading) return;
  mgrAnalyticsLoading = true;
  mgrAnalyticsError = "";
  try { mgrAnalytics = await apiJson<ApiAnalytics>("/api/analytics/"); }
  catch (error) { mgrAnalyticsError = error instanceof Error ? error.message : "Could not load analytics."; }
  mgrAnalyticsLoading = false;
  // Marked as tried even on failure, so a failing endpoint shows a Retry button
  // instead of render() re-requesting it forever.
  mgrAnalyticsTried = true;
  render();
}

/* ── Kitchen live data (Part 3A) ─────────────────────────────────────────── */
let kitchenOrders: ApiKitchenOrder[] = [];
let kitchenError = "";
let kitchenLoaded = false;
let kitchenPollTimer: number | null = null;

async function loadKitchenOrders(): Promise<void> {
  try {
    kitchenOrders = await apiJson<ApiKitchenOrder[]>("/api/orders/?ordering=priority,created_at");
    kitchenError = "";
  } catch (error) {
    kitchenError = error instanceof Error ? error.message : "Could not load the kitchen queue.";
  }
  kitchenLoaded = true;
  render();
}

function startKitchenPolling(): void {
  if (kitchenPollTimer !== null) return;
  kitchenPollTimer = window.setInterval(() => {
    if (state.staffRole === "KITCHEN") loadKitchenOrders();
    else stopKitchenPolling();
  }, 8000);
}

function stopKitchenPolling(): void {
  if (kitchenPollTimer !== null) { window.clearInterval(kitchenPollTimer); kitchenPollTimer = null; }
}

/* ============================================================================
 * PART 3B — CASHIER + WAITER + ORDER FLOW + PAYMENT + RECEIPT + NOTIFICATIONS
 * Cashier and Waiter now authenticate against the same JWT backend as
 * Manager/Kitchen (see loginWithBackend above, now used for all 4 roles) and
 * read/write the real Order/Payment/Notification/StaffNote API — nothing in
 * this section touches state.orders / state.tables / state.notes / state.staff
 * (the old localStorage mock arrays).
 * ========================================================================= */

/* ── Shared staff order board (Cashier + Waiter) ─────────────────────────── */
let stfOrders: ApiOrderFull[] = [];
let stfOrdersLoaded = false;
let stfError = "";
let stfPollTimer: number | null = null;

async function loadStaffOrders(): Promise<void> {
  try {
    stfOrders = await apiJson<ApiOrderFull[]>("/api/orders/?ordering=priority,created_at");
    stfError = "";
  } catch (error) {
    stfError = error instanceof Error ? error.message : "Could not load orders.";
  }
  stfOrdersLoaded = true;
  render();
}

function startStaffPolling(): void {
  if (stfPollTimer !== null) return;
  stfPollTimer = window.setInterval(() => {
    if (state.staffRole === "CASHIER" || state.staffRole === "WAITER") {
      loadStaffOrders();
      // Keep the floor plan synced too, so a table another waiter/cashier
      // just seated, cleaned, or reserved shows up here without a manual tab switch.
      if (stfTables !== null) loadStaffTables();
    } else stopStaffPolling();
  }, 8000);
}

function stopStaffPolling(): void {
  if (stfPollTimer !== null) { window.clearInterval(stfPollTimer); stfPollTimer = null; }
}

/* ── Tables (Cashier: read-only view; Waiter: view + update status/cleaning) ─ */
let stfTables: ApiTable[] | null = null;

async function loadStaffTables(): Promise<void> {
  try { stfTables = await apiJson<ApiTable[]>("/api/tables/"); }
  catch (error) { stfError = error instanceof Error ? error.message : "Could not load tables."; stfTables = []; }
  render();
}

/* ── Reservations (Cashier + Manager) — real /api/reservations/ endpoint ─── */
let cashReservations: ApiReservation[] = [];
let cashReservationsLoaded = false;
let reservationError = "";
let reservationFilter = "ALL";
const reservationEventTypes: { value: ReservationEventType; label: string }[] = [
  { value: "BIRTHDAY", label: "Birthday" },
  { value: "ENGAGEMENT", label: "Engagement" },
  { value: "ANNIVERSARY", label: "Anniversary" },
  { value: "GRADUATION", label: "Graduation" },
  { value: "PRIVATE_GATHERING", label: "Private Gathering" },
  { value: "OTHER", label: "Other" },
];

async function loadReservations(): Promise<void> {
  try {
    cashReservations = await apiJson<ApiReservation[]>("/api/reservations/");
    reservationError = "";
  } catch (error) {
    reservationError = error instanceof Error ? error.message : "Could not load reservations.";
  }
  cashReservationsLoaded = true;
  render();
}

function reservationTablesAvailableFor(dateValue: string, startTime: string, durationMinutes: number, excludeReservationId?: number): ApiTable[] {
  const tables = stfTables || [];
  if (!dateValue || !startTime) return tables.filter((t) => t.active);
  const start = new Date(`${dateValue}T${startTime}`).getTime();
  const end = start + durationMinutes * 60000;
  const blockedTableIds = new Set<number>();
  cashReservations
    .filter((r) => r.date === dateValue && (r.status === "PENDING" || r.status === "CONFIRMED") && r.id !== excludeReservationId)
    .forEach((r) => {
      const rStart = new Date(`${r.date}T${r.start_time}`).getTime();
      const rEnd = rStart + r.duration_minutes * 60000;
      if (start < rEnd && rStart < end) r.tables.forEach((id) => blockedTableIds.add(id));
    });
  return tables.filter((t) => t.active && !blockedTableIds.has(t.id));
}

function reservationFormValues(): Record<string, unknown> | null {
  const customerName = (document.getElementById("res-name") as HTMLInputElement)?.value.trim();
  const phone = (document.getElementById("res-phone") as HTMLInputElement)?.value.trim();
  const eventType = (document.getElementById("res-event-type") as HTMLSelectElement)?.value || "OTHER";
  const date = (document.getElementById("res-date") as HTMLInputElement)?.value;
  const startTime = (document.getElementById("res-time") as HTMLInputElement)?.value;
  const duration = Number((document.getElementById("res-duration") as HTMLInputElement)?.value || 120);
  const guests = Number((document.getElementById("res-guests") as HTMLInputElement)?.value || 1);
  const price = (document.getElementById("res-price") as HTMLInputElement)?.value || "0";
  const deposit = (document.getElementById("res-deposit") as HTMLInputElement)?.value || "0";
  const paymentStatus = (document.getElementById("res-payment-status") as HTMLSelectElement)?.value || "UNPAID";
  const decoration = (document.getElementById("res-decoration") as HTMLInputElement)?.value.trim() || "";
  const notes = (document.getElementById("res-notes") as HTMLTextAreaElement)?.value.trim() || "";
  const tables = Array.from(document.querySelectorAll<HTMLInputElement>("input[name='res-table']:checked")).map((box) => Number(box.value));
  if (!customerName || !phone || !date || !startTime) {
    showToast("Missing details", "Customer name, phone, date and start time are required.", "warning");
    return null;
  }
  if (!tables.length) {
    showToast("Select at least one table", "Choose which table(s) to hold for this reservation.", "warning");
    return null;
  }
  return {
    customer_name: customerName, phone, event_type: eventType, date, start_time: startTime,
    duration_minutes: duration, guests, tables, price, deposit_amount: deposit,
    payment_status: paymentStatus, decoration, notes,
  };
}

function refreshReservationFormFields(): void {
  const modal = document.getElementById("reservation-form-modal");
  if (!modal) return;
  const date = (document.getElementById("res-date") as HTMLInputElement)?.value;
  const startTime = (document.getElementById("res-time") as HTMLInputElement)?.value;
  const duration = Number((document.getElementById("res-duration") as HTMLInputElement)?.value || 120);
  const editingId = Number(modal.dataset.editingId || "0") || undefined;
  const grid = document.getElementById("res-table-grid");
  const checkedBefore = Array.from(document.querySelectorAll<HTMLInputElement>("input[name='res-table']:checked")).map((b) => Number(b.value));
  if (grid) grid.innerHTML = reservationTableCheckboxes(date, startTime, duration, editingId, checkedBefore);
  const price = Number((document.getElementById("res-price") as HTMLInputElement)?.value || 0);
  const deposit = Number((document.getElementById("res-deposit") as HTMLInputElement)?.value || 0);
  const totalPreview = document.getElementById("res-total-preview");
  if (totalPreview) totalPreview.textContent = `${money(price)} · Deposit ${money(deposit)} · Balance ${money(Math.max(0, price - deposit))}`;
}

function reservationTableCheckboxes(dateValue: string, startTime: string, duration: number, excludeReservationId: number | undefined, checkedIds: number[] = []): string {
  const available = reservationTablesAvailableFor(dateValue, startTime, duration, excludeReservationId);
  const allTables = stfTables || [];
  if (!allTables.length) return `<p class="column-empty">${stfTables === null ? "Loading tables…" : "No tables found."}</p>`;
  const availableIds = new Set(available.map((t) => t.id));
  return allTables.map((t) => {
    const blocked = !availableIds.has(t.id) && !checkedIds.includes(t.id);
    return `<label class="check-option ${blocked ? "disabled" : ""}"><input type="checkbox" name="res-table" value="${t.id}" ${checkedIds.includes(t.id) ? "checked" : ""} ${blocked ? "disabled" : ""} /><span>Table ${escapeHtml(t.number)} · ${t.seats} seats${blocked ? " (unavailable)" : ""}</span></label>`;
  }).join("");
}

function reservationFormModal(existing?: ApiReservation): void {
  const today = new Date().toISOString().slice(0, 10);
  const date = existing?.date || today;
  const startTime = existing?.start_time?.slice(0, 5) || "19:00";
  const duration = existing?.duration_minutes ?? 120;
  showModal(`<div class="modal-card note-modal reservation-modal" id="reservation-form-modal" data-editing-id="${existing?.id || ""}">
    <div class="modal-header"><div><span class="eyebrow">Cashier · Reservations</span><h2>${existing ? "Edit reservation" : "New reservation"}</h2><p>Book tables for a birthday, engagement, anniversary, graduation, private gathering or other event.</p></div><button class="close-button" data-action="close-modal">×</button></div>
    <input id="res-name" placeholder="Customer name" value="${escapeHtml(existing?.customer_name || "")}" />
    <input id="res-phone" placeholder="Phone number" value="${escapeHtml(existing?.phone || "")}" />
    <select id="res-event-type">${reservationEventTypes.map((e) => `<option value="${e.value}" ${existing?.event_type === e.value ? "selected" : ""}>${e.label}</option>`).join("")}</select>
    <div class="form-row">
      <input id="res-date" type="date" value="${date}" />
      <input id="res-time" type="time" value="${startTime}" />
    </div>
    <div class="form-row">
      <label class="field-label">Duration (minutes)<input id="res-duration" type="number" min="30" step="30" value="${duration}" /></label>
      <label class="field-label">Guests<input id="res-guests" type="number" min="1" value="${existing?.guests ?? 2}" /></label>
    </div>
    <span class="eyebrow">Select tables</span>
    <div id="res-table-grid" class="notification-recipient-grid">${reservationTableCheckboxes(date, startTime, duration, existing?.id, existing?.tables || [])}</div>
    <div class="form-row">
      <label class="field-label">Reservation price (EGP)<input id="res-price" type="number" min="0" step="1" value="${existing?.price ?? "0"}" /></label>
      <label class="field-label">Deposit paid (EGP)<input id="res-deposit" type="number" min="0" step="1" value="${existing?.deposit_amount ?? "0"}" /></label>
    </div>
    <select id="res-payment-status">
      <option value="UNPAID" ${existing?.payment_status === "UNPAID" ? "selected" : ""}>Unpaid</option>
      <option value="DEPOSIT_PAID" ${existing?.payment_status === "DEPOSIT_PAID" ? "selected" : ""}>Deposit paid</option>
      <option value="PAID" ${existing?.payment_status === "PAID" ? "selected" : ""}>Fully paid</option>
    </select>
    <input id="res-decoration" placeholder="Decoration / design choice (e.g. Balloons & gold theme)" value="${escapeHtml(existing?.decoration || "")}" />
    <textarea id="res-notes" placeholder="Customer notes">${escapeHtml(existing?.notes || "")}</textarea>
    <div class="totals-box"><span>Total price before confirmation</span><strong id="res-total-preview">${money(Number(existing?.price ?? 0))} · Deposit ${money(Number(existing?.deposit_amount ?? 0))} · Balance ${money(Math.max(0, Number(existing?.price ?? 0) - Number(existing?.deposit_amount ?? 0)))}</strong></div>
    <button class="primary-button wide" data-action="save-reservation" data-reservation="${existing?.id || ""}">${existing ? "Save changes" : "Create reservation (Pending)"}</button>
  </div>`);
}

async function saveReservation(existingId?: number): Promise<void> {
  const payload = reservationFormValues();
  if (!payload) return;
  try {
    if (existingId) {
      await apiJson(`/api/reservations/${existingId}/`, { method: "PATCH", body: JSON.stringify(payload) });
      showToast("Reservation updated", "Changes saved.", "success");
    } else {
      await apiJson("/api/reservations/", { method: "POST", body: JSON.stringify(payload) });
      showToast("Reservation created", "Saved as Pending — confirm it once payment/details are set.", "success");
    }
    closeModal();
    await loadReservations();
  } catch (error) {
    showToast("Could not save reservation", error instanceof Error ? error.message : "Check the details and try again.", "danger");
  }
}

async function reservationTransition(id: number, path: "confirm" | "cancel" | "complete"): Promise<void> {
  try {
    await apiJson(`/api/reservations/${id}/${path}/`, { method: "POST" });
    const label = path === "confirm" ? "confirmed" : path === "cancel" ? "cancelled" : "completed";
    showToast(`Reservation ${label}`, path === "confirm" ? "Tables are now held as Reserved." : "Tables have been released back to Available.", "success");
    await loadReservations();
    if (stfTables !== null) loadStaffTables();
  } catch (error) {
    showToast("Action failed", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

/* ── Notifications (all 4 staff roles) ───────────────────────────────────── */
let stfNotifications: ApiNotificationRecord[] | null = null;

async function loadNotifications(): Promise<void> {
  try { stfNotifications = await apiJson<ApiNotificationRecord[]>("/api/notifications/"); }
  catch { stfNotifications = []; }
  render();
}

async function markNotificationRead(id: number): Promise<void> {
  try { await apiJson(`/api/notifications/${id}/mark_read/`, { method: "POST" }); } catch { /* best effort */ }
  await openStaffNotifications();
}

async function sendNotification(): Promise<void> {
  const title = (document.getElementById("notif-title") as HTMLInputElement)?.value.trim();
  const body = (document.getElementById("notif-body") as HTMLTextAreaElement)?.value.trim();
  const roles = Array.from(document.querySelectorAll<HTMLInputElement>("input[name='notif-role']:checked")).map((box) => box.value);
  if (!title || !body) { showToast("Add a title and message", "Both fields are required.", "warning"); return; }
  if (!roles.length) { showToast("Choose a recipient", "Pick at least one role or Customer.", "warning"); return; }
  const orderField = (document.getElementById("notif-order") as HTMLInputElement)?.value.trim();
  const payload: Record<string, unknown> = {
    title, body,
    audience: roles.includes("CUSTOMER") && roles.length === 1 ? "CUSTOMER" : roles[0],
    recipient_roles: roles,
  };
  if (orderField) payload.order = Number(orderField);
  try {
    await apiJson("/api/notifications/", { method: "POST", body: JSON.stringify(payload) });
    closeModal();
    showToast("Notification sent", `Delivered to ${roles.map(formatStatus).join(", ")}.`, "success");
    loadNotifications();
  } catch (error) {
    showToast("Could not send notification", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

function notificationModal(): string {
  const notifications = stfNotifications || [];
  return `<div class="modal-card notification-modal"><div class="modal-header"><div><span class="eyebrow">Live activity · API</span><h2>Notifications</h2></div><button class="close-button" data-action="close-modal">×</button></div><div class="notification-list">${notifications.length ? notifications.map((notice) => `<div class="notification-row ${notice.read_at ? "" : "unread"}"><span>${notice.read_at ? "✓" : "✦"}</span><div><strong>${escapeHtml(notice.title)}</strong><p>${escapeHtml(notice.body)}</p><small>${notice.table_number ? `Table ${escapeHtml(notice.table_number)} · ` : ""}${new Date(notice.created_at).toLocaleString()}${!notice.read_at ? ` · <button class="link-button" data-action="mark-notification" data-notification="${notice.id}">Mark read</button>` : ""}</small></div></div>`).join("") : `<div class="column-empty">No notifications yet.</div>`}</div><div class="review-actions"><button class="primary-button wide" data-action="new-notification">Send notification</button></div></div>`;
}

async function openStaffNotifications(): Promise<void> {
  try {
    await loadNotifications();
    showModal(notificationModal());
  } catch (error) {
    showToast("Could not load notifications", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

function notificationComposeModal(): void {
  showModal(`<div class="modal-card note-modal notification-compose-modal"><div class="modal-header"><div><span class="eyebrow">Staff communication</span><h2>Send notification</h2><p>Choose one or more recipients. Customer notifications must include an order number.</p></div><button class="close-button" data-action="close-modal">×</button></div><input id="notif-title" placeholder="Title" /><textarea id="notif-body" placeholder="Message"></textarea><div class="notification-recipient-grid">${["CASHIER", "KITCHEN", "WAITER", "MANAGER", "CUSTOMER"].map((role) => `<label class="check-option"><input type="checkbox" name="notif-role" value="${role}" /><span>${formatStatus(role)}</span></label>`).join("")}</div><input id="notif-order" type="number" min="1" placeholder="Order number (required for Customer)" /><button class="primary-button wide" data-action="send-notification">Send notification</button></div>`);
}

/* ── Staff notes (all 4 staff roles) ─────────────────────────────────────── */
let stfNotes: ApiStaffNoteRecord[] | null = null;

async function loadStaffNotes(): Promise<void> {
  try { stfNotes = await apiJson<ApiStaffNoteRecord[]>("/api/notes/"); }
  catch (error) { stfError = error instanceof Error ? error.message : "Could not load notes."; stfNotes = []; }
  render();
}

async function saveRealNote(): Promise<void> {
  const text = (document.getElementById("new-note") as HTMLTextAreaElement)?.value.trim();
  const audience = (document.getElementById("note-audience") as HTMLSelectElement)?.value || "MANAGER";
  const orderField = (document.getElementById("note-order") as HTMLInputElement)?.value.trim();
  if (!text) { showToast("Write a note first", "The note text is required.", "warning"); return; }
  const payload: Record<string, unknown> = { text, audience };
  if (orderField) payload.order = Number(orderField);
  try {
    await apiJson("/api/notes/", { method: "POST", body: JSON.stringify(payload) });
    closeModal();
    showToast("Note shared", `Visible to ${formatStatus(audience)}.`, "success");
    loadStaffNotes();
  } catch (error) {
    showToast("Could not save note", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

/* ── Order actions (Cashier: approve/reject/payment/complete; Waiter: pickup/deliver) */
async function orderTransition(orderId: number, path: string, body?: Record<string, unknown>): Promise<ApiOrderFull | null> {
  try {
    const result = await apiJson<ApiOrderFull>(`/api/orders/${orderId}/${path}/`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
    await loadStaffOrders();
    return result;
  } catch (error) {
    showToast("Action failed", error instanceof Error ? error.message : "Try again.", "danger");
    return null;
  }
}

async function approveOrder(orderId: number): Promise<void> {
  const result = await orderTransition(orderId, "approve");
  if (result) showToast("Order approved", `Order ${result.number} can proceed to payment.`, "success");
}

async function confirmRejectOrder(orderId: number): Promise<void> {
  const reason = (document.querySelector("input[name='reject-reason']:checked") as HTMLInputElement)?.value || "Other";
  const note = (document.getElementById("rejection-note") as HTMLTextAreaElement)?.value || "";
  const result = await orderTransition(orderId, "reject", { reason, note });
  if (result) { closeModal(); showToast("Order rejected", `Reason: ${reason}.`, "info"); }
}

async function pickupOrder(orderId: number): Promise<void> {
  const result = await orderTransition(orderId, "pickup");
  if (result) showToast("Order picked up", `Order ${result.number} claimed — deliver it to the table.`, "success");
}

async function deliverOrder(orderId: number): Promise<void> {
  const result = await orderTransition(orderId, "deliver");
  if (result) showToast("Order delivered", `Order ${result.number} was served.`, "success");
}

async function completeOrder(orderId: number): Promise<void> {
  const result = await orderTransition(orderId, "complete");
  if (result) { closeModal(); showToast("Order completed", `Order ${result.number} is closed.`, "success"); }
}

/* ── Payments (Cashier) ───────────────────────────────────────────────────── */
async function recordPayment(orderId: number): Promise<void> {
  const method = (document.querySelector(".method-choice.active") as HTMLElement)?.dataset.paymentMethod || "CASH";
  const amountField = (document.getElementById("payment-amount") as HTMLInputElement)?.value;
  const order = stfOrders.find((candidate) => candidate.id === orderId);
  if (!order) return;
  const paid = order.payments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const remaining = Math.max(0, Number(order.total) - paid);
  const amount = amountField ? Number(amountField) : remaining;
  if (!amount || amount <= 0) { showToast("Enter a valid amount", "The payment amount must be greater than zero.", "warning"); return; }
  const payload: Record<string, unknown> = { order: orderId, amount, method };
  if (method === "INSTAPAY") {
    payload.payer_phone = (document.getElementById("payer-phone-instapay") as HTMLInputElement)?.value.trim() || "";
    payload.payer_account = (document.getElementById("payer-account") as HTMLInputElement)?.value.trim() || "";
    if (!payload.payer_phone || !payload.payer_account) { showToast("Missing InstaPay details", "Payer phone and account number are required.", "warning"); return; }
  } else if (method === "VODAFONE_CASH") {
    payload.payer_phone = (document.getElementById("payer-phone-vodafone") as HTMLInputElement)?.value.trim() || "";
    if (!payload.payer_phone) { showToast("Missing phone number", "Vodafone Cash requires the payer's phone number.", "warning"); return; }
  } else if (method === "CARD") {
    const last4 = (document.getElementById("card-last4") as HTMLInputElement)?.value.trim() || "";
    if (last4 && (!/^\d{4}$/.test(last4))) { showToast("Invalid card details", "Enter the last 4 digits only.", "warning"); return; }
    if (last4) payload.card_last4 = last4;
  }
  try {
    await apiJson("/api/payments/", { method: "POST", body: JSON.stringify(payload) });
    showToast("Payment recorded", `${money(amount)} via ${formatStatus(method)}.`, "success");
    await loadStaffOrders();
    const refreshed = stfOrders.find((candidate) => candidate.id === orderId);
    if (refreshed) showModal(orderDetailModal(refreshed));
  } catch (error) {
    showToast("Could not record payment", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

function orderPaymentStatus(order: ApiOrderFull): "PAID" | "PARTIALLY_PAID" | "UNPAID" {
  const paid = order.payments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const total = Number(order.total);
  if (total > 0 && paid >= total) return "PAID";
  if (paid > 0) return "PARTIALLY_PAID";
  return "UNPAID";
}

/* ── Waiter: table service / cleaning ─────────────────────────────────────── */
async function updateStaffTableStatus(id: number, newStatus: string): Promise<void> {
  try {
    await apiJson(`/api/tables/${id}/update_status/`, { method: "POST", body: JSON.stringify({ status: newStatus }) });
    showToast("Table updated", formatStatus(newStatus), "info");
  } catch (error) {
    showToast("Could not update table", error instanceof Error ? error.message : "Try again.", "danger");
  } finally {
    loadStaffTables();
  }
}

function safeGetStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage is unavailable (e.g. opened directly as a file:// page in some
    // browsers). The app keeps working in-memory for the current tab; it
    // just won't persist between reloads or sync across tabs.
  }
}

const THEME_STORAGE_KEY = "pm-cafe-theme";
type Theme = "light" | "dark";

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function savedTheme(): Theme {
  return safeGetStorage(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
}

function themeToggle(): string {
  const dark = document.documentElement.dataset.theme === "dark";
  return `<button class="theme-toggle" data-action="theme-toggle" aria-label="${dark ? "Switch to light mode" : "Switch to dark mode"}" title="${dark ? "Switch to light mode" : "Switch to dark mode"}"><span aria-hidden="true">${dark ? "☀" : "☾"}</span><b>${dark ? "Light" : "Dark"}</b></button>`;
}

function toggleTheme(): void {
  const next: Theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  safeSetStorage(THEME_STORAGE_KEY, next);
  render();
}

function loadState(): AppState {
  const stored = safeGetStorage("pm-cafe-state");
  if (!stored) return { ...defaultState, availability: Object.fromEntries(menu.map((item) => [item.id, item.availability])) };
  try {
    const parsed = JSON.parse(stored) as AppState;
    return {
      ...defaultState,
      ...parsed,
      // Older browser sessions stored an empty table array. Never let that
      // stale client cache break the entry page before a table can be scanned.
      tables: Array.isArray(parsed.tables) && parsed.tables.length ? parsed.tables : defaultState.tables,
      staff: parsed.staff || defaultState.staff,
      availability: { ...Object.fromEntries(menu.map((item) => [item.id, item.availability])), ...parsed.availability }
    };
  } catch {
    return { ...defaultState, availability: Object.fromEntries(menu.map((item) => [item.id, item.availability])) };
  }
}

function saveState(): void {
  safeSetStorage("pm-cafe-state", JSON.stringify(state));
}

let customerSessionToken: string | null = safeGetStorage("pm-cafe-table-session");
let customerSessionId: number | null = Number(safeGetStorage("pm-cafe-table-session-id")) || null;
let customerPollTimer: number | null = null;
let editingRejectedOrderId: number | null = null;

async function loadCustomerOrders(): Promise<void> {
  if (!customerSessionToken || !customerSessionId) return;
  try {
    const response = await fetch(`${apiBase()}/api/orders/mine/`, {
      headers: { "X-Table-Session": customerSessionToken },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 403) {
        clearCustomerSession();
        state.customerTableId = null;
        saveState();
        render();
      }
      return;
    }
    const records = Array.isArray(body) ? body as ApiOrderFull[] : [];
    state.orders = records.map(mapApiOrderToCustomerOrder);
    saveState();
    if (state.customerTableId && !state.staffRole) render();
  } catch {
    // Keep the last server snapshot visible and retry on the next interval.
  }
}

function startCustomerPolling(): void {
  if (customerPollTimer !== null || !customerSessionToken) return;
  loadCustomerOrders();
  customerPollTimer = window.setInterval(loadCustomerOrders, 5000);
}

function stopCustomerPolling(): void {
  if (customerPollTimer !== null) {
    window.clearInterval(customerPollTimer);
    customerPollTimer = null;
  }
}

function clearCustomerSession(): void {
  stopCustomerPolling();
  customerSessionToken = null;
  customerSessionId = null;
  try {
    localStorage.removeItem("pm-cafe-table-session");
    localStorage.removeItem("pm-cafe-table-session-id");
  } catch { /* storage unavailable */ }
}

function apiErrorMessage(body: any, fallback: string): string {
  if (!body) return fallback;
  if (typeof body.detail === "string") return body.detail;
  return Object.values(body).flat().join(" ") || fallback;
}

function notify(title: string, body: string, tone: Notice["tone"], audience: Notice["audience"] = "CUSTOMER", orderId?: string): void {
  const notice: Notice = { id: `notice-${Date.now()}`, title, body, tone, audience, orderId, createdAt: "Just now" };
  state.notices = [notice, ...state.notices].slice(0, 30);
  saveState();
  if (audience === "CUSTOMER" || state.staffRole) showToast(title, body, tone);
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string): string {
  return status.toLowerCase().replaceAll("_", "-");
}

/** Time-of-day greeting used on the customer table view and the staff overview
 * header — reads the visitor's local clock, so a cashier working nights still
 * sees "Good evening", not a greeting fixed to whenever this file was edited. */
function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function sourceLabel(order: Order): string {
  return order.source === "DINE_IN_QR" ? `DINE-IN QR · Table ${order.tableId}` : order.source === "WEBSITE" ? "WEBSITE" : "TAKEAWAY";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character));
}

function totalForItems(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

function orderTotal(order: Order): number {
  return order.total ?? totalForItems(order.items);
}

function totals(items: CartItem[]): { subtotal: number; service: number; tax: number; total: number } {
  const subtotal = totalForItems(items);
  const service = subtotal * 0.1;
  const tax = subtotal * 0.14;
  return { subtotal, service, tax, total: subtotal + service + tax };
}

function customerOrders(): Order[] {
  return state.orders.filter((order) => order.tableId === state.customerTableId);
}

function mapApiOrderToCustomerOrder(record: ApiOrderFull): Order {
  const items: CartItem[] = record.items.map((item) => {
    const menuItem = menu.find((candidate) => candidate.apiId === item.menu_item);
    return {
      id: `api-${record.id}-${item.id}`,
      menuItemId: menuItem?.id || String(item.menu_item),
      name: item.name_snapshot,
      image: menuItem?.image || "",
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      options: item.options || [],
      notes: item.notes || "",
    };
  });
  const paid = record.payments
    .filter((payment) => payment.status === "PAID")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const total = Number(record.total);
  const payment = record.payments.find((candidate) => candidate.status === "PAID");
  return {
    id: record.number,
    backendId: record.id,
    tableId: record.table_number || state.customerTableId || "07",
    source: record.source,
    items,
    customRequest: record.custom_request || "",
    status: record.status as OrderStatus,
    paymentStatus: paid >= total && total > 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "UNPAID",
    paymentMethod: payment?.method || "",
    paidAmount: paid,
    total,
    createdAt: new Date(record.created_at).toLocaleString(),
    rejectionReason: record.rejection_reason || "",
    cashierNote: record.cashier_note || "",
    kitchenNote: record.kitchen_note || "",
  };
}

function app(): HTMLElement {
  return document.getElementById("app") as HTMLElement;
}

/** Turn Django ImageField values into a browser-safe URL exactly once.
 * Django returns `/media/...` in development and may return an absolute CDN URL
 * in production.  Keeping this at the render boundary prevents either the
 * customer menu or manager cards from accidentally showing the path as text. */
function mediaUrl(value: string | null | undefined): string {
  if (!value) return "";
  const url = String(value).trim();
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const apiBase = String((window as any).PM_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  return `${apiBase}${url.startsWith("/") ? url : `/${url}`}`;
}

function productImage(item: MenuItem, className = ""): string {
  const url = mediaUrl(item.image);
  return url ? `<img class="${className}" src="${escapeHtml(url)}" alt="${escapeHtml(item.name)}" loading="lazy" />` : "";
}

/** Render a menu item's small icon wherever the UI shows a compact square thumbnail:
 * cart lines, order previews, the kitchen board, and the manager menu grid.
 * Real products now carry a Django media URL in `.image` (see mediaUrl above); a
 * few legacy demo orders still store a literal emoji there. FIX (Part 1 gap): every
 * one of those call sites used to print `${item.image}` straight into the markup,
 * so once real products replaced the emoji seed data the raw image URL showed up
 * as plain text next to the product name instead of a picture. This detects which
 * kind of value it has and always turns a URL into an <img>, never raw text.
 * className is kept on the wrapping <span> so the existing CSS box (size, radius,
 * placement) for that spot keeps working unchanged; a matching `img` rule sizes
 * the picture to fill the box with object-fit: contain so it is never stretched,
 * distorted, or cropped. */
function itemThumb(image: string | null | undefined, name: string, className: string): string {
  const value = (image || "").trim();
  const looksLikeImage = value && (/^(https?:|data:|blob:)/i.test(value) || value.startsWith("/") || value.includes("/media/"));
  const inner = !value
    ? "🍽️"
    : looksLikeImage
      ? `<img src="${escapeHtml(mediaUrl(value))}" alt="${escapeHtml(name)}" loading="lazy" />`
      : escapeHtml(value);
  return `<span${className ? ` class="${className}"` : ""}>${inner}</span>`;
}

function render(): void {
  // renderCustomer replaces the menu markup, so keep the horizontal category
  // rail's own position across renders and browser reloads.
  const categoryRail = document.querySelector(".menu-section .category-row") as HTMLElement | null;
  const categoryScrollLeft = categoryRail
    ? categoryRail.scrollLeft
    : Number(safeGetStorage(CUSTOMER_CATEGORY_SCROLL_KEY) || 0);
  if (!Array.isArray(state.tables) || !state.tables.length) {
    state.tables = initialTables.map((table) => ({ ...table, sessions: [...(table.sessions || [])] }));
    saveState();
  }
  // Every staff role is backend-authenticated now (Part 3B: Cashier/Waiter
  // joined Manager/Kitchen). A role saved from a previous session with no
  // matching JWT session must not silently reopen a privileged workspace.
  if (state.staffRole && (!authSession || authSession.role !== state.staffRole)) {
    state.staffRole = null;
    saveState();
  }
  if (state.customerTableId && (!customerSessionToken || !customerSessionId)) {
    state.customerTableId = null;
    saveState();
  }
  if (state.staffRole) renderStaff();
  else if (!state.customerTableId) renderScan();
  else renderCustomer();
  const updatedCategoryRail = document.querySelector(
    ".menu-section .category-row",
  ) as HTMLElement | null;
  if (updatedCategoryRail) updatedCategoryRail.scrollLeft = categoryScrollLeft;
  ensureSignature();
}

function ensureSignature(): void {
  const host = app();
  if (host.querySelector(".pm-signature")) return;
  host.insertAdjacentHTML("beforeend", '<footer class="pm-signature" aria-label="PM signature">PM</footer>');
}

function renderTopbar(label: string, action = ""): string {
  const unread = state.notices.filter((notice) => notice.audience === "CUSTOMER").length;
  return `<header class="topbar">
    <button class="brand-button" data-action="home"><span class="brand-mark">✦</span><span><strong>PM</strong><small>${label}</small></span></button>
    <div class="topbar-actions">
      ${action}
      ${themeToggle()}
      <button class="icon-button notification-button" data-action="notifications" aria-label="Notifications">♢<b>${unread}</b></button>
    </div>
  </header>`;
}

function renderScan(): void {
  app().innerHTML = `<main class="scan-page">
    ${renderTopbar("Café ordering, beautifully simple", `<button class="text-button" data-action="staff-login">Staff workspace →</button>`)}
    <section class="scan-layout">
      <div class="scan-copy">
        <span class="eyebrow">A slower moment, made easier</span>
        <h1>Order from your table.<br><em>Stay in the moment.</em></h1>
        <p>Browse the menu, make it yours, and follow every step from the kitchen to your table.</p>
        <div class="scan-perks"><span>◉ No sign-up</span><span>◌ Table-locked</span><span>✦ Freshly made</span></div>
      </div>
      <div class="scanner-card">
        <div class="scanner-heading"><span class="live-dot"></span><span>Camera ready</span><small>QR SESSION</small></div>
        <div class="scanner-frame"><div class="corner c1"></div><div class="corner c2"></div><div class="corner c3"></div><div class="corner c4"></div><div class="scan-line"></div><div class="qr-art">${qrPattern("T07")}</div></div>
        <strong>Scan the QR code on your table</strong>
        <p>We'll securely link this session to your table.</p>
        <button class="primary-button wide" data-action="scan">Scan table QR <span>↗</span></button>
        <small class="scanner-foot">Simulation mode · Table 07 demo</small>
      </div>
    </section>
    <section class="scan-footer"><span>PM</span><span>Good food. Zero friction.</span><span>Cairo · Since 2026</span></section>
  </main>`;
}

async function scanCustomerTable(button: HTMLButtonElement): Promise<void> {
  const table = initialTables.find((candidate) => candidate.id === "07") || initialTables[6];
  const params = new URLSearchParams(window.location.search);
  const qrToken = params.get("table_token") || params.get("token") || table.token;
  button.disabled = true;
  button.innerHTML = `<span class="spinner"></span> Finding your table…`;
  try {
    const response = await fetch(`${apiBase()}/api/tables/scan/?token=${encodeURIComponent(qrToken)}`);
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(apiErrorMessage(body, "The table QR code could not be verified."));
    customerSessionToken = body.session_token;
    customerSessionId = Number(body.session?.id);
    safeSetStorage("pm-cafe-table-session", customerSessionToken);
    safeSetStorage("pm-cafe-table-session-id", String(customerSessionId));
    const apiTable = body.table as ApiTable;
    state.customerTableId = apiTable.number;
    state.tables = state.tables.map((candidate) => candidate.id === apiTable.number
      ? { ...candidate, id: apiTable.number, label: `Table ${apiTable.number}`, seats: apiTable.seats, status: apiTable.status, guests: apiTable.seats }
      : candidate);
    saveState();
    render();
    showToast(`${apiTable.number} detected`, "Your private café session is ready.", "success");
  } catch (error) {
    button.disabled = false;
    button.innerHTML = `Scan table QR <span>↗</span>`;
    showToast("Could not start table session", error instanceof Error ? error.message : "Use a valid table QR link.", "danger");
  }
}

function qrPattern(seed: string): string {
  const blocks = Array.from({ length: 49 }, (_, index) => {
    const filled = ((index * 13 + seed.charCodeAt(index % seed.length)) % 7) < 3;
    return `<i class="${filled ? "filled" : ""}"></i>`;
  }).join("");
  return `<div class="qr-pattern">${blocks}</div>`;
}

function tableInfo(): Table {
  return state.tables.find((table) => table.id === state.customerTableId) || state.tables[6] || initialTables[6];
}

function renderCustomer(): void {
  startCustomerPolling();
  const table = tableInfo();
  const orders = customerOrders();
  const activeOrder = orders.find((order) => ["AWAITING_PAYMENT", "PENDING_APPROVAL", "APPROVED", "PREPARING", "READY", "PICKED_UP", "DELIVERED"].includes(order.status));
  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  app().innerHTML = `<main class="customer-shell">
    ${renderTopbar(`${table.label} · ${table.seats} seats`, `<button class="outline-button" data-action="customer-notices">Activity ${state.notices.filter((notice) => notice.audience === "CUSTOMER").length}</button>`)}
    <section class="customer-hero">
      <div><span class="eyebrow">Your table, your session</span><h1>${timeGreeting()}, table <em>${table.id}</em>.</h1><p>Take your time. We'll bring it to you when it's ready.</p></div>
      <div class="table-pill"><span class="table-icon">⌂</span><div><small>SEATED AT</small><strong>${table.label}</strong><span>${table.seats} seats · ${table.guests} guests</span></div><b class="lock">⌑</b></div>
    </section>
    ${activeOrder ? renderNextAction(activeOrder) : ""}
    <nav class="customer-tabs">
      <button class="${customerView === "menu" ? "active" : ""}" data-customer-view="menu">Menu <span>05</span></button>
      <button class="${customerView === "orders" ? "active" : ""}" data-customer-view="orders">My orders <span>${orders.length}</span></button>
      <button class="${customerView === "bill" ? "active" : ""}" data-customer-view="bill">Table bill</button>
      <button class="cart-tab ${cartCount ? "has-items" : ""}" data-action="cart">Cart <b>${cartCount}</b> <span>→</span></button>
    </nav>
    ${customerView === "menu" ? renderMenu() : customerView === "orders" ? renderOrders() : renderBill()}
  </main>`;
}

function renderNextAction(order: Order): string {
  const messages: Record<string, string> = {
    AWAITING_PAYMENT: "Order received — complete payment to send it to the kitchen.",
    PENDING_APPROVAL: "Waiting for cashier approval.",
    APPROVED: "Payment confirmed — your food is being queued for the kitchen.",
    PREPARING: "Your food is being prepared.",
    READY: "Your food is ready. A waiter is being notified.",
    PICKED_UP: "A waiter is bringing your order to the table.",
    DELIVERED: "Enjoy your meal!"
  };
  const needsPayment = order.status === "AWAITING_PAYMENT" || order.status === "APPROVED";
  return `<section class="next-action ${statusClass(order.status)}"><div class="next-icon">${order.status === "READY" ? "✓" : "✦"}</div><div><small>WHAT CAN I DO NOW?</small><strong>${messages[order.status] ?? formatStatus(order.status)}</strong><span>Order #${order.id} · ${money(orderTotal(order))}</span></div>${needsPayment ? `<button class="primary-button" data-action="payment" data-order="${order.id}">Pay now →</button>` : `<button class="ghost-button" data-customer-view="orders">Track order →</button>`}</section>`;
}

function renderMenu(): string {
  const categoryItem = (category: Category): string => `<button class="category-chip ${selectedCategory === category ? "active" : ""}" data-category="${category}"><span>${categoryIcon(category)}</span>${category}<b>${menu.filter((item) => item.category === category).length}</b></button>`;
  const items = menu.filter((item) => item.category === selectedCategory);
  return `<section class="menu-section">
    <div class="section-heading"><div><span class="eyebrow">Made to order</span><h2>Find your next favourite.</h2></div><span class="open-note"><button class="link-button" data-action="refresh-menu">↻ Refresh</button> · Open until 01:00</span></div>
    <div class="category-row">${categories.map(categoryItem).join("")}</div>
    <div class="product-grid">${items.map(renderProductCard).join("")}</div>
    <div class="request-banner"><div class="request-icon">+</div><div><strong>Don't see what you want?</strong><span>Send a special request to the cashier. They’ll check with the kitchen.</span></div><button class="outline-button" data-action="cart">Add request →</button></div>
  </section>`;
}

function categoryIcon(category: Category): string {
    // Icons for the real Django categories; any new category falls back to a neutral mark
    // so the chip never renders the word "undefined".
    const icons: Record<string, string> = {
        "Pizzas": "🍕", "Burgers": "🍔", "BBQ Dishes": "🍖", "Pasta Dishes": "🍝",
        "Fries": "🍟", "Salads": "🥗", "Soups": "🍲", "Coffee": "☕",
        "Desserts": "🍰", "Pastries": "🥐", "Fried Chicken": "🍗",
        "Baked Potatoes": "🥔", "Sauces": "🥫", "Complete Meals": "🍽️",
    };
    return icons[category] ?? "✦";
}

function renderProductCard(item: MenuItem): string {
  const availability = item.availability || "AVAILABLE";
  const unavailable = availability !== "AVAILABLE";
  return `<article class="product-card ${unavailable ? "unavailable" : ""}" data-product="${item.id}">
    <div class="product-visual visual-${item.category.toLowerCase()}">${productImage(item)}<i>${item.tags[0] || "PM Café"}</i></div>
    <div class="product-body"><div class="product-title"><h3>${item.name}</h3><strong>${money(item.price)}</strong></div><p>${item.description}</p><div class="product-footer">${unavailable ? `<span class="unavailable-label">● ${availability === "SOLD_OUT" ? "Sold out" : "Currently unavailable"}</span>` : `<span class="availability"><i></i> Available</span><button class="add-button" data-action="product" data-product="${item.id}">Add <b>+</b></button>`}</div></div>
  </article>`;
}

function renderOrders(): string {
  const orders = customerOrders();
  return `<section class="orders-section"><div class="section-heading"><div><span class="eyebrow">Table 07 session</span><h2>Your order journey.</h2></div><span class="session-tag">Session active</span></div>${orders.length ? `<div class="customer-orders">${orders.map(renderCustomerOrder).join("")}</div>` : `<div class="empty-state"><span>✦</span><h3>Your table is waiting</h3><p>Add something delicious from the menu to get started.</p><button class="primary-button" data-customer-view="menu">Browse the menu →</button></div>`}</section>`;
}

function renderCustomerOrder(order: Order): string {
  const rejected = order.status === "REJECTED";
  const currentIndex = orderStatuses.indexOf(order.status);
  const steps = ["AWAITING_PAYMENT", "APPROVED", "PREPARING", "READY", "PICKED_UP", "DELIVERED"];
  return `<article class="order-card ${rejected ? "rejected" : ""}">
    <div class="order-card-top"><div><span class="eyebrow">ORDER #${order.id}</span><h3>${order.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ")}</h3></div><span class="status-badge ${statusClass(order.status)}">${formatStatus(order.status)}</span></div>
    ${rejected ? `<div class="rejection-box"><strong>Needs your attention</strong><span>${escapeHtml(order.rejectionReason || "Please adjust this order.")}</span>${order.cashierNote ? `<small>${escapeHtml(order.cashierNote)}</small>` : ""}<button class="outline-button" data-action="fix-order" data-order="${order.id}">Fix this order →</button></div>` : `<div class="progress-track">${steps.map((step, index) => `<div class="progress-step ${index <= Math.max(0, currentIndex) ? "done" : ""} ${step === order.status ? "current" : ""}"><i>${index < currentIndex ? "✓" : index + 1}</i><span>${formatStatus(step)}</span></div>`).join("")}</div>`}
    <div class="order-card-bottom"><div class="mini-items">${order.items.slice(0, 3).map((item) => itemThumb(item.image, item.name, "")).join("")}<small>${order.items.length} item${order.items.length === 1 ? "" : "s"} · ${money(orderTotal(order))}</small></div>${(order.status === "AWAITING_PAYMENT" || order.status === "APPROVED") ? `<button class="primary-button small" data-action="payment" data-order="${order.id}">Pay now →</button>` : `<span class="order-time">${order.createdAt}</span>`}</div>
  </article>`;
}

function renderBill(): string {
  const approvedOrders = customerOrders().filter((order) => order.status !== "REJECTED" && order.status !== "CANCELLED");
  const items = approvedOrders.flatMap((order) => order.items);
  const bill = totals(items);
  const paid = approvedOrders.reduce((sum, order) => sum + order.paidAmount, 0);
  return `<section class="bill-section"><div class="section-heading"><div><span class="eyebrow">Private table statement</span><h2>Table ${tableInfo().id} bill.</h2></div><span class="lock-label">⌑ Only visible to Table ${tableInfo().id}</span></div><div class="bill-layout"><div class="bill-card"><div class="bill-top"><span>PM</span><small>SESSION #5007</small></div><div class="bill-table-head"><span>ITEM</span><span>AMOUNT</span></div>${items.length ? items.map((item) => `<div class="bill-line"><span><b>${item.quantity}×</b> ${item.name}<small>${item.options.join(" · ")}</small></span><strong>${money(item.unitPrice * item.quantity)}</strong></div>`).join("") : `<div class="empty-bill">Approved orders will appear here.</div>`}<div class="bill-divider"></div><div class="bill-summary"><span>Subtotal <b>${money(bill.subtotal)}</b></span><span>Service charge <b>${money(bill.service)}</b></span><span>Tax <b>${money(bill.tax)}</b></span><strong>Total <b>${money(bill.total)}</b></strong></div></div><div class="balance-card"><span class="eyebrow">Balance</span><strong>${money(Math.max(0, bill.total - paid))}</strong><span>remaining from ${money(bill.total)}</span><div class="balance-meter"><i style="width:${bill.total ? Math.min(100, paid / bill.total * 100) : 0}%"></i></div><small>${money(paid)} paid · ${paid ? "Thank you" : "Payment pending"}</small></div></div></section>`;
}

function cartDetails(): string {
  const bill = totals(state.cart);
  return `<div class="modal-card cart-modal"><div class="modal-header"><div><span class="eyebrow">Table ${tableInfo().id}</span><h2>Your order</h2></div><button class="close-button" data-action="close-modal">×</button></div>${state.cart.length ? `<div class="cart-lines">${state.cart.map((item, index) => `<div class="cart-line">${itemThumb(item.image, item.name, "cart-emoji")}<div class="cart-line-main"><strong>${item.name}</strong><small>${item.options.length ? item.options.join(" · ") : "Classic preparation"}${item.notes ? ` · “${escapeHtml(item.notes)}”` : ""}</small><div class="quantity"><button data-cart-change="-1" data-index="${index}">−</button><b>${item.quantity}</b><button data-cart-change="1" data-index="${index}">+</button><button class="remove-link" data-cart-remove="${index}">Remove</button></div></div><strong>${money(item.unitPrice * item.quantity)}</strong></div>`).join("")}</div>` : `<div class="empty-state compact"><span>🧺</span><h3>Your cart is empty</h3><p>Choose something from the menu, or send the kitchen a special request.</p></div>`}<div class="custom-request"><div><span class="request-icon small">+</span><div><strong>Request something not listed</strong><small>It will need cashier approval.</small></div></div><textarea id="custom-request" placeholder="e.g. Can the kitchen make a half-and-half pizza?"></textarea></div><div class="totals-box"><span>Subtotal <b>${money(bill.subtotal)}</b></span><span>Service charge <b>${money(bill.service)}</b></span><span>Tax <b>${money(bill.tax)}</b></span><strong>Grand total <b>${money(bill.total)}</b></strong></div><button class="primary-button wide ${state.cart.length ? "" : "disabled"}" data-action="review">Review your order <span>→</span></button></div>`;
}

function reviewDetails(): string {
  const bill = totals(state.cart);
  const request = (document.getElementById("custom-request") as HTMLTextAreaElement)?.value || "";
  return `<div class="modal-card review-modal"><div class="modal-header"><div><span class="eyebrow">One last look</span><h2>Review your order</h2></div><button class="close-button" data-action="close-modal">×</button></div><div class="review-lock"><span>⌑</span><div><strong>${tableInfo().label} · ${tableInfo().seats} seats</strong><small>This order will be sent to the cashier for approval.</small></div></div><div class="review-items">${state.cart.map((item) => `<div><span>${itemThumb(item.image, item.name, "review-item-thumb")} <b>${item.quantity}× ${item.name}</b><small>${item.options.join(" · ") || "Classic"}${item.notes ? ` · ${escapeHtml(item.notes)}` : ""}</small></span><strong>${money(item.unitPrice * item.quantity)}</strong></div>`).join("")}${request ? `<div class="special-request"><span>+</span><div><strong>Special request</strong><small>${escapeHtml(request)}</small></div></div>` : ""}</div><div class="totals-box"><span>Subtotal <b>${money(bill.subtotal)}</b></span><span>Service <b>${money(bill.service)}</b></span><span>Tax <b>${money(bill.tax)}</b></span><strong>Total <b>${money(bill.total)}</b></strong></div><div class="review-actions"><button class="outline-button" data-action="back-cart">← Edit order</button><button class="primary-button" data-action="submit-order" data-request="${encodeURIComponent(request)}">Submit order <span>↗</span></button></div></div>`;
}

const managerSectionTitles: Record<string, string> = {
  overview: "Management overview", "mgr-menu": "Menu management", "mgr-tables": "Tables", "mgr-offers": "Offers",
  "mgr-employees": "Employees", "mgr-payroll": "Payroll", "mgr-attendance": "Attendance",
};

function renderStaff(): void {
  const roleLabel = state.staffRole === "KITCHEN" ? "Kitchen display" : state.staffRole === "WAITER" ? "Floor operations" : state.staffRole === "MANAGER" ? "Management overview" : "Cashier workspace";
  const nav = state.staffRole === "MANAGER"
    ? [
        staffNavItem("overview", "▦", "Overview"),
        staffNavItem("mgr-menu", "☰", "Menu management"),
        staffNavItem("mgr-tables", "⌂", "Tables"),
        staffNavItem("mgr-offers", "✺", "Offers"),
        staffNavItem("mgr-employees", "◈", "Employees"),
        staffNavItem("mgr-payroll", "₤", "Payroll"),
        staffNavItem("mgr-attendance", "◷", "Attendance"),
        staffNavItem("notes", "✎", "Notes"),
      ].join("")
    : state.staffRole === "KITCHEN"
      ? [
          staffNavItem("overview", "▦", "Kitchen queue", kitchenOrders.filter((order) => order.status === "APPROVED").length),
          staffNavItem("notes", "✎", "Notes"),
        ].join("")
      : [
          staffNavItem("overview", "▦", "Overview"),
          staffNavItem("orders", "⌁", state.staffRole === "WAITER" ? "Ready orders" : "Orders", state.staffRole === "WAITER" ? stfOrders.filter((o) => o.status === "READY").length : pendingStfOrders().length),
          staffNavItem("tables", "⌂", "Tables"),
          staffNavItem("payments", "◈", "Payments"),
          ...(state.staffRole === "CASHIER" ? [staffNavItem("reservations", "✦", "Reservations", cashReservations.filter((r) => r.status === "PENDING").length)] : []),
          staffNavItem("notes", "✎", "Notes"),
        ].join("");
  const heading = state.staffRole === "MANAGER"
    ? (managerSectionTitles[staffSection] || "Management overview")
    : state.staffRole === "KITCHEN"
      ? (staffSection === "notes" ? "Notes & handover" : "Kitchen queue — operational view only")
      : (staffSection === "overview" ? `${timeGreeting()}, ${authSession?.username ? formatStatus(authSession.username) : "team"}.` : staffSection === "tables" ? "Table floor" : staffSection === "payments" ? "Payment board" : staffSection === "reservations" ? "Reservations" : staffSection === "notes" ? "Notes & handover" : state.staffRole === "WAITER" ? "Service queue" : "Order control");
  const unreadCount = (stfNotifications || []).filter((n) => !n.read_at).length;
  app().innerHTML = `<main class="staff-shell"><aside class="staff-sidebar"><button class="brand-button sidebar-brand" data-action="staff-home"><span class="brand-mark">✦</span><span><strong>PM</strong><small>Staff workspace</small></span></button><div class="staff-profile"><div class="avatar">${state.staffRole[0]}</div><div><strong>${authSession?.username ? formatStatus(authSession.username) : formatStatus(state.staffRole)}</strong><small>${formatStatus(state.staffRole)}</small></div><span class="online"></span></div><nav class="staff-nav">${nav}</nav><div class="sidebar-bottom"><div class="shift-card"><span class="live-dot"></span><div><strong>Live database</strong><small>Connected via JWT</small></div></div><button class="logout-button" data-action="logout">↪ Sign out</button></div></aside><section class="staff-content"><header class="staff-header"><div><span class="eyebrow">${roleLabel}</span><h1>${heading}</h1></div><div class="staff-header-actions"><span class="date-chip">THU · 03 SEP 2026</span>${themeToggle()}<button class="icon-button" data-action="notifications">♢<b>${unreadCount}</b></button></div></header>${renderStaffSection()}</section></main>`;
}

function staffNavItem(section: string, icon: string, label: string, forcedCount?: number): string {
  const count = forcedCount !== undefined ? forcedCount : (section === "orders" && pendingStfOrders().length ? pendingStfOrders().length : 0);
  return `<button class="${staffSection === section ? "active" : ""}" data-staff-section="${section}"><span>${icon}</span>${label}${count ? `<b class="nav-count">${count}</b>` : ""}</button>`;
}

function pendingStfOrders(): ApiOrderFull[] {
  return stfOrders.filter((order) => order.status === "PENDING_APPROVAL" || order.status === "AWAITING_PAYMENT");
}

function renderStaffSection(): string {
  if (state.staffRole === "MANAGER") {
    if (staffSection === "notes") { if (stfNotes === null) loadStaffNotes(); return renderNotes(); }
    if (staffSection === "mgr-menu") { if (mgrCategories === null || mgrMenuItems === null) loadManagerMenu(); return renderManagerMenu(); }
    if (staffSection === "mgr-tables") { if (mgrTables === null) loadManagerTables(); return renderManagerTables(); }
    if (staffSection === "mgr-offers") { if (mgrOffers === null) loadManagerOffers(); return renderManagerOffers(); }
    if (staffSection === "mgr-employees") { if (mgrStaff === null) loadManagerStaff(); return renderManagerEmployees(); }
    if (staffSection === "mgr-payroll") { if (mgrStaff === null) loadManagerStaff(); return renderManagerPayroll(); }
    if (staffSection === "mgr-attendance") { if (mgrAttendance === null) loadManagerAttendance(); return renderManagerAttendance(); }
    // Overview is the Manager landing page — pull in every live data source it
    // summarizes (tables/offers/staff/analytics) the first time it is shown,
    // the same lazy-load-if-null pattern each section above already uses.
    if (mgrTables === null) loadManagerTables();
    if (mgrOffers === null) loadManagerOffers();
    if (mgrStaff === null) loadManagerStaff();
    if (!mgrAnalyticsTried) loadManagerAnalytics();
    return renderManagerOverview();
  }
  if (state.staffRole === "KITCHEN") {
    if (staffSection === "notes") { if (stfNotes === null) loadStaffNotes(); return renderNotes(); }
    if (!kitchenLoaded) loadKitchenOrders();
    return renderKitchenReal();
  }
  if (!stfOrdersLoaded) loadStaffOrders();
  if (staffSection === "tables") { if (stfTables === null) loadStaffTables(); return renderStaffTables(); }
  if (staffSection === "payments") return renderPayments();
  if (staffSection === "reservations" && state.staffRole === "CASHIER") {
    if (stfTables === null) loadStaffTables();
    if (!cashReservationsLoaded) loadReservations();
    return renderReservations();
  }
  if (staffSection === "notes") { if (stfNotes === null) loadStaffNotes(); return renderNotes(); }
  if (state.staffRole === "WAITER") return renderWaiter();
  return renderCashier();
}

function metric(label: string, value: string, detail: string, tone = ""): string {
  return `<div class="metric-card ${tone}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`;
}

/* ============================================================================
 * CASHIER (Part 3B) — real backend data via OrderSerializer (full financials).
 * Approve / reject (with reason), view prices, record payments, view tables,
 * receive notifications, add notes. Cashier's JWT/IsCashier permission on the
 * server is what actually blocks Manager-only endpoints (products, tables
 * CRUD, offers, employees, payroll) — the frontend simply never renders links
 * to them for this role, which is a UX nicety, not the security boundary.
 * ========================================================================= */

function renderCashier(): string {
  const orders = cashierFilter === "ALL" ? stfOrders : stfOrders.filter((order) => order.status === cashierFilter);
  const sales = stfOrders.flatMap((order) => order.payments).filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const activeTables = (stfTables || []).filter((table) => table.status !== "AVAILABLE").length;
  return `<div class="staff-view">
    ${stfError ? `<div class="empty-state staff-empty compact"><span>!</span><p>${escapeHtml(stfError)}</p></div>` : ""}
    <div class="metric-grid">${metric("PENDING APPROVAL", `${pendingStfOrders().length}`, "Needs a decision", "gold")}${metric("ACTIVE TABLES", `${activeTables}`, "Currently occupied")}${metric("SALES RECORDED", money(sales), "Paid through the API", "green")}${metric("READY TO SERVE", `${stfOrders.filter((order) => order.status === "READY").length}`, "Kitchen handoffs", "red")}</div>
    <div class="dashboard-toolbar"><div class="filter-pills">${["ALL", "AWAITING_PAYMENT", "PENDING_APPROVAL", "APPROVED", "PREPARING", "READY", "PICKED_UP", "DELIVERED", "REJECTED"].map((filter) => `<button class="${cashierFilter === filter ? "active" : ""}" data-cashier-filter="${filter}">${filter === "ALL" ? "All orders" : formatStatus(filter)}</button>`).join("")}</div><span class="refresh-label"><i class="live-dot"></i> Live board<button class="link-button" data-action="staff-refresh">↻ Refresh</button></span></div>
    <div class="order-grid">${orders.length ? orders.map(renderStaffOrderReal).join("") : `<div class="empty-state staff-empty"><span>✓</span><h3>All clear</h3><p>No orders in this view.</p></div>`}</div>
  </div>`;
}

function renderStaffOrderReal(order: ApiOrderFull): string {
  const pending = order.status === "PENDING_APPROVAL";
  const awaitingPayment = order.status === "AWAITING_PAYMENT";
  const paymentState = orderPaymentStatus(order);
  return `<article class="staff-order-card ${pending || awaitingPayment ? "attention" : ""}"><div class="staff-order-head"><div><span class="eyebrow">ORDER #${escapeHtml(order.number)} · ${order.source === "DINE_IN_QR" ? `DINE-IN QR · Table ${order.table_number || "—"}` : order.source}</span><h3>${order.items.map((item) => `${item.quantity}× ${escapeHtml(item.name_snapshot)}`).join(", ")}</h3></div><span class="status-badge ${statusClass(order.status)}">${formatStatus(order.status)}</span></div><div class="staff-order-items">${order.items.map((item) => `<div><span><b>${item.quantity}× ${escapeHtml(item.name_snapshot)}</b><small>${item.options.join(" · ") || "Classic"}${item.notes ? ` · Note: ${escapeHtml(item.notes)}` : ""}</small></span><strong>${money(Number(item.unit_price) * item.quantity)}</strong></div>`).join("")}</div>${order.custom_request ? `<div class="custom-request-line"><span>+</span><div><b>Special request</b><small>${escapeHtml(order.custom_request)}</small></div></div>` : ""}${order.status === "REJECTED" ? `<div class="rejection-box"><strong>Rejected</strong><span>${escapeHtml(order.rejection_reason || "—")}</span>${order.cashier_note ? `<small>${escapeHtml(order.cashier_note)}</small>` : ""}</div>` : ""}<div class="staff-order-meta"><span>◷ ${new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span>Payment: <b class="${statusClass(paymentState)}">${formatStatus(paymentState)}</b></span><strong>${money(Number(order.total))}</strong></div><div class="staff-order-actions">${pending ? `<button class="approve-button" data-action="approve" data-order="${order.id}">✓ Approve</button><button class="reject-button" data-action="reject" data-order="${order.id}">Reject</button>` : awaitingPayment ? `<button class="primary-button small" data-action="payment" data-order="${order.id}">Record payment</button><button class="reject-button" data-action="reject" data-order="${order.id}">Reject</button>` : `<button class="outline-button" data-action="view-order" data-order="${order.id}">View details</button>${paymentState !== "PAID" && order.status !== "REJECTED" && order.status !== "CANCELLED" ? `<button class="primary-button small" data-action="payment" data-order="${order.id}">Record payment</button>` : ""}${paymentState === "PAID" ? `<button class="outline-button" data-action="print-receipt" data-order="${order.id}">🖶 Receipt</button>` : ""}`}</div></article>`;
}

/** Full order detail + payment history + receipt entry point, shared by
 * Cashier ("View details") and Waiter (table lookups). */
function orderDetailModal(order: ApiOrderFull): string {
  const paymentState = orderPaymentStatus(order);
  const paidSoFar = order.payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, Number(order.total) - paidSoFar);
  return `<div class="modal-card note-modal order-detail-modal"><div class="modal-header"><div><span class="eyebrow">Order #${escapeHtml(order.number)} · ${formatStatus(order.status)}</span><h2>Table ${order.table_number || "—"}</h2></div><button class="close-button" data-action="close-modal">×</button></div>
  <div class="staff-order-items">${order.items.map((item) => `<div><span><b>${item.quantity}× ${escapeHtml(item.name_snapshot)}</b><small>${item.options.join(" · ") || "Classic"}</small></span><strong>${money(Number(item.unit_price) * item.quantity)}</strong></div>`).join("")}</div>
  <div class="totals-box"><span>Total <b>${money(Number(order.total))}</b></span><span>Paid <b>${money(paidSoFar)}</b></span><strong>Remaining <b>${money(remaining)}</b></strong></div>
  ${order.payments.length ? `<div class="payment-history"><span class="eyebrow">Payments</span>${order.payments.map((p) => `<div class="payment-history-row"><span>${formatStatus(p.method)} · ${formatStatus(p.status)}</span><b>${money(Number(p.amount))}</b></div>`).join("")}</div>` : ""}
  <div class="review-actions">
    ${paymentState !== "PAID" ? `<button class="primary-button" data-action="payment" data-order="${order.id}">Record payment</button>` : `<button class="outline-button" data-action="print-receipt" data-order="${order.id}">🖶 Print receipt</button>`}
    ${order.status === "DELIVERED" && paymentState === "PAID" ? `<button class="primary-button" data-action="complete-order" data-order="${order.id}">Mark completed</button>` : ""}
  </div>
  ${order.history.length ? `<div class="note-guide"><span class="eyebrow">Status history</span>${order.history.map((h) => `<div class="example-note">${formatStatus(h.status)} — ${h.changed_by_username || "system"} · ${new Date(h.created_at).toLocaleString()}</div>`).join("")}</div>` : ""}
  </div>`;
}

/* ============================================================================
 * KITCHEN WORKFLOW (Part 3A) — real backend data via KitchenOrderSerializer.
 *
 * Server-side financial boundary: OrderViewSet.get_serializer_class() (see
 * backend/cafe/views.py) returns KitchenOrderSerializer for any authenticated
 * KITCHEN user, which has NO unit_price / line_total / total / payments /
 * cashier_note fields at all — not hidden by CSS, never present in the JSON
 * the browser receives. The functions below only ever read fields that exist
 * on ApiKitchenOrder, so there is nothing financial to accidentally render.
 *
 * Workflow: Confirmed (APPROVED) → Preparing (PREPARING) → Ready (READY).
 * Actions: Start Preparing / Mark Preparing (both call orders/{id}/start/),
 * Mark Ready (orders/{id}/ready/), Add Internal Note (orders/{id}/add_kitchen_note/),
 * Mark unavailable/sold out (menu/{id}/mark_sold_out/).
 * ========================================================================= */

function renderKitchenReal(): string {
  const visible = kitchenOrders.filter((order) =>
    ["APPROVED", "PREPARING", "READY"].includes(order.status) &&
    `${order.number} ${order.table_number || ""}`.toLowerCase().includes(kitchenSearch.toLowerCase())
  );
  const column = (status: string, title: string, subtitle: string): string =>
    `<div class="kitchen-column"><div class="column-head"><div><h3>${title}</h3><small>${subtitle}</small></div><b>${visible.filter((o) => o.status === status).length}</b></div>${visible.filter((o) => o.status === status).map(renderKitchenCardReal).join("") || `<div class="column-empty">No orders here</div>`}</div>`;
  const soldOut = menu.filter((item) => state.availability[item.id] !== "AVAILABLE");
  return `<div class="staff-view">
    ${kitchenError ? `<div class="empty-state staff-empty"><span>!</span><h3>Kitchen queue unavailable</h3><p>${escapeHtml(kitchenError)}</p><button class="outline-button" data-action="kitchen-refresh">Retry →</button></div>` : ""}
    <div class="kitchen-top"><div class="metric-grid compact-metrics">${metric("CONFIRMED", `${visible.filter((o) => o.status === "APPROVED").length}`, "Newly approved","gold")}${metric("PREPARING", `${visible.filter((o) => o.status === "PREPARING").length}`, "On the pass","orange")}${metric("READY", `${visible.filter((o) => o.status === "READY").length}`, "Awaiting pickup","green")}</div><div class="kitchen-search"><span>⌕</span><input id="kitchen-search" value="${escapeHtml(kitchenSearch)}" placeholder="Search order or table" /></div><button class="outline-button" data-action="kitchen-refresh" title="Refresh queue">↻ Refresh</button></div>
    <div class="kitchen-board">${column("APPROVED", "Confirmed", "Approved by cashier")}${column("PREPARING", "Preparing", "On the line")}${column("READY", "Ready", "Waiting for waiter")}</div>
    <div class="availability-panel"><div><span class="eyebrow">Kitchen stock</span><h3>Item availability</h3><small>Mark sold out to hide from new orders; tap again to restock.</small></div><div class="availability-list">${menu.map((item) => { const isOut = item.availability === "SOLD_OUT" || !item.availability || item.availability !== "AVAILABLE"; return `<button class="stock-toggle ${isOut ? "off" : ""}" data-kitchen-sold-out="${item.id}" data-kitchen-restock="${item.id}" data-is-sold-out="${isOut}">${itemThumb(item.image, item.name, "")}<b>${item.name}</b><small>${isOut ? "Sold out — tap to restock ↺" : "Available — tap to mark sold out"}</small></button>`; }).join("") || "<span>No menu items loaded.</span>"}</div>${soldOut.length ? `<small class="kitchen-soldout-note">${soldOut.length} item${soldOut.length === 1 ? "" : "s"} currently sold out.</small>` : ""}</div>
  </div>`;
}

function kitchenOrderLabel(order: ApiKitchenOrder): string {
  return order.source === "DINE_IN_QR" ? `TABLE ${order.table_number || "—"}` : order.source === "TAKEAWAY" ? "TAKEAWAY" : "WEBSITE";
}

function renderKitchenCardReal(order: ApiKitchenOrder): string {
  const action = order.status === "APPROVED"
    ? `<button class="primary-button small" data-action="kitchen-start" data-order="${order.id}">Start preparing →</button>`
    : order.status === "PREPARING"
      ? `<button class="ready-button" data-action="kitchen-ready" data-order="${order.id}">Mark ready ✓</button>`
      : `<span class="picked-label">Ready for pickup</span>`;
  return `<article class="kitchen-card ${order.status === "READY" ? "ready-card" : ""}">
    <div class="kitchen-card-top"><span class="eyebrow">#${escapeHtml(order.number)} · ${order.source.replace("_", " ")}</span><strong>${kitchenOrderLabel(order)}</strong><small>${new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>${order.priority ? `<span class="priority-flag">Priority</span>` : ""}</div>
    <div class="kitchen-items">${order.items.map((item) => `<div><b>${item.quantity}×</b><span>${escapeHtml(item.name_snapshot)}<small>${item.options.join(" · ") || "Classic"}${item.notes ? ` · ${escapeHtml(item.notes)}` : ""}</small></span></div>`).join("")}</div>
    ${order.custom_request ? `<div class="custom-request-line"><span>+</span><div><b>Special request</b><small>${escapeHtml(order.custom_request)}</small></div></div>` : ""}
    ${order.kitchen_note ? `<div class="allergy-note">✦ ${escapeHtml(order.kitchen_note)}</div>` : ""}
    <div class="kitchen-action">${action}<button class="outline-button" data-action="kitchen-note" data-order="${order.id}">Internal note</button></div>
  </article>`;
}

async function kitchenTransition(orderId: number, action: "start" | "ready"): Promise<void> {
  try {
    await apiJson(`/api/orders/${orderId}/${action}/`, { method: "POST" });
    showToast(action === "start" ? "Order started" : "Order marked ready", `Order moved to ${action === "start" ? "Preparing" : "Ready"}.`, "success");
    loadKitchenOrders();
  } catch (error) {
    showToast("Could not update order", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

function kitchenNoteModal(orderId: number): void {
  const order = kitchenOrders.find((candidate) => candidate.id === orderId);
  showModal(`<div class="modal-card note-modal"><div class="modal-header"><div><span class="eyebrow">Order #${order?.number || orderId}</span><h2>Internal kitchen note</h2><p>Visible to kitchen and manager only — never shown to the customer.</p></div><button class="close-button" data-action="close-modal">×</button></div><textarea id="kitchen-note-text" placeholder="e.g. Ran out of basil, used parsley instead.">${escapeHtml(order?.kitchen_note || "")}</textarea><button class="primary-button wide" data-action="kitchen-save-note" data-order="${orderId}">Save note</button></div>`);
}

async function saveKitchenNote(orderId: number): Promise<void> {
  const text = (document.getElementById("kitchen-note-text") as HTMLTextAreaElement)?.value || "";
  try {
    await apiJson(`/api/orders/${orderId}/add_kitchen_note/`, { method: "POST", body: JSON.stringify({ note: text }) });
    closeModal();
    showToast("Note saved", "The internal note has been updated.", "success");
    loadKitchenOrders();
  } catch (error) {
    showToast("Could not save note", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

async function kitchenMarkSoldOut(menuItemId: string): Promise<void> {
  const item = menu.find((candidate) => candidate.id === menuItemId);
  if (!item) return;
  try {
    const updated = await apiJson<{ sold_out: boolean; name: string }>(`/api/menu/${item.apiId}/mark_sold_out/`, { method: "POST" });
    item.availability = "SOLD_OUT";
    showToast("Marked sold out", `${item.name} is now hidden from new orders.`, "warning");
    render();
  } catch (error) {
    showToast("Could not update stock", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

async function kitchenRestock(menuItemId: string): Promise<void> {
  const item = menu.find((candidate) => candidate.id === menuItemId);
  if (!item) return;
  try {
    await apiJson(`/api/menu/${item.apiId}/restock/`, { method: "POST" });
    item.availability = "AVAILABLE";
    showToast("Back in stock", `${item.name} is now available for new orders.`, "success");
    render();
  } catch (error) {
    showToast("Could not restock", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

/* ============================================================================
 * WAITER (Part 3B) — real backend data. Ready + picked-up queues, pickup/
 * deliver actions, table service/cleaning status, receive notifications.
 * ========================================================================= */

function renderWaiter(): string {
  if (stfTables === null) loadStaffTables();
  const ready = stfOrders.filter((order) => order.status === "READY");
  const pickedUp = stfOrders.filter((order) => order.status === "PICKED_UP");
  const tables = stfTables || [];
  return `<div class="staff-view">
    ${stfError ? `<div class="empty-state staff-empty compact"><span>!</span><p>${escapeHtml(stfError)}</p></div>` : ""}
    <div class="metric-grid">${metric("FOOD READY", `${ready.length}`, "Awaiting pickup", "green")}${metric("OUT FOR DELIVERY", `${pickedUp.length}`, "Picked up, not yet served", "orange")}${metric("FREE TABLES", `${tables.filter((table) => table.status === "AVAILABLE").length}`, "Ready for guests", "gold")}${metric("NEEDS CLEANING", `${tables.filter((table) => table.status === "NEEDS_CLEANING").length}`, "After service", "red")}</div>
    <div class="waiter-grid">
      <div class="ready-panel"><div class="panel-heading"><div><span class="eyebrow">Pickup alerts</span><h2>Food is ready</h2></div><span class="live-chip"><i class="live-dot"></i> Live</span></div>
        ${ready.length ? ready.map((order) => `<article class="ready-order"><div class="ready-number"><span>ORDER</span><strong>#${escapeHtml(order.number)}</strong></div><div><b>Table ${order.table_number || "—"}</b><p>${order.items.map((item) => `${item.quantity}× ${escapeHtml(item.name_snapshot)}`).join(" · ")}</p><small>Kitchen handoff · ${new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div><button class="primary-button small" data-action="pickup" data-order="${order.id}">Pick up →</button></article>`).join("") : `<div class="column-empty">No food waiting for pickup.</div>`}
        ${pickedUp.length ? `<div class="panel-heading"><h3>Picked up · deliver to table</h3></div>${pickedUp.map((order) => `<article class="ready-order picked-up"><div class="ready-number"><span>ORDER</span><strong>#${escapeHtml(order.number)}</strong></div><div><b>Table ${order.table_number || "—"}</b><p>${order.items.map((item) => `${item.quantity}× ${escapeHtml(item.name_snapshot)}`).join(" · ")}</p></div><button class="primary-button small" data-action="deliver" data-order="${order.id}">Mark delivered →</button></article>`).join("")}` : ""}
      </div>
      <div class="floor-panel"><div class="panel-heading"><div><span class="eyebrow">Floor view</span><h2>Table service</h2></div><span class="floor-key"><i class="green-dot"></i> Available</span></div><div class="table-mini-grid">${tables.length ? tables.map(renderTableMiniReal).join("") : `<div class="column-empty">${stfTables === null ? "Loading tables…" : "No tables yet."}</div>`}</div></div>
    </div>
  </div>`;
}

function renderTableMiniReal(table: ApiTable): string {
  const order = stfOrders.find((candidate) => candidate.table_number === table.number && !["COMPLETED", "CANCELLED", "REJECTED"].includes(candidate.status));
  const nextStatus = table.status === "AVAILABLE" ? "OCCUPIED" : table.status === "NEEDS_CLEANING" ? "AVAILABLE" : "NEEDS_CLEANING";
  const nextLabel = table.status === "AVAILABLE" ? "Seat table" : table.status === "NEEDS_CLEANING" ? "Mark ready" : "Needs cleaning";
  return `<article class="table-mini"><div class="table-mini-top"><strong>Table ${escapeHtml(table.number)}</strong><span class="table-state ${statusClass(table.status)}">${formatStatus(table.status)}</span></div><div class="table-shape"><span>${table.seats} seats</span></div><p>${order ? `Order #${escapeHtml(order.number)} · ${formatStatus(order.status)}` : "No active orders"}</p><div class="table-actions"><button data-table-status-real="${table.id}" data-next-status="${nextStatus}">${nextLabel}</button></div></article>`;
}

function renderStaffTables(): string {
  const tables = stfTables || [];
  const canEdit = state.staffRole === "WAITER";
  return `<div class="staff-view">
    ${stfError ? `<div class="empty-state staff-empty compact"><span>!</span><p>${escapeHtml(stfError)}</p></div>` : ""}
    <div class="panel-heading"><div><span class="eyebrow">Floor plan · live database</span><h2>Every table, straight from Django.</h2></div><span class="lock-label">${tables.filter((t) => t.active).length} active</span></div>
    ${tables.length ? `<div class="full-table-grid">${tables.map(canEdit ? renderTableMiniReal : (t) => `<article class="table-mini"><div class="table-mini-top"><strong>Table ${escapeHtml(t.number)}</strong><span class="table-state ${statusClass(t.status)}">${formatStatus(t.status)}</span></div><div class="table-shape"><span>${t.seats} seats</span></div><p>${escapeHtml(t.location || "—")}</p></article>`).join("")}</div>` : `<div class="empty-state staff-empty"><span>⌂</span><h3>${stfTables === null ? "Loading…" : "No tables yet"}</h3><p>${canEdit ? "" : "Ask a manager to add tables."}</p></div>`}
  </div>`;
}

/* ============================================================================
 * PAYMENTS (Cashier + Waiter) — real order/payment data, grouped by table.
 * ========================================================================= */

function renderPayments(): string {
  const active = stfOrders.filter((order) => !["REJECTED", "CANCELLED"].includes(order.status));
  const byTable = new Map<string, ApiOrderFull[]>();
  active.forEach((order) => {
    const key = order.table_number || "Takeaway/Website";
    byTable.set(key, [...(byTable.get(key) || []), order]);
  });
  const cards = Array.from(byTable.entries()).map(([tableLabel, orders]) => {
    const total = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const paid = orders.reduce((sum, order) => sum + order.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0), 0);
    const paymentState = paid >= total && total > 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "UNPAID";
    const lastPayment = orders.flatMap((o) => o.payments).slice(-1)[0];
    return `<article class="payment-table-card"><div class="payment-card-top"><strong>${tableLabel === "Takeaway/Website" ? tableLabel : `Table ${escapeHtml(tableLabel)}`}</strong><span class="status-badge ${statusClass(paymentState)}">${formatStatus(paymentState)}</span></div><div class="payment-big">${money(Math.max(0, total - paid))}<small>remaining</small></div><div class="payment-detail"><span>Orders <b>${orders.length}</b></span><span>Total <b>${money(total)}</b></span><span>Paid <b>${money(paid)}</b></span></div><div class="payment-progress"><i style="width:${total ? Math.min(100, paid / total * 100) : 0}%"></i></div><small class="payment-method">${lastPayment ? formatStatus(lastPayment.method) : "Method not selected"} · ${total ? `${Math.round(paid / total * 100)}% collected` : "No active order"}</small></article>`;
  }).join("");
  return `<div class="staff-view"><div class="panel-heading"><div><span class="eyebrow">Table-based payments</span><h2>Know what's settled.</h2></div></div><div class="payment-grid">${cards || `<div class="empty-state staff-empty"><span>◈</span><h3>No active orders</h3><p>Payments will appear here once tables have live orders.</p></div>`}</div></div>`;
}

/* ============================================================================
 * RESERVATIONS (Cashier) — real /api/reservations/ endpoint. Overlap and
 * inactive-table checks are enforced server-side (ReservationSerializer);
 * the frontend also greys out tables that are already booked for the chosen
 * date/time so the cashier gets instant feedback before submitting.
 * ========================================================================= */

function reservationStatusPills(): string {
  const filters = ["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];
  return `<div class="filter-pills">${filters.map((f) => `<button class="${reservationFilter === f ? "active" : ""}" data-reservation-filter="${f}">${f === "ALL" ? "All" : formatStatus(f)}</button>`).join("")}</div>`;
}

function reservationCard(r: ApiReservation): string {
  const eventLabel = reservationEventTypes.find((e) => e.value === r.event_type)?.label || formatStatus(r.event_type);
  const balance = Math.max(0, Number(r.price) - Number(r.deposit_amount));
  const actions = r.status === "PENDING"
    ? `<button class="approve-button" data-action="confirm-reservation" data-reservation="${r.id}">✓ Confirm</button><button class="reject-button" data-action="cancel-reservation" data-reservation="${r.id}">Cancel</button><button class="outline-button" data-action="edit-reservation" data-reservation="${r.id}">Edit</button>`
    : r.status === "CONFIRMED"
      ? `<button class="primary-button small" data-action="complete-reservation" data-reservation="${r.id}">Mark completed</button><button class="reject-button" data-action="cancel-reservation" data-reservation="${r.id}">Cancel</button>`
      : "";
  return `<article class="staff-order-card reservation-card"><div class="staff-order-head"><div><span class="eyebrow">${eventLabel} · ${r.date} at ${r.start_time.slice(0, 5)} (${r.duration_minutes} min)</span><h3>${escapeHtml(r.customer_name)} · ${r.guests} guests</h3></div><span class="status-badge ${statusClass(r.status)}">${formatStatus(r.status)}</span></div>
  <div class="staff-order-items"><div><span><b>Tables</b><small>${r.table_numbers.length ? r.table_numbers.map((n) => `Table ${escapeHtml(n)}`).join(", ") : "—"}</small></span><strong>${r.table_count}</strong></div><div><span><b>Phone</b><small>${escapeHtml(r.phone)}</small></span></div>${r.decoration ? `<div><span><b>Decoration</b><small>${escapeHtml(r.decoration)}</small></span></div>` : ""}${r.notes ? `<div><span><b>Notes</b><small>${escapeHtml(r.notes)}</small></span></div>` : ""}</div>
  <div class="staff-order-meta"><span>Payment: <b class="${statusClass(r.payment_status)}">${formatStatus(r.payment_status)}</b></span><span>Deposit ${money(Number(r.deposit_amount))}</span><strong>${money(Number(r.price))} <small>(balance ${money(balance)})</small></strong></div>
  <div class="staff-order-actions">${actions}</div></article>`;
}

function renderReservations(): string {
  const list = reservationFilter === "ALL" ? cashReservations : cashReservations.filter((r) => r.status === reservationFilter);
  const pending = cashReservations.filter((r) => r.status === "PENDING").length;
  const confirmed = cashReservations.filter((r) => r.status === "CONFIRMED").length;
  const upcomingRevenue = cashReservations.filter((r) => r.status !== "CANCELLED").reduce((sum, r) => sum + Number(r.price), 0);
  return `<div class="staff-view">
    ${reservationError ? `<div class="empty-state staff-empty compact"><span>!</span><p>${escapeHtml(reservationError)}</p></div>` : ""}
    <div class="metric-grid">${metric("PENDING", `${pending}`, "Awaiting confirmation", "gold")}${metric("CONFIRMED", `${confirmed}`, "Tables held as Reserved", "green")}${metric("BOOKED VALUE", money(upcomingRevenue), "Across active reservations")}</div>
    <div class="dashboard-toolbar">${reservationStatusPills()}<button class="primary-button" data-action="new-reservation">+ New reservation</button></div>
    <div class="order-grid">${list.length ? list.map(reservationCard).join("") : `<div class="empty-state staff-empty"><span>✦</span><h3>${cashReservationsLoaded ? "No reservations in this view" : "Loading…"}</h3><p>Create a reservation for a birthday, engagement, anniversary, graduation or private gathering.</p></div>`}</div>
  </div>`;
}

/* ============================================================================
 * NOTES (Part 3B) — real StaffNote API, shared across Manager/Cashier/Kitchen/
 * Waiter. Notes cover orders, items, tables and general kitchen/service
 * activity (audience narrows who each note is for).
 * ========================================================================= */

function renderNotes(): string {
  const notes = stfNotes || [];
  return `<div class="staff-view notes-view"><div class="panel-heading"><div><span class="eyebrow">Internal communication</span><h2>Keep the handover human.</h2></div><button class="primary-button" data-action="new-note">+ Add note</button></div><div class="note-columns"><div class="notes-list">${notes.length ? notes.map((note) => `<article class="internal-note"><span class="note-pin">✎</span><div><p>${escapeHtml(note.text)}</p><div><b>${escapeHtml(note.author_name || "Staff")}</b><span>→ ${formatStatus(note.audience)}${note.table_number ? ` · Table ${escapeHtml(note.table_number)}` : ""}${note.order ? ` · Order #${note.order}` : ""}</span><small>${new Date(note.created_at).toLocaleString()}</small></div></div></article>`).join("") : `<div class="column-empty">${stfNotes === null ? "Loading notes…" : "No notes yet."}</div>`}</div><div class="note-guide"><span class="eyebrow">Writing a useful note</span><h3>Short, specific, visible.</h3><p>Keep customer-facing notes separate from internal handover notes. Mention the table, the action, and who needs to know.</p><div class="example-note">"Table 07 · extra napkins requested · floor team to deliver."</div></div></div></div>`;
}

/* ============================================================================
 * MANAGER WORKSPACE (Part 3A) — Tables / Offers / Employees / Payroll /
 * Attendance are all wired to the live Django API via authFetch(). Nothing
 * in this section reads or writes state.tables / state.staff (the old
 * localStorage mock arrays); mgrTables / mgrOffers / mgrStaff / mgrAttendance
 * are the single source of truth once a Manager is signed in.
 * ========================================================================= */

function loadingCard(label: string): string {
  return `<div class="empty-state staff-empty"><span class="spinner"></span><h3>Loading ${escapeHtml(label)}…</h3><p>Fetching the latest data from the server.</p></div>`;
}

function errorBanner(): string {
  return mgrError ? `<div class="empty-state staff-empty compact"><span>!</span><p>${escapeHtml(mgrError)}</p></div>` : "";
}

// ── Tables ───────────────────────────────────────────────────────────────────

function renderManagerTables(): string {
  if (mgrTables === null) return loadingCard("tables");
  const rows = mgrTables.map((t) => `<tr><td><b>Table ${escapeHtml(t.number)}</b><small>${escapeHtml(t.location || "—")}</small></td><td>${t.seats}</td><td><span class="table-state ${statusClass(t.status)}">${formatStatus(t.status)}</span></td><td><span class="status-badge ${t.active ? "paid" : "unpaid"}">${t.active ? "ACTIVE" : "INACTIVE"}</span></td><td class="qr-token-cell"><code>${escapeHtml(t.qr_token)}</code></td><td class="table-row-actions">
    <select data-mgr-table-status="${t.id}">${(["AVAILABLE","OCCUPIED","WAITING_FOOD","FOOD_READY","FINISHED","NEEDS_CLEANING","RESERVED"] as TableStatus[]).map((s) => `<option value="${s}" ${s === t.status ? "selected" : ""}>${formatStatus(s)}</option>`).join("")}</select>
    <button class="outline-button" data-action="edit-real-table" data-table="${t.id}">Edit</button>
    <button class="outline-button" data-action="delete-table" data-table="${t.id}">Delete</button>
  </td></tr>`).join("");
  return `<div class="staff-view">
    ${errorBanner()}
    <div class="panel-heading"><div><span class="eyebrow">Floor plan · live database</span><h2>Every table, straight from Django.</h2></div><button class="primary-button" data-action="add-real-table">+ Add table</button></div>
    <div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Table</th><th>Seats</th><th>Status</th><th>Active</th><th>QR token</th><th>Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="6">No tables yet — add the first one.</td></tr>`}</tbody></table></div>
  </div>`;
}

function addTableModal(): void {
  showModal(`<div class="modal-card note-modal"><div class="modal-header"><div><span class="eyebrow">Manager tools · live</span><h2>Add table & generate QR</h2></div><button class="close-button" data-action="close-modal">×</button></div><input id="new-table-number" placeholder="Table number, e.g. 11" /><input id="new-table-seats" type="number" min="1" value="4" /><input id="new-table-location" placeholder="Location, e.g. Terrace" /><button class="primary-button wide" data-action="save-real-table">Create table & QR</button></div>`);
}

async function saveRealTable(): Promise<void> {
  const number = (document.getElementById("new-table-number") as HTMLInputElement)?.value.trim();
  const seats = Number((document.getElementById("new-table-seats") as HTMLInputElement)?.value || 0);
  const location = (document.getElementById("new-table-location") as HTMLInputElement)?.value.trim() || "Main hall";
  if (!number || !seats) { showToast("Complete table details", "Number and seats are required.", "warning"); return; }
  try {
    await apiJson("/api/tables/", { method: "POST", body: JSON.stringify({ number, seats, location }) });
    closeModal();
    showToast("Table created", `Table ${number} has a private QR token.`, "success");
    loadManagerTables();
  } catch (error) {
    showToast("Could not create table", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

async function deleteRealTable(id: number): Promise<void> {
  try {
    const result = await apiJson<any>(`/api/tables/${id}/`, { method: "DELETE" }).catch(async () => {
      // DELETE with history returns 200 + a deactivated table instead of 204 — apiJson's !ok check
      // only trips on real errors, so this catch only fires for genuine failures.
      throw new Error("Could not delete table.");
    });
    showToast(result?.detail ? "Table deactivated" : "Table deleted", result?.detail || "Removed from the floor plan.", "info");
  } catch (error) {
    showToast("Could not remove table", error instanceof Error ? error.message : "Try again.", "danger");
  } finally {
    loadManagerTables();
  }
}

async function updateRealTableStatus(id: number, newStatus: string): Promise<void> {
  try {
    await apiJson(`/api/tables/${id}/update_status/`, { method: "POST", body: JSON.stringify({ status: newStatus }) });
    showToast("Table updated", formatStatus(newStatus), "info");
    loadManagerTables();
  } catch (error) {
    showToast("Could not update table", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

// ── Offers ───────────────────────────────────────────────────────────────────

function renderManagerOffers(): string {
  if (mgrOffers === null) return loadingCard("offers");
  const cards = mgrOffers.map((o) => `<article class="offer-card ${o.is_currently_active ? "" : "offer-inactive"}">
    <div class="offer-card-top"><strong>${escapeHtml(o.name)}</strong><span class="status-badge ${o.is_currently_active ? "paid" : "unpaid"}">${o.is_currently_active ? "LIVE" : o.active ? "SCHEDULED" : "OFF"}</span></div>
    <p>${escapeHtml(o.description || "No description.")}</p>
    <div class="offer-meta"><span>${o.fixed_price ? `Fixed price ${money(Number(o.fixed_price))}` : o.discount_percent ? `${o.discount_percent}% off` : "No discount set"}</span><span>${o.is_permanent ? "Permanent" : "Scheduled"}</span><span>Priority ${o.priority}</span></div>
    <div class="offer-actions"><button class="outline-button" data-action="toggle-offer" data-offer="${o.id}" data-next="${!o.active}">${o.active ? "Deactivate" : "Activate"}</button><button class="outline-button" data-action="delete-offer" data-offer="${o.id}">Delete</button></div>
  </article>`).join("");
  return `<div class="staff-view">
    ${errorBanner()}
    <div class="panel-heading"><div><span class="eyebrow">Promotions · live database</span><h2>Manage discounts & specials.</h2></div><button class="primary-button" data-action="add-offer">+ New offer</button></div>
    <div class="offer-grid">${cards || `<div class="empty-state staff-empty"><span>✺</span><h3>No offers yet</h3><p>Create your first promotion.</p></div>`}</div>
  </div>`;
}

function addOfferModal(): void {
  showModal(`<div class="modal-card note-modal"><div class="modal-header"><div><span class="eyebrow">Manager tools · live</span><h2>Create offer</h2></div><button class="close-button" data-action="close-modal">×</button></div>
    <input id="offer-name" placeholder="Offer name, e.g. Happy Hour" />
    <textarea id="offer-description" placeholder="Description shown to customers"></textarea>
    <label class="field-label">Discount type</label>
    <select id="offer-type"><option value="percent">Percent off</option><option value="fixed">Fixed price</option></select>
    <input id="offer-value" type="number" step="0.01" placeholder="e.g. 20" />
    <label class="check-option"><input type="checkbox" id="offer-permanent" checked /><span>Permanent (never expires)</span></label>
    <button class="primary-button wide" data-action="save-offer">Create offer</button>
  </div>`);
}

async function saveOffer(): Promise<void> {
  const name = (document.getElementById("offer-name") as HTMLInputElement)?.value.trim();
  const description = (document.getElementById("offer-description") as HTMLTextAreaElement)?.value.trim() || "";
  const type = (document.getElementById("offer-type") as HTMLSelectElement)?.value;
  const value = Number((document.getElementById("offer-value") as HTMLInputElement)?.value || 0);
  const isPermanent = (document.getElementById("offer-permanent") as HTMLInputElement)?.checked;
  if (!name || !value) { showToast("Complete offer details", "Name and a discount value are required.", "warning"); return; }
  const body: Record<string, unknown> = {
    name, description, active: true, is_permanent: isPermanent, priority: 0,
    items: [], categories: [],
    discount_percent: type === "percent" ? value : null,
    fixed_price: type === "fixed" ? value : null,
  };
  try {
    await apiJson("/api/offers/", { method: "POST", body: JSON.stringify(body) });
    closeModal();
    showToast("Offer created", `${name} is now live.`, "success");
    loadManagerOffers();
  } catch (error) {
    showToast("Could not create offer", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

async function toggleOffer(id: number, next: boolean): Promise<void> {
  try {
    await apiJson(`/api/offers/${id}/`, { method: "PATCH", body: JSON.stringify({ active: next }) });
    loadManagerOffers();
  } catch (error) {
    showToast("Could not update offer", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

async function deleteOffer(id: number): Promise<void> {
  try {
    await apiJson(`/api/offers/${id}/`, { method: "DELETE" });
    showToast("Offer deleted", "Removed from the promotions list.", "info");
    loadManagerOffers();
  } catch (error) {
    showToast("Could not delete offer", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

// ── Employees ────────────────────────────────────────────────────────────────

function shiftLabel(member: ApiStaffMember): string {
  if (!member.start_time && !member.end_time) return "—";
  const fmt = (t?: string | null) => (t ? t.slice(0, 5) : "—");
  return `${fmt(member.start_time)} → ${fmt(member.end_time)}`;
}

function renderManagerEmployees(): string {
  if (mgrStaff === null) return loadingCard("employees");
  const rows = mgrStaff.map((s) => `<tr><td><b>${escapeHtml(s.full_name)}</b><small>@${escapeHtml(s.username)}${s.email ? ` · ${escapeHtml(s.email)}` : ""}</small></td><td>${formatStatus(s.role)}</td><td>${escapeHtml(s.phone || "—")}</td><td><b>${money(Number(s.salary))}</b></td><td>${shiftLabel(s)}</td><td>${employmentLabel(s)}</td><td><span class="status-badge ${s.active ? "paid" : "unpaid"}">${s.active ? "ACTIVE" : "INACTIVE"}</span></td><td class="table-row-actions"><button class="outline-button" data-action="edit-real-staff" data-staff="${s.id}">Edit</button><button class="outline-button" data-action="toggle-real-staff" data-staff="${s.id}">${s.active ? "Deactivate" : "Activate"}</button></td></tr>`).join("");
  return `<div class="staff-view">
    ${errorBanner()}
    <div class="panel-heading"><div><span class="eyebrow">Team roster · live database</span><h2>Employees & accounts.</h2></div><button class="primary-button" data-action="add-real-staff">+ Add team member</button></div>
    <div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Employee</th><th>Role</th><th>Phone</th><th>Base salary</th><th>Shift</th><th>Employment</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="8">No employees yet.</td></tr>`}</tbody></table></div>
  </div>`;
}

function addStaffModal(): void {
  showModal(`<div class="modal-card note-modal"><div class="modal-header"><div><span class="eyebrow">Manager tools · live</span><h2>Add team member</h2></div><button class="close-button" data-action="close-modal">×</button></div>
    <input id="new-staff-username" placeholder="Username (for login)" />
    <input id="new-staff-email" type="email" placeholder="Email (optional)" />
    <input id="new-staff-password" type="password" placeholder="Temporary password (min 8 chars)" />
    <select id="new-staff-role"><option value="CASHIER">Cashier</option><option value="WAITER">Waiter</option><option value="KITCHEN">Kitchen</option><option value="MANAGER">Manager</option></select>
    <input id="new-staff-phone" placeholder="Phone (optional)" />
    <input id="new-staff-salary" type="number" step="0.01" placeholder="Base salary, e.g. 6000" />
    <div class="form-row">
      <label class="field-label">Shift start<input id="new-staff-shift-start" type="time" /></label>
      <label class="field-label">Shift end<input id="new-staff-shift-end" type="time" /></label>
    </div>
    <button class="primary-button wide" data-action="save-real-staff">Add active employee</button>
  </div>`);
}

async function saveRealStaff(): Promise<void> {
  const username = (document.getElementById("new-staff-username") as HTMLInputElement)?.value.trim();
  const email = (document.getElementById("new-staff-email") as HTMLInputElement)?.value.trim();
  const password = (document.getElementById("new-staff-password") as HTMLInputElement)?.value;
  const role = (document.getElementById("new-staff-role") as HTMLSelectElement)?.value;
  const phone = (document.getElementById("new-staff-phone") as HTMLInputElement)?.value.trim();
  const salary = Number((document.getElementById("new-staff-salary") as HTMLInputElement)?.value || 0);
  const shiftStart = (document.getElementById("new-staff-shift-start") as HTMLInputElement)?.value || "";
  const shiftEnd = (document.getElementById("new-staff-shift-end") as HTMLInputElement)?.value || "";
  if (!username || !password || password.length < 8) { showToast("Complete employee details", "Username and an 8+ character password are required.", "warning"); return; }
  try {
    await apiJson("/api/staff/", { method: "POST", body: JSON.stringify({ username, email, password, role, phone, salary, start_time: shiftStart || null, end_time: shiftEnd || null, active: true }) });
    closeModal();
    showToast("Employee added", `${username} is active in the roster.`, "success");
    loadManagerStaff();
  } catch (error) {
    showToast("Could not add employee", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

async function toggleRealStaffActive(id: number): Promise<void> {
  try {
    await apiJson(`/api/staff/${id}/toggle_active/`, { method: "POST" });
    loadManagerStaff();
    showToast("Roster updated", "Employee status has been changed.", "info");
  } catch (error) {
    showToast("Could not update employee", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

// ── Payroll (bonuses / deductions) ──────────────────────────────────────────

function renderManagerPayroll(): string {
  if (mgrStaff === null) return loadingCard("payroll");
  const rows = mgrStaff.map((s) => {
    const recent = [...s.adjustments].slice(0, 3).map((a) => `<span class="adj-chip ${a.kind === "BONUS" ? "adj-bonus" : "adj-deduct"}">${a.kind === "BONUS" ? "+" : "−"}${money(Number(a.amount))} · ${escapeHtml(a.reason)}</span>`).join("");
    return `<tr><td><b>${escapeHtml(s.full_name)}</b><small>${formatStatus(s.role)}</small></td><td>${money(Number(s.salary))}</td><td class="payroll-plus">+${money(Number(s.total_bonuses))}</td><td class="payroll-minus">−${money(Number(s.total_deductions))}</td><td><b>${money(Number(s.net_salary))}</b></td><td class="payroll-recent">${recent || "—"}</td><td><button class="outline-button" data-action="add-adjustment" data-staff="${s.id}">+ Bonus/Deduction</button></td></tr>`;
  }).join("");
  return `<div class="staff-view">
    ${errorBanner()}
    <div class="panel-heading"><div><span class="eyebrow">Payroll · live database</span><h2>Base salary, bonuses & deductions.</h2></div></div>
    <div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Employee</th><th>Base</th><th>Bonuses</th><th>Deductions</th><th>Net salary</th><th>Recent</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="7">No employees yet.</td></tr>`}</tbody></table></div>
  </div>`;
}

function addAdjustmentModal(staffId: number): void {
  const staffMember = mgrStaff?.find((s) => s.id === staffId);
  const today = new Date().toISOString().slice(0, 10);
  showModal(`<div class="modal-card note-modal"><div class="modal-header"><div><span class="eyebrow">${staffMember ? escapeHtml(staffMember.full_name) : "Employee"}</span><h2>Add bonus or deduction</h2></div><button class="close-button" data-action="close-modal">×</button></div>
    <select id="adj-kind"><option value="BONUS">Bonus</option><option value="DEDUCT">Deduction</option></select>
    <input id="adj-amount" type="number" step="0.01" placeholder="Amount, e.g. 150" />
    <input id="adj-reason" placeholder="Reason, e.g. Overtime, extra shift" />
    <input id="adj-date" type="date" value="${today}" />
    <textarea id="adj-notes" placeholder="Notes (optional)"></textarea>
    <button class="primary-button wide" data-action="save-adjustment" data-staff="${staffId}">Save</button>
  </div>`);
}

async function saveAdjustment(staffId: number): Promise<void> {
  const kind = (document.getElementById("adj-kind") as HTMLSelectElement)?.value;
  const amount = Number((document.getElementById("adj-amount") as HTMLInputElement)?.value || 0);
  const reason = (document.getElementById("adj-reason") as HTMLInputElement)?.value.trim();
  const date = (document.getElementById("adj-date") as HTMLInputElement)?.value;
  const notes = (document.getElementById("adj-notes") as HTMLTextAreaElement)?.value.trim() || "";
  if (!amount || !reason) { showToast("Complete adjustment details", "Amount and reason are required.", "warning"); return; }
  try {
    await apiJson(`/api/staff/${staffId}/add_adjustment/`, { method: "POST", body: JSON.stringify({ kind, amount, reason, date, notes }) });
    closeModal();
    showToast("Adjustment saved", `${kind === "BONUS" ? "Bonus" : "Deduction"} of ${money(amount)} recorded.`, "success");
    loadManagerStaff();
  } catch (error) {
    showToast("Could not save adjustment", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

// ── Attendance ───────────────────────────────────────────────────────────────

function renderManagerAttendance(): string {
  if (mgrStaff === null || mgrAttendance === null) return loadingCard("attendance");
  const byStaff = new Map(mgrAttendance.map((a) => [a.staff, a]));
  const rows = mgrStaff.filter((s) => s.active).map((s) => {
    const record = byStaff.get(s.id);
    const mark = (status: "PRESENT" | "ABSENT" | "LATE", label: string) =>
      `<button class="attendance-btn ${record?.status === status ? `active ${status.toLowerCase()}` : ""}" data-action="mark-attendance" data-staff="${s.id}" data-status="${status}">${label}</button>`;
    return `<tr><td><b>${escapeHtml(s.full_name)}</b><small>${formatStatus(s.role)}</small></td><td class="attendance-actions">${mark("PRESENT", "Present")}${mark("ABSENT", "Absent")}${mark("LATE", "Late")}</td><td>${record ? formatStatus(record.status) : "Not marked"}</td></tr>`;
  }).join("");
  return `<div class="staff-view">
    ${errorBanner()}
    <div class="panel-heading"><div><span class="eyebrow">Attendance · live database</span><h2>Present, Absent or Late.</h2></div><input type="date" id="attendance-date" value="${mgrAttendanceDate}" /></div>
    <div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Employee</th><th>Mark today</th><th>Current status</th></tr></thead><tbody>${rows || `<tr><td colspan="3">No active employees.</td></tr>`}</tbody></table></div>
  </div>`;
}

async function markAttendance(staffId: number, status: string): Promise<void> {
  try {
    await apiJson("/api/attendance/", { method: "POST", body: JSON.stringify({ staff: staffId, date: mgrAttendanceDate, status }) });
    showToast("Attendance marked", formatStatus(status), "success");
    loadManagerAttendance();
  } catch (error) {
    showToast("Could not mark attendance", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

/* ============================================================================
 * MANAGER MENU MANAGEMENT + TABLE / EMPLOYEE EDITING + LIVE ANALYTICS (Part 3A)
 * Every function below talks to the real Django API through apiJson()/authFetch()
 * (all of those endpoints are IsManager-protected on the server). The Manager
 * caches (mgrCategories / mgrMenuItems / mgrTables / mgrStaff / mgrAnalytics)
 * are re-read from Django after each write — nothing is stored in localStorage.
 * ========================================================================= */

/** Menu prices can have piastres (e.g. 79.50), unlike the whole-pound money() helper. */
function formatPrice(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)} EGP`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ── Menu: categories + items ─────────────────────────────────────────────────

function renderManagerMenu(): string {
  if (mgrCategories === null || mgrMenuItems === null) return loadingCard("menu");
  const categoryList = mgrCategories;
  const items = mgrMenuItems;
  const countIn = (categoryId: number): number => items.filter((item) => item.category === categoryId).length;

  const categoryRows = categoryList.map((category) => `<tr class="${category.active ? "" : "mgr-row-inactive"}">
    <td><b>${escapeHtml(category.name)}</b><small>/${escapeHtml(category.slug)}</small></td>
    <td>${category.position}</td>
    <td>${countIn(category.id)}</td>
    <td><span class="status-badge ${category.active ? "paid" : "unpaid"}">${category.active ? "ACTIVE" : "INACTIVE"}</span></td>
    <td class="table-row-actions">
      <button class="outline-button" data-action="edit-category" data-mgr-category="${category.id}">Edit</button>
      <button class="outline-button" data-action="toggle-category" data-mgr-category="${category.id}" data-next="${!category.active}">${category.active ? "Deactivate" : "Activate"}</button>
      <button class="outline-button" data-action="delete-category" data-mgr-category="${category.id}">Delete</button>
    </td></tr>`).join("");

  const query = mgrMenuSearch.trim().toLowerCase();
  const visible = items.filter((item) =>
    (mgrMenuFilter === "ALL" || item.category === mgrMenuFilter)
    && (!query || item.name.toLowerCase().includes(query) || item.public_id.toLowerCase().includes(query) || item.category_name.toLowerCase().includes(query)));

  const itemRows = visible.map((item) => `<tr class="${item.active ? "" : "mgr-row-inactive"}">
    <td><div class="mgr-item-cell">${itemThumb(item.image_url || item.image, item.name, "mgr-item-thumb")}<span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.category_name)} · ${escapeHtml(item.public_id)}</small></span></div></td>
    <td><b>${formatPrice(item.price)}</b></td>
    <td class="mgr-badges"><span class="status-badge ${item.active ? "paid" : "unpaid"}">${item.active ? "ACTIVE" : "INACTIVE"}</span>${item.sold_out ? `<span class="status-badge rejected">SOLD OUT</span>` : ""}${item.is_complete_meal ? `<span class="status-badge pending">MEAL</span>` : ""}</td>
    <td class="table-row-actions">
      <button class="outline-button" data-action="edit-menu-item" data-mgr-item="${item.id}">Edit</button>
      <button class="outline-button" data-action="manage-item-options" data-mgr-item="${item.id}">Options</button>
      <button class="outline-button" data-action="toggle-menu-item" data-mgr-item="${item.id}" data-next="${!item.active}">${item.active ? "Deactivate" : "Activate"}</button>
      <button class="outline-button" data-action="toggle-menu-sold-out" data-mgr-item="${item.id}">${item.sold_out ? "Restock" : "Sold out"}</button>
      <button class="outline-button" data-action="delete-menu-item" data-mgr-item="${item.id}">Delete</button>
    </td></tr>`).join("");

  const chips = [
    `<button class="category-chip ${mgrMenuFilter === "ALL" ? "active" : ""}" data-mgr-menu-filter="ALL">All items<b>${items.length}</b></button>`,
    ...categoryList.map((category) => `<button class="category-chip ${mgrMenuFilter === category.id ? "active" : ""}" data-mgr-menu-filter="${category.id}">${escapeHtml(category.name)}<b>${countIn(category.id)}</b></button>`),
  ].join("");

  return `<div class="staff-view manager-menu">
    ${errorBanner()}
    <div class="panel-heading"><div><span class="eyebrow">Menu · live database</span><h2>Categories & dishes, straight from Django.</h2></div><div class="mgr-head-actions"><button class="outline-button" data-action="add-category">+ Category</button><button class="primary-button" data-action="add-menu-item">+ Menu item</button></div></div>
    <h3 class="mgr-subheading">Categories <small>${categoryList.length}</small></h3>
    <div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Category</th><th>Position</th><th>Items</th><th>Status</th><th>Actions</th></tr></thead><tbody>${categoryRows || `<tr><td colspan="5">No categories yet — add the first one, then add dishes to it.</td></tr>`}</tbody></table></div>
    <h3 class="mgr-subheading">Menu items <small>${visible.length} of ${items.length}</small></h3>
    <div class="mgr-toolbar"><div class="category-row mgr-filter-row">${chips}</div><input id="mgr-menu-search" class="mgr-search" type="search" placeholder="Search dishes…" value="${escapeHtml(mgrMenuSearch)}" /></div>
    <div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Item</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>${itemRows || `<tr><td colspan="4">${items.length ? "No menu items match this filter." : "No menu items yet — add the first one."}</td></tr>`}</tbody></table></div>
  </div>`;
}

function readCategoryDraft(): CategoryDraftValues {
  return {
    name: (document.getElementById("cat-name") as HTMLInputElement)?.value ?? "",
    position: Number((document.getElementById("cat-position") as HTMLInputElement)?.value ?? 0) || 0,
    slug: (document.getElementById("cat-slug") as HTMLInputElement)?.value ?? "",
    active: (document.getElementById("cat-active") as HTMLInputElement)?.checked ?? true,
    existingId: mgrEditingCategoryId,
  };
}

function categoryModal(existing?: ApiMgrCategory, draft?: CategoryDraftValues): void {
  mgrEditingCategoryId = existing?.id ?? draft?.existingId;
  if (!draft) {
    if (pendingCategoryImagePreviewUrl) URL.revokeObjectURL(pendingCategoryImagePreviewUrl);
    pendingCategoryImageBlob = null;
    pendingCategoryImagePreviewUrl = null;
  }
  const nextPosition = (mgrCategories || []).reduce((highest, category) => Math.max(highest, category.position), 0) + 1;
  const name = draft?.name ?? existing?.name ?? "";
  const position = draft ? draft.position : (existing ? existing.position : nextPosition);
  const slug = draft?.slug ?? existing?.slug ?? "";
  const active = draft ? draft.active : (!existing || existing.active);
  const currentImage = pendingCategoryImagePreviewUrl
    ? `<div class="mgr-current-image"><span class="mgr-item-thumb"><img src="${escapeHtml(pendingCategoryImagePreviewUrl)}" alt="Preview" /></span><small>New photo — cropped and ready to save.</small></div>`
    : (existing?.image ? `<div class="mgr-current-image">${itemThumb(existing.image, existing.name, "mgr-item-thumb")}<small>Current photo — choose a file below only to replace it.</small></div>` : "");
  showModal(`<div class="modal-card note-modal mgr-modal">
    <div class="modal-header"><div><span class="eyebrow">Manager tools · live</span><h2>${existing ? "Edit category" : "Add category"}</h2></div><button class="close-button" data-action="close-modal">×</button></div>
    <label class="field-label">Name<input id="cat-name" placeholder="e.g. Desserts" maxlength="80" value="${escapeHtml(name)}" /></label>
    <div class="form-row">
      <label class="field-label">Position<input id="cat-position" type="number" min="0" step="1" value="${position}" /></label>
      <label class="field-label">URL slug (optional)<input id="cat-slug" placeholder="auto from name" value="${escapeHtml(slug)}" /></label>
    </div>
    <label class="field-label">Photo (optional)${currentImage}<input id="cat-image" type="file" accept="image/*" /></label>
    <label class="check-option"><input type="checkbox" id="cat-active" ${active ? "checked" : ""} /><span>Active — its dishes show on the customer menu</span></label>
    <button class="primary-button wide" data-action="save-category" data-mgr-category="${existing?.id || ""}">${existing ? "Save changes" : "Create category"}</button>
  </div>`);
}

async function saveCategory(id?: number): Promise<void> {
  const name = (document.getElementById("cat-name") as HTMLInputElement)?.value.trim();
  const position = Number((document.getElementById("cat-position") as HTMLInputElement)?.value || 0);
  const rawSlug = (document.getElementById("cat-slug") as HTMLInputElement)?.value.trim().toLowerCase() || "";
  const slug = rawSlug.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const active = (document.getElementById("cat-active") as HTMLInputElement)?.checked ?? true;
  if (!name) { showToast("Name required", "Give the category a name.", "warning"); return; }
  if (!Number.isFinite(position) || position < 0) { showToast("Check the position", "Position must be 0 or higher.", "warning"); return; }
  const fields: Record<string, unknown> = { name, position: Math.floor(position), active };
  if (slug) fields.slug = slug;
  const rawFile = (document.getElementById("cat-image") as HTMLInputElement)?.files?.[0];
  const imageBlob: Blob | null = pendingCategoryImageBlob || (rawFile && rawFile.size <= 8 * 1024 * 1024 ? rawFile : null);
  let body: BodyInit;
  if (imageBlob) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, fieldValue]) => form.append(key, String(fieldValue)));
    form.append("image", imageBlob, "category.jpg");
    body = form;
  } else {
    body = JSON.stringify(fields);
  }
  try {
    await apiJson(id ? `/api/categories/${id}/` : "/api/categories/", { method: id ? "PATCH" : "POST", body });
    closeModal();
    if (pendingCategoryImagePreviewUrl) URL.revokeObjectURL(pendingCategoryImagePreviewUrl);
    pendingCategoryImageBlob = null;
    pendingCategoryImagePreviewUrl = null;
    showToast(id ? "Category updated" : "Category created", name, "success");
    await refreshManagerMenu();
  } catch (error) {
    showToast("Could not save category", errorMessage(error, "Try again."), "danger");
  }
}

async function toggleCategoryActive(id: number, next: boolean): Promise<void> {
  try {
    await apiJson(`/api/categories/${id}/`, { method: "PATCH", body: JSON.stringify({ active: next }) });
    showToast(next ? "Category activated" : "Category deactivated", next ? "Its dishes are back on the customer menu." : "Its dishes are hidden from the customer menu.", "info");
    await refreshManagerMenu();
  } catch (error) {
    showToast("Could not update category", errorMessage(error, "Try again."), "danger");
  }
}

/** One confirmation step for the two destructive menu actions. */
function confirmDeleteModal(kind: "category" | "menu-item", id: number): void {
  const category = kind === "category" ? mgrCategories?.find((c) => c.id === id) : undefined;
  const item = kind === "menu-item" ? mgrMenuItems?.find((i) => i.id === id) : undefined;
  const label = category?.name || item?.name;
  if (!label) return;
  const detail = kind === "category"
    ? "If it still contains dishes it will be deactivated instead, so nothing is lost."
    : "If this dish appears in past orders it will be deactivated instead, so order history stays intact.";
  showModal(`<div class="modal-card note-modal mgr-modal">
    <div class="modal-header"><div><span class="eyebrow">Please confirm</span><h2>Delete “${escapeHtml(label)}”?</h2></div><button class="close-button" data-action="close-modal">×</button></div>
    <p class="mgr-hint">${detail}</p>
    <div class="mgr-modal-actions"><button class="outline-button" data-action="close-modal">Cancel</button><button class="danger-button" data-action="confirm-delete-${kind}" data-mgr-${kind === "category" ? "category" : "item"}="${id}">Delete</button></div>
  </div>`);
}

async function deleteCategory(id: number): Promise<void> {
  try {
    const result = await apiJson<{ detail?: string } | undefined>(`/api/categories/${id}/`, { method: "DELETE" });
    closeModal();
    showToast(result?.detail ? "Category deactivated" : "Category deleted", result?.detail || "Removed from the menu.", "info");
    if (mgrMenuFilter === id) mgrMenuFilter = "ALL";
    await refreshManagerMenu();
  } catch (error) {
    showToast("Could not delete category", errorMessage(error, "Try again."), "danger");
  }
}

function readMenuItemDraft(): MenuItemDraftValues {
  const value = (fieldId: string): string => (document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value ?? "";
  const checked = (fieldId: string): boolean => (document.getElementById(fieldId) as HTMLInputElement)?.checked ?? false;
  return {
    name: value("item-name"), category: Number(value("item-category")) || 0,
    price: value("item-price"), description: value("item-description"), ingredients: value("item-ingredients"),
    active: checked("item-active"), soldOut: checked("item-sold-out"), meal: checked("item-meal"),
    existingId: mgrEditingItemId,
  };
}

function menuItemModal(existing?: ApiMgrMenuItem, draft?: MenuItemDraftValues): void {
  mgrEditingItemId = existing?.id ?? draft?.existingId;
  if (!draft) {
    if (pendingItemImagePreviewUrl) URL.revokeObjectURL(pendingItemImagePreviewUrl);
    pendingItemImageBlob = null;
    pendingItemImagePreviewUrl = null;
  }
  const categoryList = mgrCategories || [];
  if (!categoryList.length) { showToast("Add a category first", "Every dish belongs to a category.", "warning"); return; }
  const selectedCategoryId = draft?.category || existing?.category || (typeof mgrMenuFilter === "number" ? mgrMenuFilter : categoryList[0].id);
  const options = categoryList.map((category) => `<option value="${category.id}" ${category.id === selectedCategoryId ? "selected" : ""}>${escapeHtml(category.name)}${category.active ? "" : " (inactive)"}</option>`).join("");
  const currentImage = pendingItemImagePreviewUrl
    ? `<div class="mgr-current-image"><span class="mgr-item-thumb"><img src="${escapeHtml(pendingItemImagePreviewUrl)}" alt="Preview" /></span><small>New photo — cropped and ready to save.</small></div>`
    : (existing && (existing.image_url || existing.image)
      ? `<div class="mgr-current-image">${itemThumb(existing.image_url || existing.image, existing.name, "mgr-item-thumb")}<small>Current photo — choose a file below only to replace it.</small></div>` : "");
  const name = draft?.name ?? existing?.name ?? "";
  const priceValue = draft ? draft.price : (existing ? Number(existing.price).toFixed(2) : "");
  const description = draft?.description ?? existing?.description ?? "";
  const ingredients = draft?.ingredients ?? existing?.ingredients ?? "";
  const active = draft ? draft.active : (!existing || existing.active);
  const soldOut = draft ? draft.soldOut : !!existing?.sold_out;
  const meal = draft ? draft.meal : !!existing?.is_complete_meal;
  const optionsAddonsHint = existing
    ? `<button class="outline-button" data-action="manage-item-options" data-mgr-item="${existing.id}">Options & add-ons (${existing.options.length + existing.addons.length})</button>`
    : `<p class="mgr-hint">Save the dish first, then use its “Options” button to add sizes and extras.</p>`;
  showModal(`<div class="modal-card note-modal mgr-modal">
    <div class="modal-header"><div><span class="eyebrow">Manager tools · live</span><h2>${existing ? "Edit menu item" : "Add menu item"}</h2></div><button class="close-button" data-action="close-modal">×</button></div>
    <label class="field-label">Name<input id="item-name" placeholder="e.g. Chocolate lava cake" maxlength="140" value="${escapeHtml(name)}" /></label>
    <div class="form-row">
      <label class="field-label">Category<select id="item-category">${options}</select></label>
      <label class="field-label">Price (EGP)<input id="item-price" type="number" min="0" step="0.01" value="${escapeHtml(priceValue)}" placeholder="e.g. 85" /></label>
    </div>
    <label class="field-label">Description<textarea id="item-description" placeholder="Short blurb shown on the menu card">${escapeHtml(description)}</textarea></label>
    <label class="field-label">Ingredients<textarea id="item-ingredients" placeholder="Comma-separated, e.g. flour, cocoa, butter">${escapeHtml(ingredients)}</textarea></label>
    <label class="field-label">Photo (optional)${currentImage}<input id="item-image" type="file" accept="image/*" /></label>
    <label class="check-option"><input type="checkbox" id="item-active" ${active ? "checked" : ""} /><span>Active — visible to customers</span></label>
    <label class="check-option"><input type="checkbox" id="item-sold-out" ${soldOut ? "checked" : ""} /><span>Sold out — shown but not orderable</span></label>
    <label class="check-option"><input type="checkbox" id="item-meal" ${meal ? "checked" : ""} /><span>Complete meal</span></label>
    <div class="mgr-item-options-row">${optionsAddonsHint}</div>
    <button class="primary-button wide" data-action="save-menu-item" data-mgr-item="${existing?.id || ""}">${existing ? "Save changes" : "Create menu item"}</button>
  </div>`);
}

async function saveMenuItem(id?: number): Promise<void> {
  const value = (fieldId: string): string => (document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value.trim() || "";
  const checked = (fieldId: string): boolean => (document.getElementById(fieldId) as HTMLInputElement)?.checked ?? false;
  const name = value("item-name");
  const description = value("item-description");
  const category = Number(value("item-category"));
  const priceText = value("item-price");
  const price = Number(priceText);
  const rawFile = (document.getElementById("item-image") as HTMLInputElement)?.files?.[0];
  if (!name) { showToast("Name required", "Give the dish a name.", "warning"); return; }
  if (!category) { showToast("Category required", "Choose a category.", "warning"); return; }
  if (priceText === "" || !Number.isFinite(price) || price < 0) { showToast("Check the price", "Enter a price of 0 or more.", "warning"); return; }
  if (!description) { showToast("Description required", "Add a short description for the menu card.", "warning"); return; }
  const fields: Record<string, string | number | boolean> = {
    name, category, description, ingredients: value("item-ingredients"),
    price: Math.round(price * 100) / 100,
    active: checked("item-active"), sold_out: checked("item-sold-out"), is_complete_meal: checked("item-meal"),
  };
  // The manager never uploads a raw file directly — item-image's selection is
  // intercepted into the cropper (see openCropperForFile) and the cropped
  // result lands in pendingItemImageBlob. rawFile is only a safety fallback.
  const imageBlob: Blob | null = pendingItemImageBlob || (rawFile && rawFile.size <= 8 * 1024 * 1024 ? rawFile : null);
  let body: BodyInit;
  if (imageBlob) {
    // A photo needs multipart; authFetch() leaves the Content-Type to the browser for FormData.
    const form = new FormData();
    Object.entries(fields).forEach(([key, fieldValue]) => form.append(key, String(fieldValue)));
    form.append("image", imageBlob, "dish.jpg");
    body = form;
  } else {
    body = JSON.stringify(fields);
  }
  try {
    await apiJson(id ? `/api/menu/${id}/` : "/api/menu/", { method: id ? "PATCH" : "POST", body });
    closeModal();
    if (pendingItemImagePreviewUrl) URL.revokeObjectURL(pendingItemImagePreviewUrl);
    pendingItemImageBlob = null;
    pendingItemImagePreviewUrl = null;
    showToast(id ? "Menu item updated" : "Menu item created", name, "success");
    await refreshManagerMenu();
  } catch (error) {
    showToast("Could not save menu item", errorMessage(error, "Try again."), "danger");
  }
}

/* ── Options & add-ons panel (Part 3B) ─────────────────────────────────────── */

function itemOptionsModal(item: ApiMgrMenuItem): void {
  const current = mgrMenuItems?.find((candidate) => candidate.id === item.id) || item;
  const optionRows = current.options.length
    ? current.options.map((o) => `<tr class="${o.active ? "" : "mgr-row-inactive"}">
        <td>${escapeHtml(o.name)}</td>
        <td>${Number(o.price_delta) ? `+${money(Number(o.price_delta))}` : "—"}</td>
        <td><span class="status-badge ${o.active ? "paid" : "unpaid"}">${o.active ? "ACTIVE" : "OFF"}</span></td>
        <td class="table-row-actions">
          <button class="outline-button" data-action="toggle-item-option" data-option="${o.id}" data-mgr-item="${current.id}" data-next="${!o.active}">${o.active ? "Deactivate" : "Activate"}</button>
          <button class="outline-button" data-action="delete-item-option" data-option="${o.id}" data-mgr-item="${current.id}">Delete</button>
        </td></tr>`).join("")
    : `<tr><td colspan="4">No options yet — sizes or variations go here.</td></tr>`;
  const addonRows = current.addons.length
    ? current.addons.map((a) => `<tr class="${a.active ? "" : "mgr-row-inactive"}">
        <td>${escapeHtml(a.name)}</td>
        <td>+${money(Number(a.price))}</td>
        <td><span class="status-badge ${a.active ? "paid" : "unpaid"}">${a.active ? "ACTIVE" : "OFF"}</span></td>
        <td class="table-row-actions">
          <button class="outline-button" data-action="toggle-item-addon" data-addon="${a.id}" data-mgr-item="${current.id}" data-next="${!a.active}">${a.active ? "Deactivate" : "Activate"}</button>
          <button class="outline-button" data-action="delete-item-addon" data-addon="${a.id}" data-mgr-item="${current.id}">Delete</button>
        </td></tr>`).join("")
    : `<tr><td colspan="4">No add-ons yet — extras go here.</td></tr>`;
  showModal(`<div class="modal-card note-modal mgr-modal options-modal">
    <div class="modal-header"><div><span class="eyebrow">Manager tools · live</span><h2>${escapeHtml(current.name)} — options & add-ons</h2></div><button class="close-button" data-action="close-modal">×</button></div>
    <h3 class="mgr-subheading">Options <small>size / variation — changes the price</small></h3>
    <div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Name</th><th>Price change</th><th>Status</th><th>Actions</th></tr></thead><tbody>${optionRows}</tbody></table></div>
    <div class="form-row mgr-inline-add">
      <input id="new-option-name" placeholder="e.g. Large" maxlength="100" />
      <input id="new-option-delta" type="number" step="0.01" placeholder="Price change (EGP)" value="0" />
      <button class="outline-button" data-action="add-item-option" data-mgr-item="${current.id}">+ Add option</button>
    </div>
    <h3 class="mgr-subheading">Add-ons <small>optional extra — adds to the price</small></h3>
    <div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Name</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>${addonRows}</tbody></table></div>
    <div class="form-row mgr-inline-add">
      <input id="new-addon-name" placeholder="e.g. Extra cheese" maxlength="100" />
      <input id="new-addon-price" type="number" min="0" step="0.01" placeholder="Price (EGP)" value="0" />
      <button class="outline-button" data-action="add-item-addon" data-mgr-item="${current.id}">+ Add add-on</button>
    </div>
  </div>`);
}

async function addItemOption(itemId: number): Promise<void> {
  const name = (document.getElementById("new-option-name") as HTMLInputElement)?.value.trim();
  const delta = Number((document.getElementById("new-option-delta") as HTMLInputElement)?.value || 0);
  if (!name) { showToast("Name required", "Give the option a name.", "warning"); return; }
  if (!Number.isFinite(delta)) { showToast("Check the price change", "Enter a valid number.", "warning"); return; }
  try {
    await apiJson("/api/menu-options/", { method: "POST", body: JSON.stringify({ item: itemId, name, price_delta: Math.round(delta * 100) / 100 }) });
    showToast("Option added", name, "success");
    await refreshManagerMenu();
    const item = mgrMenuItems?.find((candidate) => candidate.id === itemId);
    if (item) itemOptionsModal(item);
  } catch (error) {
    showToast("Could not add option", errorMessage(error, "Try again."), "danger");
  }
}

async function toggleItemOption(optionId: number, next: boolean, itemId: number): Promise<void> {
  try {
    await apiJson(`/api/menu-options/${optionId}/`, { method: "PATCH", body: JSON.stringify({ active: next }) });
    await refreshManagerMenu();
    const item = mgrMenuItems?.find((candidate) => candidate.id === itemId);
    if (item) itemOptionsModal(item);
  } catch (error) {
    showToast("Could not update option", errorMessage(error, "Try again."), "danger");
  }
}

async function deleteItemOption(optionId: number, itemId: number): Promise<void> {
  try {
    await apiJson(`/api/menu-options/${optionId}/`, { method: "DELETE" });
    showToast("Option removed", "It no longer appears when ordering.", "info");
    await refreshManagerMenu();
    const item = mgrMenuItems?.find((candidate) => candidate.id === itemId);
    if (item) itemOptionsModal(item);
  } catch (error) {
    showToast("Could not delete option", errorMessage(error, "Try again."), "danger");
  }
}

async function addItemAddon(itemId: number): Promise<void> {
  const name = (document.getElementById("new-addon-name") as HTMLInputElement)?.value.trim();
  const price = Number((document.getElementById("new-addon-price") as HTMLInputElement)?.value || 0);
  if (!name) { showToast("Name required", "Give the add-on a name.", "warning"); return; }
  if (!Number.isFinite(price) || price < 0) { showToast("Check the price", "Enter a price of 0 or more.", "warning"); return; }
  try {
    await apiJson("/api/menu-addons/", { method: "POST", body: JSON.stringify({ item: itemId, name, price: Math.round(price * 100) / 100 }) });
    showToast("Add-on added", name, "success");
    await refreshManagerMenu();
    const item = mgrMenuItems?.find((candidate) => candidate.id === itemId);
    if (item) itemOptionsModal(item);
  } catch (error) {
    showToast("Could not add add-on", errorMessage(error, "Try again."), "danger");
  }
}

async function toggleItemAddon(addonId: number, next: boolean, itemId: number): Promise<void> {
  try {
    await apiJson(`/api/menu-addons/${addonId}/`, { method: "PATCH", body: JSON.stringify({ active: next }) });
    await refreshManagerMenu();
    const item = mgrMenuItems?.find((candidate) => candidate.id === itemId);
    if (item) itemOptionsModal(item);
  } catch (error) {
    showToast("Could not update add-on", errorMessage(error, "Try again."), "danger");
  }
}

async function deleteItemAddon(addonId: number, itemId: number): Promise<void> {
  try {
    await apiJson(`/api/menu-addons/${addonId}/`, { method: "DELETE" });
    showToast("Add-on removed", "It no longer appears when ordering.", "info");
    await refreshManagerMenu();
    const item = mgrMenuItems?.find((candidate) => candidate.id === itemId);
    if (item) itemOptionsModal(item);
  } catch (error) {
    showToast("Could not delete add-on", errorMessage(error, "Try again."), "danger");
  }
}

/* ── Image cropper (Part 3B) ────────────────────────────────────────────────
 * Canvas-based: the canvas itself is the crop frame. The photo is drawn
 * beneath it and can be dragged (pan), zoomed (slider) and rotated in 90°
 * steps; "Reset" restores the default centred square. "Use this photo" bakes
 * the current view into a fresh canvas at 2.5× resolution and hands the
 * resulting JPEG blob back to the item/category form as pendingImageBlob. */
function openCropperForFile(file: File, target: "item" | "category"): void {
  if (!file.type.startsWith("image/")) { showToast("Not an image", "Please choose an image file.", "warning"); return; }
  if (file.size > 8 * 1024 * 1024) { showToast("Photo too large", "Please choose an image under 8 MB.", "warning"); return; }
  const draft = target === "item" ? readMenuItemDraft() : readCategoryDraft();
  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    cropper = {
      target, draft, img, objectUrl,
      naturalW: img.naturalWidth, naturalH: img.naturalHeight,
      zoom: 1, rotation: 0, offsetX: 0, offsetY: 0, baseScale: 1,
      shape: "square", dragging: false, lastX: 0, lastY: 0,
    };
    recomputeCropperBaseScale();
    openCropperModal();
  };
  img.onerror = () => { URL.revokeObjectURL(objectUrl); showToast("Could not load photo", "Try a different image file.", "danger"); };
  img.src = objectUrl;
}

function cropperEffectiveSize(): { w: number; h: number } {
  if (!cropper) return { w: 0, h: 0 };
  const swapped = cropper.rotation % 180 !== 0;
  return swapped ? { w: cropper.naturalH, h: cropper.naturalW } : { w: cropper.naturalW, h: cropper.naturalH };
}

function recomputeCropperBaseScale(): void {
  if (!cropper) return;
  const box = CROP_BOX[cropper.shape];
  const { w, h } = cropperEffectiveSize();
  cropper.baseScale = Math.max(box.w / w, box.h / h);
}

function clampCropperOffset(): void {
  if (!cropper) return;
  const box = CROP_BOX[cropper.shape];
  const { w, h } = cropperEffectiveSize();
  const totalScale = cropper.baseScale * cropper.zoom;
  const maxX = Math.max(0, (w * totalScale - box.w) / 2);
  const maxY = Math.max(0, (h * totalScale - box.h) / 2);
  cropper.offsetX = Math.min(maxX, Math.max(-maxX, cropper.offsetX));
  cropper.offsetY = Math.min(maxY, Math.max(-maxY, cropper.offsetY));
}

function drawCropper(): void {
  if (!cropper) return;
  const canvas = document.getElementById("cropper-canvas") as HTMLCanvasElement | null;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  const box = CROP_BOX[cropper.shape];
  ctx.clearRect(0, 0, box.w, box.h);
  ctx.save();
  ctx.translate(box.w / 2 + cropper.offsetX, box.h / 2 + cropper.offsetY);
  ctx.rotate((cropper.rotation * Math.PI) / 180);
  const totalScale = cropper.baseScale * cropper.zoom;
  ctx.scale(totalScale, totalScale);
  ctx.drawImage(cropper.img, -cropper.naturalW / 2, -cropper.naturalH / 2);
  ctx.restore();
}

function exportCropperBlob(): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!cropper) { resolve(null); return; }
    const box = CROP_BOX[cropper.shape];
    const EXPORT_SCALE = 2.5;
    const out = document.createElement("canvas");
    out.width = Math.round(box.w * EXPORT_SCALE);
    out.height = Math.round(box.h * EXPORT_SCALE);
    const ctx = out.getContext("2d");
    if (!ctx) { resolve(null); return; }
    ctx.save();
    ctx.translate(out.width / 2 + cropper.offsetX * EXPORT_SCALE, out.height / 2 + cropper.offsetY * EXPORT_SCALE);
    ctx.rotate((cropper.rotation * Math.PI) / 180);
    ctx.scale(cropper.baseScale * cropper.zoom * EXPORT_SCALE, cropper.baseScale * cropper.zoom * EXPORT_SCALE);
    ctx.drawImage(cropper.img, -cropper.naturalW / 2, -cropper.naturalH / 2);
    ctx.restore();
    out.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

function openCropperModal(): void {
  if (!cropper) return;
  const box = CROP_BOX[cropper.shape];
  showModal(`<div class="modal-card note-modal mgr-modal cropper-modal">
    <div class="modal-header"><div><span class="eyebrow">Manager tools</span><h2>Adjust photo</h2></div><button class="close-button" data-action="cropper-cancel">×</button></div>
    <div class="cropper-shape-row">
      <button class="outline-button ${cropper.shape === "square" ? "active" : ""}" data-action="cropper-shape" data-shape="square">Square</button>
      <button class="outline-button ${cropper.shape === "wide" ? "active" : ""}" data-action="cropper-shape" data-shape="wide">Wide</button>
    </div>
    <div class="cropper-stage"><canvas id="cropper-canvas" width="${box.w}" height="${box.h}"></canvas></div>
    <label class="field-label cropper-zoom-label">Zoom<input id="cropper-zoom" type="range" min="1" max="3" step="0.01" value="${cropper.zoom}" /></label>
    <div class="cropper-controls">
      <button class="outline-button" data-action="cropper-rotate">⟳ Rotate</button>
      <button class="outline-button" data-action="cropper-reset">Reset</button>
    </div>
    <p class="mgr-hint">Drag the photo to reposition it — it saves exactly as shown in the frame.</p>
    <div class="mgr-modal-actions"><button class="outline-button" data-action="cropper-cancel">Cancel</button><button class="primary-button" data-action="cropper-save">Use this photo</button></div>
  </div>`);
  drawCropper();
}

function reopenCropperParentModal(): void {
  if (!cropper) { closeModal(); return; }
  const { target, draft } = cropper;
  const objectUrl = cropper.objectUrl;
  cropper = null;
  URL.revokeObjectURL(objectUrl);
  if (target === "item") {
    const itemDraft = draft as MenuItemDraftValues;
    const existing = itemDraft.existingId ? mgrMenuItems?.find((candidate) => candidate.id === itemDraft.existingId) : undefined;
    menuItemModal(existing, itemDraft);
  } else {
    const catDraft = draft as CategoryDraftValues;
    const existing = catDraft.existingId ? mgrCategories?.find((candidate) => candidate.id === catDraft.existingId) : undefined;
    categoryModal(existing, catDraft);
  }
}

async function saveCropperResult(): Promise<void> {
  if (!cropper) return;
  const blob = await exportCropperBlob();
  if (!blob) { showToast("Could not process photo", "Try a different image.", "danger"); return; }
  const previewUrl = URL.createObjectURL(blob);
  const target = cropper.target;
  if (target === "item") {
    if (pendingItemImagePreviewUrl) URL.revokeObjectURL(pendingItemImagePreviewUrl);
    pendingItemImageBlob = blob;
    pendingItemImagePreviewUrl = previewUrl;
  } else {
    if (pendingCategoryImagePreviewUrl) URL.revokeObjectURL(pendingCategoryImagePreviewUrl);
    pendingCategoryImageBlob = blob;
    pendingCategoryImagePreviewUrl = previewUrl;
  }
  reopenCropperParentModal();
}

async function toggleMenuItemActive(id: number, next: boolean): Promise<void> {
  try {
    await apiJson(`/api/menu/${id}/`, { method: "PATCH", body: JSON.stringify({ active: next }) });
    showToast(next ? "Item activated" : "Item deactivated", next ? "Visible on the customer menu." : "Hidden from the customer menu.", "info");
    await refreshManagerMenu();
  } catch (error) {
    showToast("Could not update item", errorMessage(error, "Try again."), "danger");
  }
}

async function toggleMenuItemSoldOut(id: number): Promise<void> {
  try {
    const updated = await apiJson<ApiMgrMenuItem>(`/api/menu/${id}/toggle_availability/`, { method: "POST" });
    showToast(updated.sold_out ? "Marked sold out" : "Back in stock", updated.name, "info");
    await refreshManagerMenu();
  } catch (error) {
    showToast("Could not update stock", errorMessage(error, "Try again."), "danger");
  }
}

async function deleteMenuItem(id: number): Promise<void> {
  try {
    const result = await apiJson<{ detail?: string } | undefined>(`/api/menu/${id}/`, { method: "DELETE" });
    closeModal();
    showToast(result?.detail ? "Item deactivated" : "Item deleted", result?.detail || "Removed from the menu.", "info");
    await refreshManagerMenu();
  } catch (error) {
    showToast("Could not delete item", errorMessage(error, "Try again."), "danger");
  }
}

// ── Tables: edit ─────────────────────────────────────────────────────────────

function editTableModal(id: number): void {
  const table = mgrTables?.find((candidate) => candidate.id === id);
  if (!table) return;
  showModal(`<div class="modal-card note-modal mgr-modal">
    <div class="modal-header"><div><span class="eyebrow">Manager tools · live</span><h2>Edit Table ${escapeHtml(table.number)}</h2></div><button class="close-button" data-action="close-modal">×</button></div>
    <label class="field-label">Table number<input id="edit-table-number" maxlength="12" value="${escapeHtml(table.number)}" /></label>
    <div class="form-row">
      <label class="field-label">Seats<input id="edit-table-seats" type="number" min="1" step="1" value="${table.seats}" /></label>
      <label class="field-label">Location<input id="edit-table-location" maxlength="100" value="${escapeHtml(table.location)}" /></label>
    </div>
    <label class="check-option"><input type="checkbox" id="edit-table-active" ${table.active ? "checked" : ""} /><span>Active — in service and scannable by customers</span></label>
    <p class="mgr-hint">The table keeps its QR code, so printed QR codes stay valid after an edit.</p>
    <button class="primary-button wide" data-action="save-edit-table" data-table="${table.id}">Save changes</button>
  </div>`);
}

async function saveEditedTable(id: number): Promise<void> {
  const number = (document.getElementById("edit-table-number") as HTMLInputElement)?.value.trim();
  const seats = Number((document.getElementById("edit-table-seats") as HTMLInputElement)?.value || 0);
  const location = (document.getElementById("edit-table-location") as HTMLInputElement)?.value.trim();
  const active = (document.getElementById("edit-table-active") as HTMLInputElement)?.checked ?? true;
  if (!number || !location) { showToast("Complete table details", "Number and location are required.", "warning"); return; }
  if (!Number.isInteger(seats) || seats < 1) { showToast("Check the seats", "A table needs at least 1 seat.", "warning"); return; }
  try {
    await apiJson(`/api/tables/${id}/`, { method: "PATCH", body: JSON.stringify({ number, seats, location, active }) });
    closeModal();
    showToast("Table updated", `Table ${number} · ${seats} seats · ${location}`, "success");
    loadManagerTables();
  } catch (error) {
    showToast("Could not update table", errorMessage(error, "Try again."), "danger");
  }
}

// ── Employees: edit ──────────────────────────────────────────────────────────

function employmentLabel(member: ApiStaffMember): string {
  if (!member.start_date && !member.end_date) return "—";
  return `${escapeHtml(member.start_date || "—")} → ${escapeHtml(member.end_date || "present")}`;
}

function editStaffModal(id: number): void {
  const member = mgrStaff?.find((candidate) => candidate.id === id);
  if (!member) return;
  const isSelf = authSession?.staffId === member.id;
  const roles: Role[] = ["CASHIER", "WAITER", "KITCHEN", "MANAGER"];
  showModal(`<div class="modal-card note-modal mgr-modal">
    <div class="modal-header"><div><span class="eyebrow">@${escapeHtml(member.username)}</span><h2>Edit ${escapeHtml(member.full_name)}</h2></div><button class="close-button" data-action="close-modal">×</button></div>
    <div class="form-row">
      <label class="field-label">Role<select id="edit-staff-role" ${isSelf ? "disabled" : ""}>${roles.map((role) => `<option value="${role}" ${role === member.role ? "selected" : ""}>${formatStatus(role)}</option>`).join("")}</select></label>
      <label class="field-label">Base salary (EGP)<input id="edit-staff-salary" type="number" min="0" step="0.01" value="${Number(member.salary).toFixed(2)}" /></label>
    </div>
    <label class="field-label">Phone<input id="edit-staff-phone" maxlength="32" value="${escapeHtml(member.phone || "")}" /></label>
    <div class="form-row">
      <label class="field-label">Start date<input id="edit-staff-start" type="date" value="${escapeHtml(member.start_date || "")}" /></label>
      <label class="field-label">End date<input id="edit-staff-end" type="date" value="${escapeHtml(member.end_date || "")}" /></label>
    </div>
    <div class="form-row">
      <label class="field-label">Shift start<input id="edit-staff-shift-start" type="time" value="${escapeHtml((member.start_time || "").slice(0, 5))}" /></label>
      <label class="field-label">Shift end<input id="edit-staff-shift-end" type="time" value="${escapeHtml((member.end_time || "").slice(0, 5))}" /></label>
    </div>
    <label class="check-option"><input type="checkbox" id="edit-staff-active" ${member.active ? "checked" : ""} ${isSelf ? "disabled" : ""} /><span>Active — can sign in and appears on the roster</span></label>
    ${isSelf ? `<p class="mgr-hint">This is your own account, so your role and active status are locked to avoid locking yourself out.</p>` : ""}
    <button class="primary-button wide" data-action="save-edit-staff" data-staff="${member.id}">Save changes</button>
  </div>`);
}

async function saveEditedStaff(id: number): Promise<void> {
  const role = (document.getElementById("edit-staff-role") as HTMLSelectElement)?.value;
  const salaryText = (document.getElementById("edit-staff-salary") as HTMLInputElement)?.value.trim();
  const salary = Number(salaryText);
  const phone = (document.getElementById("edit-staff-phone") as HTMLInputElement)?.value.trim() || "";
  const startDate = (document.getElementById("edit-staff-start") as HTMLInputElement)?.value || "";
  const endDate = (document.getElementById("edit-staff-end") as HTMLInputElement)?.value || "";
  const shiftStart = (document.getElementById("edit-staff-shift-start") as HTMLInputElement)?.value || "";
  const shiftEnd = (document.getElementById("edit-staff-shift-end") as HTMLInputElement)?.value || "";
  const active = (document.getElementById("edit-staff-active") as HTMLInputElement)?.checked ?? true;
  if (salaryText === "" || !Number.isFinite(salary) || salary < 0) { showToast("Check the salary", "Enter a salary of 0 or more.", "warning"); return; }
  if (startDate && endDate && endDate < startDate) { showToast("Check the dates", "The end date cannot be before the start date.", "warning"); return; }
  if (shiftStart && shiftEnd && shiftEnd <= shiftStart) { showToast("Check the shift times", "Shift end must be after shift start.", "warning"); return; }
  try {
    await apiJson(`/api/staff/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ role, salary: Math.round(salary * 100) / 100, phone, start_date: startDate || null, end_date: endDate || null, start_time: shiftStart || null, end_time: shiftEnd || null, active }),
    });
    closeModal();
    showToast("Employee updated", "Changes saved to the roster.", "success");
    loadManagerStaff();
  } catch (error) {
    showToast("Could not update employee", errorMessage(error, "Try again."), "danger");
  }
}

// ── Overview: live /api/analytics/ ───────────────────────────────────────────

const sourceNames: Record<string, string> = { DINE_IN_QR: "Dine-in (QR)", WEBSITE: "Website", TAKEAWAY: "Takeaway" };

function analyticsBars(rows: { label: string; value: number; display: string }[]): string {
  if (!rows.length) return `<p class="mgr-hint">No data yet.</p>`;
  const max = Math.max(...rows.map((row) => row.value), 1);
  return `<div class="mgr-bars">${rows.map((row) => `<div class="mgr-bar-row"><span class="mgr-bar-label" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span><span class="mgr-bar-track"><i style="width:${Math.max(3, (row.value / max) * 100).toFixed(1)}%"></i></span><b>${escapeHtml(row.display)}</b></div>`).join("")}</div>`;
}

function hourlyChart(distribution: { hour: number; count: number }[]): string {
  if (!distribution.length) return `<p class="mgr-hint">No orders yet.</p>`;
  const byHour = new Map(distribution.map((row) => [row.hour, row.count]));
  const max = Math.max(...distribution.map((row) => row.count), 1);
  const peak = distribution.reduce((best, row) => (row.count > best.count ? row : best), distribution[0]);
  const quiet = distribution.reduce((best, row) => (row.count < best.count ? row : best), distribution[0]);
  const hourLabel = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;
  const bars = Array.from({ length: 24 }, (_, hour) => {
    const count = byHour.get(hour) || 0;
    return `<i class="${count === peak.count && count > 0 ? "peak" : ""}" style="height:${count ? Math.max(6, (count / max) * 100) : 2}%" title="${hourLabel(hour)} · ${count} order${count === 1 ? "" : "s"}"></i>`;
  }).join("");
  return `<div class="mgr-hours">${bars}</div><div class="chart-labels"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
    <p class="mgr-hint">Busiest hour: <b>${hourLabel(peak.hour)}</b> (${peak.count} order${peak.count === 1 ? "" : "s"}) · Quietest hour with orders: <b>${hourLabel(quiet.hour)}</b> (${quiet.count}). Hours follow the server clock.</p>`;
}

function renderManagerOverview(): string {
  const tableCount = mgrTables?.length ?? null;
  const occupied = mgrTables?.filter((t) => t.status !== "AVAILABLE").length ?? null;
  const activeOffers = mgrOffers?.filter((o) => o.is_currently_active).length ?? null;
  const staffCount = mgrStaff?.filter((s) => s.active).length ?? null;
  const a = mgrAnalytics;
  const livePanels = a ? `
    <div class="mgr-panels">
      <section class="insight-card mgr-panel"><span class="eyebrow">Best sellers</span><h3>Top dishes by quantity</h3>${analyticsBars(a.best_sellers.map((row) => ({ label: row.name_snapshot, value: row.qty, display: `${row.qty} sold` })))}</section>
      <section class="insight-card mgr-panel"><span class="eyebrow">Categories</span><h3>Best-selling categories</h3>${analyticsBars(a.best_categories.map((row) => ({ label: row.menu_item__category__name || "Uncategorised", value: row.qty, display: `${row.qty} sold` })))}</section>
      <section class="insight-card mgr-panel"><span class="eyebrow">Tables</span><h3>Paid revenue by table</h3>${analyticsBars(a.table_revenue.map((row) => ({ label: `Table ${row.order__session__table__number}`, value: Number(row.revenue || 0), display: money(Number(row.revenue || 0)) })))}</section>
      <section class="insight-card mgr-panel"><span class="eyebrow">Channels</span><h3>Orders by source</h3>${analyticsBars(a.orders_by_source.map((row) => ({ label: sourceNames[row.source] || formatStatus(row.source), value: row.count, display: `${row.count} order${row.count === 1 ? "" : "s"}` })))}</section>
      <section class="insight-card mgr-panel mgr-panel-wide"><span class="eyebrow">Busy &amp; slow hours</span><h3>Orders by hour of day</h3>${hourlyChart(a.hourly_distribution)}</section>
    </div>` : `<div class="empty-state staff-empty compact">${mgrAnalyticsError ? `<span>!</span><p>${escapeHtml(mgrAnalyticsError)}</p><button class="outline-button" data-action="refresh-analytics">Retry</button>` : `<span class="spinner"></span><p>Loading live analytics…</p>`}</div>`;
  return `<div class="staff-view manager-workspace">
    <div class="panel-heading"><div><span class="eyebrow">Live analytics · /api/analytics/</span><h2>How the café is doing.</h2></div><button class="outline-button" data-action="refresh-analytics" ${mgrAnalyticsLoading ? "disabled" : ""}>${mgrAnalyticsLoading ? `<span class="spinner"></span>Refreshing…` : "↻ Refresh"}</button></div>
    ${a && mgrAnalyticsError ? `<div class="empty-state staff-empty compact"><span>!</span><p>${escapeHtml(mgrAnalyticsError)} Showing the last figures received.</p></div>` : ""}
    <div class="metric-grid">
      ${metric("REVENUE", a ? money(Number(a.revenue || 0)) : "…", "All paid payments", "gold")}
      ${metric("REVENUE TODAY", a ? money(Number(a.revenue_today || 0)) : "…", "Paid so far today", "green")}
      ${metric("ORDERS", a ? `${a.order_count}` : "…", "Excluding rejected orders", "orange")}
      ${metric("ACTIVE TABLES", a ? `${a.active_tables}` : "…", tableCount === null ? "Not available" : `of ${tableCount} tables in use`)}
    </div>
    <div class="metric-grid mgr-metric-row">
      ${metric("TABLES", tableCount === null ? "…" : `${tableCount}`, occupied === null ? "Loading" : `${occupied} occupied now`, "orange")}
      ${metric("ACTIVE OFFERS", activeOffers === null ? "…" : `${activeOffers}`, "Live on the customer menu", "gold")}
      ${metric("ACTIVE STAFF", a ? `${a.staff_count}` : staffCount === null ? "…" : `${staffCount}`, "Currently employed", "green")}
      ${metric("SIGNED IN AS", authSession?.username || "—", "Manager · JWT session")}
    </div>
    ${livePanels}
    <div class="insight-card highlight-card"><span class="eyebrow">Manager workspace</span><h2>Everything here is live.</h2><p>Menu, Tables, Offers, Employees, Payroll and Attendance all read and write directly to the Django database through your signed-in JWT session — use the sidebar to manage each area.</p></div>
  </div>`;
}

function showToast(title: string, body: string, tone: Notice["tone"]): void {
  const root = document.getElementById("toast-root") as HTMLElement;
  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.innerHTML = `<span class="toast-symbol">${tone === "success" ? "✓" : tone === "danger" ? "!" : "✦"}</span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(body)}</small></div><button>×</button>`;
  toast.querySelector("button")?.addEventListener("click", () => toast.remove());
  root.appendChild(toast);
  window.setTimeout(() => toast.remove(), 5000);
}

function showModal(content: string): void {
  const root = document.getElementById("modal-root") as HTMLElement;
  root.innerHTML = `<div class="modal-backdrop">${content}</div>`;
}

function openProduct(item: MenuItem): void {
  activeProduct = item;
  const extraOptions = item.category === "Pizza" ? ["Large size", "Thin crust", "Extra cheese", "Mushrooms"] : item.category === "Burgers" ? ["Double patty", "Extra cheese", "Extra sauce", "No onion", "No pickles"] : item.category === "Drinks" ? ["Less ice", "No sugar", "Extra shot"] : item.category === "Sides" ? ["Cheese dip", "Spicy sauce"] : ["Warm it up", "Extra cream"];
  const choices = [...(item.options || []).filter((option) => option.active).map((option) => `${option.name}${option.price_delta ? ` (+${money(option.price_delta)})` : ""}`), ...(item.addons || []).filter((addon) => addon.active).map((addon) => `${addon.name} (+${money(addon.price)})`)];
  showModal(`<div class="modal-card product-modal"><div class="modal-product-visual visual-${item.category.toLowerCase()}">${productImage(item)}</div><div class="modal-product-content"><div class="modal-header"><div><span class="eyebrow">${item.category}</span><h2>${item.name}</h2><p>${item.description}</p><p><b>Ingredients:</b> ${item.ingredients}</p></div><button class="close-button" data-action="close-modal">×</button></div><div class="option-group"><label>Make it yours <small>Select any</small></label><div class="option-grid">${choices.map((option) => `<label class="check-option"><input type="checkbox" value="${escapeHtml(option.replace(/ \(\+.*/, ""))}" /><span>${escapeHtml(option)}</span></label>`).join("")}</div></div><div class="option-group"><label>Special note <small>Optional</small></label><textarea id="product-note" placeholder="Anything the kitchen should know?"></textarea></div><div class="modal-add-row"><div class="quantity"><button data-modal-quantity="-1">−</button><b id="modal-quantity">1</b><button data-modal-quantity="1">+</button></div><strong>${money(item.price)}</strong><button class="primary-button" data-action="add-product">Add to cart <span>+</span></button></div></div></div>`);
}

let modalQuantity = 1;

function priceForChoices(item: MenuItem, choices: string[]): number {
  const optionPrices = new Map((item.options || []).map((option) => [option.name, option.price_delta]));
  const addonPrices = new Map((item.addons || []).map((addon) => [addon.name, addon.price]));
  return item.price + choices.reduce(
    (sum, choice) => sum + Number(optionPrices.get(choice) || addonPrices.get(choice) || 0),
    0,
  );
}

function loginModal(): void {
   showModal(`<div class="modal-card login-modal"><button class="close-button" data-action="close-modal">×</button><span class="brand-mark large">✦</span><span class="eyebrow">Private workspace</span><h2>Welcome back, team.</h2><p>Choose a role to open the right tools for this shift.</p><div class="role-select">${(["CASHIER", "KITCHEN", "WAITER", "MANAGER"] as Role[]).map((role, index) => `<button class="${index === 0 ? "active" : ""}" data-login-role="${role}"><span>${role === "CASHIER" ? "◈" : role === "KITCHEN" ? "♨" : role === "WAITER" ? "⌂" : "✦"}</span>${formatStatus(role)}</button>`).join("")}</div><input id="login-username" placeholder="Username" autocomplete="username" /><input id="login-password" type="password" placeholder="Password" autocomplete="current-password" /><button class="primary-button wide" data-action="login">Enter workspace →</button><small>Every staff role signs in against the live Django account and receives only its permitted workspace.</small></div>`);
}

function rejectionModal(orderId: string): void {
  showModal(`<div class="modal-card rejection-modal"><div class="modal-header"><div><span class="eyebrow">Order #${orderId}</span><h2>Why can’t we make this?</h2><p>This reason will be shown to the customer so they can fix their order.</p></div><button class="close-button" data-action="close-modal">×</button></div><div class="reason-grid">${rejectionReasons.map((reason, index) => `<label class="reason-option"><input type="radio" name="reject-reason" value="${reason}" ${index === 0 ? "checked" : ""} /><span>${reason}</span></label>`).join("")}</div><textarea id="rejection-note" placeholder="Additional note (optional)"></textarea><button class="reject-button wide" data-action="confirm-reject" data-order="${orderId}">Reject order</button></div>`);
}

function paymentModal(orderId: string): void {
  const apiOrder = stfOrders.find((candidate) => String(candidate.id) === orderId);
  if (apiOrder) {
    const paid = apiOrder.payments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + Number(payment.amount), 0);
    const remaining = Math.max(0, Number(apiOrder.total) - paid);
     showModal(`<div class="modal-card payment-modal"><div class="modal-header"><div><span class="eyebrow">Order #${escapeHtml(apiOrder.number)} · Table ${apiOrder.table_number || "—"}</span><h2>Record payment</h2><p>Payment is saved to the live café API.</p></div><button class="close-button" data-action="close-modal">×</button></div><div class="payment-amount"><span>Remaining</span><strong>${money(remaining)}</strong></div><label class="payment-field-label">Amount<input id="payment-amount" type="number" min="0.01" step="0.01" value="${remaining.toFixed(2)}" /></label><div class="payment-methods">${[["CASH", "₤", "Cash", "Cash in hand"], ["CARD", "▣", "Card", "Use hosted checkout for customers"], ["VODAFONE_CASH", "⌁", "Vodafone Cash", "Payer phone required"], ["INSTAPAY", "↗", "InstaPay", "Phone and account required"]].map((method, index) => `<button class="method-choice ${index === 0 ? "active" : ""}" data-payment-method="${method[0]}"><span>${method[1]}</span><b>${method[2]}</b><small>${method[3]}</small></button>`).join("")}</div><div class="payment-method-fields"><div data-payment-fields="CASH"><small class="modal-foot">Cash payment will be recorded immediately.</small></div><div data-payment-fields="CARD" hidden><small class="modal-foot">Online card payments use Stripe Checkout. No card data is entered here.</small></div><div data-payment-fields="VODAFONE_CASH" hidden><label class="payment-field-label">Payer phone number <input id="payer-phone-vodafone" inputmode="tel" placeholder="01XXXXXXXXX" /></label></div><div data-payment-fields="INSTAPAY" hidden><label class="payment-field-label">Payer phone number <input id="payer-phone-instapay" inputmode="tel" placeholder="01XXXXXXXXX" /></label><label class="payment-field-label">Payer account number <input id="payer-account" placeholder="InstaPay account or wallet number" /></label></div></div><button class="primary-button wide" data-action="record-payment" data-order="${apiOrder.id}">Record ${money(remaining)} <span>→</span></button><small class="modal-foot">Cash and wallet payments remain manual; Stripe status comes from its verified webhook.</small></div>`);
    return;
  }
  const order = state.orders.find((candidate) => candidate.id === orderId);
  if (!order) return;
  showModal(`<div class="modal-card payment-modal"><div class="modal-header"><div><span class="eyebrow">Order #${order.id} · Table ${order.tableId}</span><h2>Pay securely</h2><p>You will finish payment on Stripe's hosted checkout page.</p></div><button class="close-button" data-action="close-modal">×</button></div><div class="payment-amount"><span>Total to pay</span><strong>${money(orderTotal(order))}</strong></div><div class="secure-payment-note">Your card number and CVV are entered only on Stripe. PM Café never receives or stores them.</div><button class="primary-button wide" data-action="start-checkout" data-order="${orderId}">Continue to secure checkout <span>↗</span></button><small class="modal-foot">After checkout, the order will refresh from the verified server payment status.</small></div>`);
}

function updateOrder(orderId: string, changes: Partial<Order>): void {
  state.orders = state.orders.map((order) => order.id === orderId ? { ...order, ...changes } : order);
  saveState();
  render();
}

function addProductToCart(): void {
  if (!activeProduct) return;
  const options = Array.from(document.querySelectorAll(".product-modal input:checked")).map((input) => (input as HTMLInputElement).value);
  const notes = (document.getElementById("product-note") as HTMLTextAreaElement)?.value || "";
  const existing = state.cart.find((item) => item.menuItemId === activeProduct?.id && item.options.join() === options.join() && item.notes === notes);
  if (existing) existing.quantity += modalQuantity;
  else state.cart = [...state.cart, { id: `cart-${Date.now()}`, menuItemId: activeProduct.id, name: activeProduct.name, image: activeProduct.image, unitPrice: priceForChoices(activeProduct, options), quantity: modalQuantity, options, notes }];
  modalQuantity = 1;
  saveState();
  closeModal();
  render();
  showToast("Added to your order", `${activeProduct.name} is in the cart.`, "success");
}

async function submitOrder(request: string): Promise<void> {
  if (!state.cart.length) {
    showToast("Your cart is empty", "Add an item before submitting.", "warning");
    return;
  }
  if (!customerSessionToken || !customerSessionId) {
    showToast("Scan your table QR first", "The order must be linked to an active table session.", "warning");
    return;
  }
  const items = state.cart.map((item) => {
    const menuItem = menu.find((candidate) => candidate.id === item.menuItemId);
    return {
      menu_item: menuItem?.apiId,
      quantity: item.quantity,
      options: item.options,
      notes: item.notes,
    };
  });
  if (items.some((item) => !item.menu_item)) {
    showToast("Menu is still loading", "Please wait for the live menu before submitting.", "warning");
    return;
  }
  const button = document.querySelector("[data-action='submit-order']") as HTMLButtonElement | null;
  if (button) { button.disabled = true; button.innerHTML = `<span class="spinner"></span> Sending…`; }
  try {
    const isResubmit = editingRejectedOrderId !== null;
    const endpoint = isResubmit
      ? `${apiBase()}/api/orders/${editingRejectedOrderId}/resubmit/`
      : `${apiBase()}/api/orders/`;
    const payload: Record<string, unknown> = {
      custom_request: decodeURIComponent(request),
      items,
    };
    if (!isResubmit) {
      payload.source = "DINE_IN_QR";
      payload.session = customerSessionId;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Table-Session": customerSessionToken },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(apiErrorMessage(body, "The order could not be submitted."));
    const order = mapApiOrderToCustomerOrder(body as ApiOrderFull);
    state.orders = [order, ...state.orders.filter((candidate) => candidate.id !== order.id)];
    state.cart = [];
    editingRejectedOrderId = null;
    state.tables = state.tables.map((table) => table.id === order.tableId ? { ...table, status: "WAITING_FOOD" } : table);
    saveState();
    closeModal();
    customerView = "orders";
    render();
    showToast(isResubmit ? "Order updated" : "Order received", `Order #${order.id} — complete payment to send it to the kitchen.`, "success");
  } catch (error) {
    if (button) { button.disabled = false; button.innerHTML = `Submit order <span>↗</span>`; }
    showToast("Could not submit order", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

async function startOnlineCheckout(orderId: string): Promise<void> {
  const order = state.orders.find((candidate) => candidate.id === orderId);
  const button = document.querySelector("[data-action='start-checkout']") as HTMLButtonElement | null;
  if (!order?.backendId || !customerSessionToken) {
    showToast("Checkout unavailable", "Refresh your table session and try again.", "warning");
    return;
  }
  if (button) { button.disabled = true; button.innerHTML = `<span class="spinner"></span> Opening secure checkout…`; }
  try {
    const response = await fetch(`${apiBase()}/api/payments/checkout/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Table-Session": customerSessionToken },
      body: JSON.stringify({ order: order.backendId }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.checkout_url) throw new Error(apiErrorMessage(body, "Online checkout could not be started."));
    window.location.assign(body.checkout_url);
  } catch (error) {
    if (button) { button.disabled = false; button.innerHTML = "Continue to secure checkout <span>↗</span>"; }
    showToast("Could not start checkout", error instanceof Error ? error.message : "Try again.", "danger");
  }
}

function printReceipt(orderId: number): void {
  const order = stfOrders.find((candidate) => candidate.id === orderId);
  if (!order) {
    showToast("Receipt unavailable", "Refresh the order board and try again.", "warning");
    return;
  }
  const paid = order.payments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const receiptWindow = window.open("", "_blank", "width=440,height=720");
  if (!receiptWindow) {
    showToast("Allow pop-ups to print", "The browser blocked the printable receipt window.", "warning");
    return;
  }
  const rows = order.items.map((item) => `<tr><td>${item.quantity}× ${escapeHtml(item.name_snapshot)}${item.options.length ? `<small>${item.options.map(escapeHtml).join(" · ")}</small>` : ""}</td><td>${money(Number(item.unit_price) * item.quantity)}</td></tr>`).join("");
  const payments = order.payments.filter((payment) => payment.status === "PAID").map((payment) => `<div><span>${formatStatus(payment.method)}</span><b>${money(Number(payment.amount))}</b></div>`).join("");
  receiptWindow.document.write(`<!doctype html><html><head><title>Receipt ${escapeHtml(order.number)}</title><style>body{width:360px;margin:24px auto;color:#241118;font:14px Arial,sans-serif}h1{text-align:center;font:700 25px Georgia,serif;margin:0 0 4px}p{margin:4px 0;color:#6f5b5d;font-size:12px}.rule{border-top:1px dashed #b9a7a2;margin:16px 0}table{width:100%;border-collapse:collapse}td{padding:8px 0;vertical-align:top}td:last-child{text-align:right;white-space:nowrap}small{display:block;color:#6f5b5d;margin-top:3px;font-size:11px}.total,.payment{display:flex;justify-content:space-between;padding:6px 0}.total{font-weight:700;font-size:17px}.payment{font-size:12px}.pm-signature{margin:24px 0 10px;text-align:right;color:#b18a45;font:22px/1 "Mercedes Signature","Segoe Script",cursive;letter-spacing:.04em}@media print{body{margin:0 auto}}</style></head><body><h1>PM Café</h1><p style="text-align:center">Customer receipt</p><div class="rule"></div><p><b>Order:</b> ${escapeHtml(order.number)}</p><p><b>Table:</b> ${escapeHtml(order.table_number || "—")}</p><p><b>Date:</b> ${new Date(order.created_at).toLocaleString()}</p><div class="rule"></div><table>${rows}</table><div class="rule"></div><div class="total"><span>Total</span><span>${money(Number(order.total))}</span></div><div class="payment"><span>Paid</span><b>${money(paid)}</b></div>${payments ? `<div class="rule"></div>${payments}` : ""}<div class="rule"></div><p style="text-align:center">Thank you for visiting PM Café.</p><div class="pm-signature" aria-label="PM signature">PM</div></body></html>`);
  receiptWindow.document.close();
  receiptWindow.focus();
  receiptWindow.onafterprint = () => receiptWindow.close();
  window.setTimeout(() => receiptWindow.print(), 250);
}

function updatePaymentFields(): void {
  const method = (document.querySelector(".method-choice.active") as HTMLElement)?.dataset.paymentMethod || "CASH";
  document.querySelectorAll<HTMLElement>("[data-payment-fields]").forEach((field) => {
    field.hidden = field.dataset.paymentFields !== method;
  });
}

function closeModal(): void {
  (document.getElementById("modal-root") as HTMLElement).innerHTML = "";
}

function handleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const actionElement = target.closest("[data-action]") as HTMLElement | null;
  const action = actionElement?.dataset.action;
  if (action === "scan") {
    if (!Array.isArray(state.tables) || !state.tables.length) state.tables = initialTables.map((table) => ({ ...table, sessions: [...(table.sessions || [])] }));
    scanCustomerTable(actionElement as HTMLButtonElement);
  } else if (action === "staff-login") loginModal();
  /* FIX (Part 1 gap): "staff-home" used to keep the old state.customerTableId around,
   * so if a customer session had ever been opened on this device, clicking the PM
   * logo from the staff sidebar could drop back into that stale customer menu
   * instead of the STAFF LOGIN / CUSTOMER QR SCAN entry page. Both actions now
   * always clear it, so the PM logo reliably returns to the entry page. */
  else if (action === "home" || action === "staff-home") { state.staffRole = null; state.customerTableId = null; clearCustomerSession(); clearAuth(); stopKitchenPolling(); stopStaffPolling(); saveState(); render(); }
  else if (action === "logout") { state.staffRole = null; clearAuth(); stopKitchenPolling(); stopStaffPolling(); saveState(); render(); }
  else if (action === "notifications") openStaffNotifications();
  else if (action === "customer-notices") showModal(`<div class="modal-card notification-modal"><div class="modal-header"><div><span class="eyebrow">Live activity</span><h2>Notifications</h2></div><button class="close-button" data-action="close-modal">×</button></div><div class="notification-list">${state.notices.filter((notice) => notice.audience === "CUSTOMER").slice(0, 12).map((notice) => `<div class="notification-row ${notice.tone}"><span>${notice.tone === "success" ? "✓" : "✦"}</span><div><strong>${escapeHtml(notice.title)}</strong><p>${escapeHtml(notice.body)}</p><small>${notice.createdAt}</small></div></div>`).join("")}</div></div>`);
  else if (action === "close-modal") closeModal();
  else if (action === "product") { const item = menu.find((candidate) => candidate.id === actionElement?.dataset.product); if (item) openProduct(item); }
  else if (action === "add-product") addProductToCart();
  else if (action === "cart") showModal(cartDetails());
  else if (action === "review") { if (state.cart.length) showModal(reviewDetails()); else showToast("Your cart is empty", "Add an item before reviewing.", "warning"); }
  else if (action === "back-cart") showModal(cartDetails());
  else if (action === "submit-order") submitOrder(actionElement?.dataset.request || "");
  else if (action === "refresh-menu") refreshMenu();
  else if (action === "approve") approveOrder(Number(actionElement.dataset.order));
  else if (action === "reject") rejectionModal(actionElement.dataset.order || "");
  else if (action === "confirm-reject") confirmRejectOrder(Number(actionElement.dataset.order));
  else if (action === "fix-order") {
    const order = state.orders.find((candidate) => candidate.id === actionElement.dataset.order);
    if (order?.backendId) {
      editingRejectedOrderId = order.backendId;
      state.cart = order.items.map((item) => ({ ...item }));
      saveState();
      customerView = "menu";
      render();
      showToast("Order ready to edit", "The rejected items are back in your cart. Submit to resubmit this order.", "warning");
    }
  } else if (action === "payment") paymentModal(actionElement.dataset.order || "");
  else if (action === "record-payment") recordPayment(Number(actionElement.dataset.order));
  else if (action === "start-checkout") startOnlineCheckout(actionElement.dataset.order || "");
  else if (action === "start-preparing") { updateOrder(actionElement.dataset.order || "", { status: "PREPARING" }); notify("Kitchen started", `Order #${actionElement.dataset.order} is being prepared.`, "info", "CUSTOMER", actionElement.dataset.order); }
  else if (action === "mark-ready") {
    const orderId = actionElement.dataset.order || "";
    const order = state.orders.find((candidate) => candidate.id === orderId);
    updateOrder(orderId, { status: "READY" });
    if (order) { notify("Order ready", `Table ${order.tableId} order is ready. Please pick it up.`, "success", "STAFF", orderId); notify("Your order is ready", "A waiter is being notified to bring it to you.", "success", "CUSTOMER", orderId); }
  } else if (action === "pickup") pickupOrder(Number(actionElement.dataset.order));
  else if (action === "deliver") deliverOrder(Number(actionElement.dataset.order));
  else if (action === "view-order") {
    const order = stfOrders.find((candidate) => candidate.id === Number(actionElement.dataset.order));
    if (order) showModal(orderDetailModal(order));
  } else if (action === "complete-order") completeOrder(Number(actionElement.dataset.order));
  else if (action === "print-receipt") printReceipt(Number(actionElement.dataset.order));
  else if (action === "mark-notification") markNotificationRead(Number(actionElement.dataset.notification));
  else if (action === "new-notification") notificationComposeModal();
  else if (action === "send-notification") sendNotification();
  else if (action === "new-note") {
    showModal(`<div class="modal-card note-modal"><div class="modal-header"><div><span class="eyebrow">Internal only</span><h2>Add a handover note</h2></div><button class="close-button" data-action="close-modal">×</button></div><textarea id="new-note" placeholder="e.g. Table 07 needs extra napkins."></textarea><select id="note-audience"><option>Manager/Admin</option><option>Cashier</option><option>Kitchen</option><option>Floor team</option></select><button class="primary-button wide" data-action="save-note">Save internal note</button></div>`);
  } else if (action === "save-note") {
    const text = (document.getElementById("new-note") as HTMLTextAreaElement)?.value.trim();
    const audience = (document.getElementById("note-audience") as HTMLSelectElement)?.value || "Manager/Admin";
    if (text) { state.notes = [{ id: `note-${Date.now()}`, text, author: formatStatus(state.staffRole || "Staff"), audience, createdAt: "Just now" }, ...state.notes]; saveState(); closeModal(); render(); showToast("Note shared", `Visible to ${audience}.`, "success"); }
  } else if (action === "add-table") {
    showModal(`<div class="modal-card note-modal"><div class="modal-header"><div><span class="eyebrow">Manager tools</span><h2>Add table & generate QR</h2></div><button class="close-button" data-action="close-modal">×</button></div><input id="new-table-number" placeholder="Table number, e.g. 11" /><input id="new-table-seats" type="number" min="1" value="4" /><select id="new-table-area"><option>Main hall</option><option>Terrace</option><option>Garden</option><option>Window</option><option>Private room</option></select><button class="primary-button wide" data-action="save-table">Create table & QR</button></div>`);
  } else if (action === "save-table") {
    const number = (document.getElementById("new-table-number") as HTMLInputElement)?.value.trim();
    const seats = Number((document.getElementById("new-table-seats") as HTMLInputElement)?.value || 4);
    const area = (document.getElementById("new-table-area") as HTMLSelectElement)?.value || "Main hall";
    if (!number || state.tables.some((table) => table.id === number.padStart(2, "0"))) { showToast("Choose a new table number", "That table already exists or is empty.", "warning"); return; }
    const id = number.padStart(2, "0"); state.tables = [...state.tables, { id, label: `Table ${id}`, seats, guests: 0, status: "AVAILABLE", token: `pm-t${id}-${Date.now().toString().slice(-3)}`, area, sessions: [] }]; saveState(); closeModal(); render(); showToast("Table created", `Table ${id} has a private QR token.`, "success");
  } else if (action === "add-staff") {
    showModal(`<div class="modal-card note-modal"><div class="modal-header"><div><span class="eyebrow">Manager tools</span><h2>Add team member</h2></div><button class="close-button" data-action="close-modal">×</button></div><input id="new-staff-name" placeholder="Full name" /><select id="new-staff-role"><option>CASHIER</option><option>WAITER</option><option>KITCHEN</option><option>MANAGER</option></select><input id="new-staff-salary" type="number" value="6000" /><button class="primary-button wide" data-action="save-staff">Add active employee</button></div>`);
  } else if (action === "save-staff") {
    const name = (document.getElementById("new-staff-name") as HTMLInputElement)?.value.trim(); const role = (document.getElementById("new-staff-role") as HTMLSelectElement)?.value as Role; const salary = Number((document.getElementById("new-staff-salary") as HTMLInputElement)?.value || 0);
    if (!name || !salary) { showToast("Complete employee details", "Name and salary are required.", "warning"); return; }
    state.staff = [...state.staff, { id: `st-${Date.now()}`, name, role, salary, start: "14:00", end: "22:00", active: true, bonuses: 0, deductions: 0, note: "New team member" }]; saveState(); closeModal(); render(); showToast("Employee added", `${name} is active in the roster.`, "success");
  } else if (action === "toggle-staff") {
    state.staff = state.staff.map((member) => member.id === actionElement.dataset.staff ? { ...member, active: !member.active } : member); saveState(); render(); showToast("Roster updated", "Employee status has been changed.", "info");
  }
  /* Part 3A: wire the Manager/Kitchen buttons to the real Django API functions
   * that already existed (saveRealTable, saveOffer, kitchenTransition, etc.)
   * but were never connected to a data-action branch here — clicking them
   * previously did nothing at all. */
  else if (action === "kitchen-refresh") loadKitchenOrders();
  else if (action === "kitchen-start") kitchenTransition(Number(actionElement.dataset.order), "start");
  else if (action === "kitchen-ready") kitchenTransition(Number(actionElement.dataset.order), "ready");
  else if (action === "kitchen-note") kitchenNoteModal(Number(actionElement.dataset.order));
  else if (action === "kitchen-save-note") saveKitchenNote(Number(actionElement.dataset.order));
  else if (action === "add-real-table") addTableModal();
  else if (action === "save-real-table") saveRealTable();
  else if (action === "delete-table") deleteRealTable(Number(actionElement.dataset.table));
  else if (action === "add-offer") addOfferModal();
  else if (action === "save-offer") saveOffer();
  else if (action === "toggle-offer") toggleOffer(Number(actionElement.dataset.offer), actionElement.dataset.next === "true");
  else if (action === "delete-offer") deleteOffer(Number(actionElement.dataset.offer));
  else if (action === "add-real-staff") addStaffModal();
  else if (action === "save-real-staff") saveRealStaff();
  else if (action === "toggle-real-staff") toggleRealStaffActive(Number(actionElement.dataset.staff));
  else if (action === "add-adjustment") addAdjustmentModal(Number(actionElement.dataset.staff));
  else if (action === "save-adjustment") saveAdjustment(Number(actionElement.dataset.staff));
  else if (action === "mark-attendance") markAttendance(Number(actionElement.dataset.staff), actionElement.dataset.status || "PRESENT");
  /* Part 3A (menu / table edit / employee edit / analytics): every branch below calls a
   * real Django endpoint through apiJson() — nothing here touches localStorage. */
  else if (action === "add-category") categoryModal();
  else if (action === "edit-category") { const c = mgrCategories?.find((x) => x.id === Number(actionElement.dataset.mgrCategory)); if (c) categoryModal(c); }
  else if (action === "save-category") saveCategory(Number(actionElement.dataset.mgrCategory) || undefined);
  else if (action === "toggle-category") toggleCategoryActive(Number(actionElement.dataset.mgrCategory), actionElement.dataset.next === "true");
  else if (action === "delete-category") confirmDeleteModal("category", Number(actionElement.dataset.mgrCategory));
  else if (action === "confirm-delete-category") deleteCategory(Number(actionElement.dataset.mgrCategory));
  else if (action === "add-menu-item") menuItemModal();
  else if (action === "edit-menu-item") { const i = mgrMenuItems?.find((x) => x.id === Number(actionElement.dataset.mgrItem)); if (i) menuItemModal(i); }
  else if (action === "save-menu-item") saveMenuItem(Number(actionElement.dataset.mgrItem) || undefined);
  else if (action === "toggle-menu-item") toggleMenuItemActive(Number(actionElement.dataset.mgrItem), actionElement.dataset.next === "true");
  else if (action === "toggle-menu-sold-out") toggleMenuItemSoldOut(Number(actionElement.dataset.mgrItem));
  else if (action === "delete-menu-item") confirmDeleteModal("menu-item", Number(actionElement.dataset.mgrItem));
  else if (action === "confirm-delete-menu-item") deleteMenuItem(Number(actionElement.dataset.mgrItem));
  else if (action === "manage-item-options") { const i = mgrMenuItems?.find((x) => x.id === Number(actionElement.dataset.mgrItem)); if (i) itemOptionsModal(i); }
  else if (action === "add-item-option") addItemOption(Number(actionElement.dataset.mgrItem));
  else if (action === "toggle-item-option") toggleItemOption(Number(actionElement.dataset.option), actionElement.dataset.next === "true", Number(actionElement.dataset.mgrItem));
  else if (action === "delete-item-option") deleteItemOption(Number(actionElement.dataset.option), Number(actionElement.dataset.mgrItem));
  else if (action === "add-item-addon") addItemAddon(Number(actionElement.dataset.mgrItem));
  else if (action === "toggle-item-addon") toggleItemAddon(Number(actionElement.dataset.addon), actionElement.dataset.next === "true", Number(actionElement.dataset.mgrItem));
  else if (action === "delete-item-addon") deleteItemAddon(Number(actionElement.dataset.addon), Number(actionElement.dataset.mgrItem));
  else if (action === "cropper-rotate") { if (cropper) { cropper.rotation = (cropper.rotation + 90) % 360; recomputeCropperBaseScale(); clampCropperOffset(); drawCropper(); } }
  else if (action === "cropper-shape") { if (cropper) { cropper.shape = (actionElement.dataset.shape as CropShape) || "square"; cropper.offsetX = 0; cropper.offsetY = 0; recomputeCropperBaseScale(); openCropperModal(); } }
  else if (action === "cropper-reset") { if (cropper) { cropper.rotation = 0; cropper.zoom = 1; cropper.offsetX = 0; cropper.offsetY = 0; cropper.shape = "square"; recomputeCropperBaseScale(); openCropperModal(); } }
  else if (action === "cropper-cancel") reopenCropperParentModal();
  else if (action === "cropper-save") saveCropperResult();
  else if (action === "edit-real-table") editTableModal(Number(actionElement.dataset.table));
  else if (action === "save-edit-table") saveEditedTable(Number(actionElement.dataset.table));
  else if (action === "edit-real-staff") editStaffModal(Number(actionElement.dataset.staff));
  else if (action === "save-edit-staff") saveEditedStaff(Number(actionElement.dataset.staff));
  else if (action === "refresh-analytics") { mgrAnalyticsTried = false; loadManagerAnalytics(); render(); }
  else if (action === "new-reservation") reservationFormModal();
  else if (action === "edit-reservation") { const r = cashReservations.find((candidate) => candidate.id === Number(actionElement.dataset.reservation)); if (r) reservationFormModal(r); }
  else if (action === "save-reservation") saveReservation(Number(actionElement.dataset.reservation) || undefined);
  else if (action === "confirm-reservation") reservationTransition(Number(actionElement.dataset.reservation), "confirm");
  else if (action === "cancel-reservation") reservationTransition(Number(actionElement.dataset.reservation), "cancel");
  else if (action === "complete-reservation") reservationTransition(Number(actionElement.dataset.reservation), "complete");
  const cartChange = target.closest("[data-cart-change]") as HTMLElement | null;
  if (cartChange) { const index = Number(cartChange.dataset.index); state.cart[index].quantity = Math.max(1, state.cart[index].quantity + Number(cartChange.dataset.cartChange)); saveState(); showModal(cartDetails()); }
  const remove = target.closest("[data-cart-remove]") as HTMLElement | null;
  if (remove) { state.cart.splice(Number(remove.dataset.cartRemove), 1); saveState(); showModal(cartDetails()); }
  const modalQty = target.closest("[data-modal-quantity]") as HTMLElement | null;
  if (modalQty) { modalQuantity = Math.max(1, modalQuantity + Number(modalQty.dataset.modalQuantity)); const quantity = document.getElementById("modal-quantity"); if (quantity) quantity.textContent = `${modalQuantity}`; }
  const category = target.closest("[data-category]") as HTMLElement | null;
  if (category) { selectedCategory = category.dataset.category as Category; safeSetStorage(CUSTOMER_CATEGORY_KEY, selectedCategory); render(); }
  const customerTab = target.closest("[data-customer-view]") as HTMLElement | null;
  if (customerTab) { customerView = customerTab.dataset.customerView as "menu" | "orders" | "bill"; render(); }
  const staffTab = target.closest("[data-staff-section]") as HTMLElement | null;
  if (staffTab) {
    staffSection = staffTab.dataset.staffSection || "overview";
    // Part 3A: opening the Manager overview always re-reads /api/analytics/ (cached figures stay visible meanwhile).
    if (state.staffRole === "MANAGER" && staffSection === "overview") mgrAnalyticsTried = false;
    render();
  }
  const mgrMenuFilterButton = target.closest("[data-mgr-menu-filter]") as HTMLElement | null;
  if (mgrMenuFilterButton) {
    const value = mgrMenuFilterButton.dataset.mgrMenuFilter || "ALL";
    mgrMenuFilter = value === "ALL" ? "ALL" : Number(value);
    render();
  }
  const loginRole = target.closest("[data-login-role]") as HTMLElement | null;
  if (loginRole) { document.querySelectorAll("[data-login-role]").forEach((button) => button.classList.remove("active")); loginRole.classList.add("active"); }
  const method = target.closest("[data-payment-method]") as HTMLElement | null;
  if (method) { document.querySelectorAll("[data-payment-method]").forEach((button) => button.classList.remove("active")); method.classList.add("active"); updatePaymentFields(); }
  const filter = target.closest("[data-cashier-filter]") as HTMLElement | null;
  if (filter) { cashierFilter = filter.dataset.cashierFilter || "ALL"; render(); }
  const reservationFilterButton = target.closest("[data-reservation-filter]") as HTMLElement | null;
  if (reservationFilterButton) { reservationFilter = reservationFilterButton.dataset.reservationFilter || "ALL"; render(); }
  const stock = target.closest("[data-stock]") as HTMLElement | null;
  if (stock) { const id = stock.dataset.stock || ""; state.availability[id] = state.availability[id] === "AVAILABLE" ? "SOLD_OUT" : "AVAILABLE"; saveState(); render(); }
  const tableState = target.closest("[data-table-state]") as HTMLElement | null;
  if (tableState) { const table = state.tables.find((candidate) => candidate.id === tableState.dataset.tableState); if (table) { table.status = tableState.dataset.nextTable as TableStatus; saveState(); render(); showToast(`${table.label} updated`, formatStatus(table.status), "info"); } }
  // Part 3A/3B: kitchen stock-toggle carries data-is-sold-out to pick mark/restock
  // (not data-action, since they toggle live menu stock rather than run a
  // one-shot modal/API action) — route them to the real API here.
  const kitchenStockBtn = target.closest("[data-kitchen-sold-out]") as HTMLElement | null;
  if (kitchenStockBtn) {
    const menuItemId = kitchenStockBtn.dataset.kitchenSoldOut || "";
    const isSoldOut = kitchenStockBtn.dataset.isSoldOut === "true";
    if (isSoldOut) kitchenRestock(menuItemId);
    else kitchenMarkSoldOut(menuItemId);
  }
}

async function handleLogin(): Promise<void> {
  const usernameField = document.getElementById("login-username") as HTMLInputElement;
  const passwordField = document.getElementById("login-password") as HTMLInputElement;
  const username = usernameField?.value.trim();
  const password = passwordField?.value.trim();
  const selected = document.querySelector("[data-login-role].active") as HTMLElement;
  const role = (selected?.dataset.loginRole || "CASHIER") as Role;
  if (!username || !password) { showToast("Enter your details", "A username and password are required.", "warning"); return; }

  // Every staff role is backed by the real Django/JWT API — every action from
  // here on reads and writes the live database.
  if (role === "MANAGER" || role === "KITCHEN" || role === "CASHIER" || role === "WAITER") {
    const loginButton = document.querySelector("[data-action='login']") as HTMLButtonElement;
    if (loginButton) { loginButton.disabled = true; loginButton.innerHTML = `<span class="spinner"></span> Signing in…`; }
    const error = await loginWithBackend(username, password, role);
    if (error) {
      if (loginButton) { loginButton.disabled = false; loginButton.textContent = "Enter workspace →"; }
      showToast("Sign-in failed", error, "danger");
      return;
    }
    state.staffRole = role;
    saveState();
    closeModal();
    staffSection = "overview";
    kitchenOrders = []; kitchenLoaded = false;
    resetManagerCaches();
    render();
    showToast(`Signed in as ${formatStatus(role)}`, "Connected to the live PM Café database.", "success");
    if (role === "KITCHEN") { loadKitchenOrders(); startKitchenPolling(); }
    if (role === "MANAGER") loadManagerTables();
    if (role === "CASHIER" || role === "WAITER") { loadStaffOrders(); loadNotifications(); startStaffPolling(); }
    if (role === "WAITER") loadStaffTables();
    return;
  }

  state.staffRole = role;
  saveState(); closeModal(); staffSection = "overview"; render(); showToast(`Signed in as ${formatStatus(state.staffRole)}`, "Your role-specific workspace is ready.", "success");
}

document.addEventListener("click", handleClick);
document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("[data-action='theme-toggle']")) {
    toggleTheme();
    return;
  }
  if (target.matches("[data-action='login']")) handleLogin();
});
document.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === "kitchen-search") { kitchenSearch = target.value; render(); const search = document.getElementById("kitchen-search") as HTMLInputElement; search?.focus(); search?.setSelectionRange(search.value.length, search.value.length); }
  if (["res-date", "res-time", "res-duration", "res-price", "res-deposit"].includes(target.id)) refreshReservationFormFields();
});
// Part 3A: Manager menu search. render() rebuilds the page, so the caret is restored
// the same way the kitchen search does it.
document.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id !== "mgr-menu-search") return;
  mgrMenuSearch = target.value;
  render();
  const search = document.getElementById("mgr-menu-search") as HTMLInputElement | null;
  search?.focus();
  search?.setSelectionRange(search.value.length, search.value.length);
});
// Part 3A: the manager tables list and the attendance date picker both drive
// the real API through a <select>/<input> "change", not a click — wire them
// to the same real functions used by the click handlers above.
document.addEventListener("change", (event) => {
  const target = event.target as HTMLElement;
  const tableStatus = target.closest("[data-mgr-table-status]") as HTMLSelectElement | null;
  if (tableStatus) updateRealTableStatus(Number(tableStatus.dataset.mgrTableStatus), tableStatus.value);
  if (target.id === "attendance-date") { mgrAttendanceDate = (target as HTMLInputElement).value; mgrAttendance = null; render(); }
  // Part 3B: a photo picked in the item/category form never uploads as-is —
  // it opens the cropper first (see openCropperForFile).
  const fileInput = target as HTMLInputElement;
  if (fileInput.id === "item-image" && fileInput.files?.[0]) openCropperForFile(fileInput.files[0], "item");
  if (fileInput.id === "cat-image" && fileInput.files?.[0]) openCropperForFile(fileInput.files[0], "category");
});
// Part 3B: the cropper's zoom slider redraws the canvas directly — no render()
// (which would rebuild the underlying page) needed for a plain crop preview.
document.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === "cropper-zoom" && cropper) {
    cropper.zoom = Number(target.value) || 1;
    clampCropperOffset();
    drawCropper();
  }
});
// Part 3B: drag-to-pan on the cropper canvas (mouse + touch).
document.addEventListener("mousedown", (event) => {
  const target = event.target as HTMLElement;
  if (target.id === "cropper-canvas" && cropper) {
    cropper.dragging = true;
    cropper.lastX = event.clientX;
    cropper.lastY = event.clientY;
  }
});
document.addEventListener("mousemove", (event) => {
  if (!cropper?.dragging) return;
  const dx = event.clientX - cropper.lastX;
  const dy = event.clientY - cropper.lastY;
  cropper.lastX = event.clientX;
  cropper.lastY = event.clientY;
  cropper.offsetX += dx;
  cropper.offsetY += dy;
  clampCropperOffset();
  drawCropper();
});
document.addEventListener("mouseup", () => { if (cropper) cropper.dragging = false; });
document.addEventListener("mouseleave", () => { if (cropper) cropper.dragging = false; });
document.addEventListener("touchstart", (event) => {
  const target = event.target as HTMLElement;
  const touch = event.touches[0];
  if (target.id === "cropper-canvas" && cropper && touch) {
    cropper.dragging = true;
    cropper.lastX = touch.clientX;
    cropper.lastY = touch.clientY;
  }
}, { passive: true });
document.addEventListener("touchmove", (event) => {
  const touch = event.touches[0];
  if (!cropper?.dragging || !touch) return;
  const dx = touch.clientX - cropper.lastX;
  const dy = touch.clientY - cropper.lastY;
  cropper.lastX = touch.clientX;
  cropper.lastY = touch.clientY;
  cropper.offsetX += dx;
  cropper.offsetY += dy;
  clampCropperOffset();
  drawCropper();
}, { passive: true });
document.addEventListener("touchend", () => { if (cropper) cropper.dragging = false; });
window.addEventListener("storage", (event) => {
  if (event.key === THEME_STORAGE_KEY) {
    applyTheme(event.newValue === "dark" ? "dark" : "light");
    render();
  }
  if (event.key === "pm-cafe-state") {
    state = loadState();
    render();
    showToast("Board updated", "Another café station changed the live session.", "info");
  }
});

/** Load all public menu data from Django; there is no client-side product catalog. */
async function hydrateMenu(): Promise<void> {
  const apiBase = String((window as any).PM_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const response = await fetch(`${apiBase}/api/menu/?active=true`);
  if (!response.ok) throw new Error(`Menu API returned ${response.status}`);
  const records = await response.json();
  menu = records.map((record: any): MenuItem => ({
    id: record.public_id,
    apiId: Number(record.id),
    name: record.name,
    category: record.category_name,
    description: record.description,
    ingredients: record.ingredients || "Ingredients available on request.",
    price: Number(record.price),
    image: record.image_url || record.image ? mediaUrl(record.image_url || record.image) : "",
    availability: record.sold_out || !record.active ? "SOLD_OUT" : "AVAILABLE",
    tags: record.is_complete_meal ? ["Complete meal"] : [record.category_name],
    options: record.options || [], addons: record.addons || [],
  }));
  categories = [...new Set(menu.map((item) => item.category))];
  const savedCategory = safeGetStorage(CUSTOMER_CATEGORY_KEY);
  selectedCategory = categories.includes(savedCategory || "")
    ? savedCategory || ""
    : categories[0] || "";
  if (selectedCategory) safeSetStorage(CUSTOMER_CATEGORY_KEY, selectedCategory);
  // Availability is now read directly from item.availability (live data);
  // state.availability is kept as a backwards-compat shim but not the source of truth.
  state.availability = Object.fromEntries(menu.map((item) => [item.id, item.availability]));
}

// Persist only the customer menu rail, and do not scroll it to the active chip:
// customers control this horizontal position themselves.
document.addEventListener(
  "scroll",
  (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (target?.matches(".menu-section .category-row"))
      safeSetStorage(CUSTOMER_CATEGORY_SCROLL_KEY, String(target.scrollLeft));
  },
  true,
);

async function refreshMenu(): Promise<void> {
  // render() replaces the whole page innerHTML, which would otherwise snap the
  // category rail back to its start — save the scroll position and reapply it
  // to the freshly-rendered rail so a Refresh doesn't jump the customer back
  // to the first category.
  const categoryScroll = (document.querySelector(".category-row") as HTMLElement | null)?.scrollLeft || 0;
  try {
    await hydrateMenu();
    render();
    const restoredRail = document.querySelector(".category-row") as HTMLElement | null;
    if (restoredRail) restoredRail.scrollLeft = categoryScroll;
    showToast("Menu refreshed", "Availability is up to date.", "success");
  } catch {
    showToast("Could not refresh menu", "Check your connection and try again.", "warning");
  }
}

function handlePaymentReturn(): void {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  if (!payment) return;
  if (payment === "success") {
    showToast("Payment submitted", "Stripe returned you to PM Café. We are waiting for the verified server confirmation.", "info");
  } else if (payment === "cancelled") {
    showToast("Payment cancelled", "No payment was marked successful. You can try checkout again.", "warning");
  }
  window.history.replaceState({}, document.title, window.location.pathname);
}

applyTheme(savedTheme());
hydrateMenu().then(() => {
  render();
  handlePaymentReturn();
}).catch((error) => {
  const root = document.getElementById("app");
  if (root) {
    root.innerHTML = `<div style="padding:40px;font-family:sans-serif;color:#321820;">
      <h2>PM Café menu is unavailable</h2>
      <p>${error instanceof Error ? escapeHtml(error.message) : "Unknown error"}</p>
      <p>Start Django, run <code>python manage.py seed_cafe</code>, then reload this page.</p>
    </div>`;
    ensureSignature();
  }
  console.error(error);
});


