// Auth user role
export type UserRole = 'professional' | 'client' | 'business' | 'agency';

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
  approval_status: 'draft' | 'pending' | 'approved' | 'rejected' | 'revision';
  approval_note: string | null;
  approved_at: string | null;
  kvkk_approved_at: string | null;
  is_admin: boolean;
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
// ===== MESSAGING =====

export type Conversation = {
  id: string;
  customer_id: string;
  professional_id: string;
  event_date: string | null;
  event_type: string | null;
  last_message_at: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  // Faz 8: Quote system
  message_type: 'text' | 'quote' | 'system';
  quote_id: string | null;
};

// Konuşma listesi için: karşı tarafın bilgileriyle birlikte
export type ConversationWithOther = Conversation & {
  other_user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    company_name: string | null;
    role: string;
  };
  last_message: {
    body: string;
    sender_id: string;
    created_at: string;
  } | null;
  unread_count: number;
};
export type Review = {
  id: string;
  conversation_id: string;
  customer_id: string;
  professional_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewReply = {
  id: string;
  review_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type ProfessionalRatingSummary = {
  professional_id: string;
  review_count: number;
  average_rating: number;
};
