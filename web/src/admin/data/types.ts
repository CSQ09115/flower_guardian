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
  scientific_name: string;
  category: string;
  image_url: string | null;
  yolo_class_id: number;
  care_level: number;
  // Plan Task 4 writes `beginner_friendly: boolean`, but the legacy seed stores a
  // 1-5 score there (`beginner_friendly: 5`, `: 4`, `: 3`, …) and the backend
  // agrees: `backend/app/models/plant.py` → `beginner_friendly = Column(Integer,
  // default=3)  # 新手友好度 1-5`, `backend/app/schemas/plant.py` →
  // `beginner_friendly: Optional[int] = 3`. A boolean cannot hold those values,
  // so the type follows the data. `is_toxic` is the boolean one.
  beginner_friendly: number;
  description: string;
  light_requirement: string;
  water_requirement: string;
  watering_tip: string;
  temperature_range: string;
  humidity_range: string;
  is_toxic: boolean;
  features: string[];
  survival_rate: number;
  tips: string;
  common_mistakes: string;
  created_at: string;
};

export type User = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  is_email_verified: boolean;
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
  firmware?: string;
  ip_address?: string | null;
  created_at: string;
};

export type Thresholds = {
  moistureMin: number;
  moistureMax: number;
  tempMin: number;
  tempMax: number;
  luxMin: number;
  luxMax: number;
  alarm: boolean;
};

export type Calibration = { airRaw: number; waterRaw: number; source: string };

export type Device = {
  id: number;
  code: string;
  name: string;
  location: string;
  firmware: string;
  ip_address: string | null;
  report_interval: number;
  enabled: boolean;
  last_seen: string | null;
  created_at: string;
  thresholds: Thresholds;
  calibration: Calibration;
  readings: Reading[];
};

export type Alert = {
  id: number;
  device_code: string;
  metric: string;
  label: string;
  value: number | null;
  threshold: number;
  direction: "below" | "above" | "near" | "missing" | "offline";
  level: "warn" | "danger";
  at: string;
  acknowledged: boolean;
  hint: string;
};

export type AdminUser = {
  id: number;
  username: string;
  email?: string;
  role: string;
  avatar_url: string | null;
};

export type AdminData = {
  products: Product[];
  plants: Plant[];
  users: User[];
  orders: Order[];
  devices: Device[];
  alerts: Alert[];
};

export type ProductInput = Pick<Product, "name" | "description" | "price" | "stock" | "plant_id" | "status">;

export type PlantInput = Partial<Omit<Plant, "id" | "created_at">> & { name: string };

export type OrderPatch = { status: OrderStatus };
