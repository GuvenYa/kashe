// Auth user role
export type UserRole = 'professional' | 'client' | 'business';

// Database tables
export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
  city_id: number | null;
  slug: string | null;
  is_published: boolean;
  primary_category_id: number | null;
  company_name: string | null;
  created_at: string;
  updated_at: string;
};
export type ServiceCategory = {
  id: number;
  slug: string;
  name_tr: string;
  emoji: string | null;
  sort_order: number;
  is_active: boolean;
};

export type TurkishCity = {
  id: number;
  plate_no: number;
  name: string;
};

export type Service = {
  id: string;
  profile_id: string;
  category_id: number;
  title: string;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  price_on_request: boolean;
  duration_hours: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PortfolioItem = {
  id: string;
  profile_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  sort_order: number;
  created_at: string;
};

// Composite types (joined)
export type ProfileWithCity = Profile & {
  turkish_cities: { name: string } | null;
};

export type ServiceWithCategory = Service & {
  service_categories: { name_tr: string; emoji: string | null } | null;
};