/* Backend data contract for the admin console.
   Field names stay snake_case on purpose: they are the FastAPI payload keys. */

export type OrderStatus = "pending" | "confirmed" | "shipped" | "completed" | "cancelled";

export type OrderItem = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string | null;
  plant_id: number | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

export type Plant = {
  id: number;
  name: string;
  // The FastAPI schema marks every field below as Optional, so live rows can
  // carry `null` (and the create form sends `null` for empty inputs).
  scientific_name: string | null;
  category: string | null;
  image_url: string | null;
  yolo_class_id: number | null;
  care_level: number;
  // Plan Task 4 writes `beginner_friendly: boolean`, but the legacy seed stores a
  // 1-5 score there (`beginner_friendly: 5`, `: 4`, `: 3`, …) and the backend
  // agrees: `backend/app/models/plant.py` → `beginner_friendly = Column(Integer,
  // default=3)  # 新手友好度 1-5`, `backend/app/schemas/plant.py` →
  // `beginner_friendly: Optional[int] = 3`. A boolean cannot hold those values,
  // so the type follows the data. `is_toxic` is the boolean one.
  beginner_friendly: number;
  description: string | null;
  light_requirement: string | null;
  water_requirement: string | null;
  watering_tip: string | null;
  temperature_range: string | null;
  humidity_range: string | null;
  is_toxic: boolean;
  features: string[];
  survival_rate: number;
  tips: string | null;
  common_mistakes: string | null;
  fertilization?: string | null;
  repotting?: string | null;
  created_at: string;
  updated_at?: string;
};

export type User = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  /* The live backend no longer returns this field; treat it as optional and
     render "未验证" when missing. */
  is_email_verified?: boolean;
  role: string;
  created_at: string;
};

export type Order = {
  id: number;
  order_no: string;
  user_id: number;
  user: User;
  total_amount: number;
  status: OrderStatus;
  delivery_type: "express" | "pickup";
  delivery_address: string;
  contact_name: string;
  contact_phone: string;
  remark: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
};

export type Reading = {
  id?: number;
  device_code: string;
  soil_moisture: number;
  soil_temp: number;
  light_lux: number | null;
  air_temp?: number | null;
  air_humidity?: number | null;
  firmware?: string;
  ip_address?: string | null;
  created_at: string;
};

export type Thresholds = {
  moistureMin: number;
  moistureMax: number;
  tempMin: number;
  tempMax: number;
  airTempMin: number;
  airTempMax: number;
  airHumidityMin: number;
  airHumidityMax: number;
  luxMin: number;
  luxMax: number;
  alarm: boolean;
};

export type Calibration = { airRaw: number; waterRaw: number; source: string };

export type Device = {
  id: number;
  code: string;
  name: string;
  location: string | null;
  firmware: string;
  ip_address: string | null;
  report_interval: number;
  enabled: boolean;
  online?: boolean;
  plant_name?: string | null;
  last_seen: string | null;
  created_at: string;
  updated_at?: string;
  thresholds: Thresholds;
  calibration: Calibration;
  /* The list/detail endpoints only carry `latest_reading`; the console fills
     this array from `latest_reading` and the `/readings` history endpoint. */
  readings: Reading[];
};

export type Alert = {
  id: number;
  device_id?: number;
  device_code: string;
  device_name?: string;
  metric: string;
  label: string;
  value: number | null;
  threshold: number;
  direction: "below" | "above" | "near" | "missing" | "offline";
  level: "warn" | "danger";
  /* The console normalises `created_at` into `at`. */
  at: string;
  created_at?: string;
  acknowledged: boolean;
  acknowledged_at?: string | null;
  hint: string;
};

export type AdminUser = {
  id: number;
  username: string;
  email?: string;
  role: string;
  avatar_url: string | null;
};

/* ── 邮件 / 短信发送日志（/api/admin/email-logs、/api/admin/sms-logs）── */

export type EmailLog = {
  id: number;
  recipient: string;
  subject: string;
  purpose: string;
  status: "success" | "failed" | string;
  error: string;
  created_at: string;
};

export type SmsLog = {
  id: number;
  recipient: string;
  purpose: string;
  status: "success" | "failed" | string;
  error: string;
  created_at: string;
};

export type LogList<T> = {
  total: number;
  page: number;
  size: number;
  success_count: number;
  failed_count: number;
  items: T[];
};

/* ── 系统配置（GET /api/admin/system-config）── */

export type ConfigField = {
  key: string;
  label: string;
  type: "text" | "number" | "secret" | "bool" | string;
  default?: string;
  value: string;
  /** 是否已在数据库落值；secret 字段只回传这个标记，不回显明文。 */
  configured: boolean;
};

export type ConfigGroup = {
  key: string;
  title: string;
  description: string;
  fields: ConfigField[];
};

/* ── YOLO 模型（GET /api/admin/system-config/yolo/models）── */

export type YoloModelFile = {
  filename: string;
  size: number;
  uploaded_at: string;
  active: boolean;
  builtin: boolean;
};

export type YoloSummary = {
  kind: "plant" | "pest" | string;
  active: string;
  default_model: string;
  default_exists: boolean;
  allowed_exts: string[];
  max_size: number;
  models: YoloModelFile[];
};

export type AdminData = {
  products: Product[];
  plants: Plant[];
  users: User[];
  orders: Order[];
  devices: Device[];
  alerts: Alert[];
};

/* The legacy product form also sends `image_url`, so the input type keeps it. */
export type ProductInput = Pick<
  Product,
  "name" | "description" | "price" | "stock" | "plant_id" | "status" | "image_url"
>;

/* The legacy plant form sends empty strings as `null`, so the writable fields
   accept null as well. */
export type PlantInput = {
  name: string;
  scientific_name?: string | null;
  category?: string | null;
  care_level?: number;
  yolo_class_id?: number | null;
  light_requirement?: string | null;
  water_requirement?: string | null;
  watering_tip?: string | null;
  temperature_range?: string | null;
  humidity_range?: string | null;
  image_url?: string | null;
  description?: string | null;
  tips?: string | null;
  common_mistakes?: string | null;
  features?: string[];
  survival_rate?: number;
  beginner_friendly?: number;
  is_toxic?: boolean;
};

export type OrderPatch = { status: OrderStatus };
