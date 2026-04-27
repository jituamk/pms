export type Property = {
  id: number;
  name: string;
  address: string;
  city: string;
  type: "apartment" | "house" | "commercial" | "land";
  units: number;
  rent: number;
  status: "available" | "occupied" | "maintenance";
  created_at?: string;
  updated_at?: string;
};

export type Tenant = {
  id: number;
  name: string;
  email: string;
  phone: string;
  property_id: number | null;
  move_in_date: string | null;
  status: "active" | "past" | "prospect";
  created_at?: string;
  updated_at?: string;
};
