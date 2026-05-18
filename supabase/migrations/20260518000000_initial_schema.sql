--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_role TEXT;
  user_full_name TEXT;
BEGIN
  -- raw_user_meta_data'dan rol ve isim al
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  -- Eski/yanlış rol değerlerini normalize et
  user_role := CASE
    WHEN user_role IN ('customer', 'müşteri', 'musteri') THEN 'client'
    WHEN user_role IN ('corporate', 'kurumsal')          THEN 'business'
    WHEN user_role IN ('pro', 'profesyonel')             THEN 'professional'
    WHEN user_role IN ('professional', 'client', 'business') THEN user_role
    ELSE 'client'  -- bilinmeyen değer gelirse default
  END;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, user_full_name, user_role);

  RETURN NEW;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: notify_new_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  recipient_id UUID;
BEGIN
  -- Konuşmadaki karşı tarafı bul
  SELECT
    CASE
      WHEN c.customer_id = NEW.sender_id THEN c.professional_id
      ELSE c.customer_id
    END
  INTO recipient_id
  FROM conversations c
  WHERE c.id = NEW.conversation_id;

  -- Bildirim oluştur (gönderici kendisine bildirim almasın)
  IF recipient_id IS NOT NULL AND recipient_id <> NEW.sender_id THEN
    INSERT INTO notifications (user_id, type, link, body)
    VALUES (
      recipient_id,
      'message',
      '/mesajlar/' || NEW.conversation_id,
      'Yeni mesaj aldın'
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: notify_new_review(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_review() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO notifications (user_id, type, link, body)
  VALUES (
    NEW.professional_id,
    'review',
    '/p/' || NEW.professional_id || '/yorumlar',
    'Yeni yorum aldın'
  );

  RETURN NEW;
END;
$$;


--
-- Name: notify_review_reply(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_review_reply() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  customer_user_id UUID;
  professional_user_id UUID;
BEGIN
  -- Yanıt verilen yorumun müşterisini ve profesyonelini bul
  SELECT r.customer_id, r.professional_id
  INTO customer_user_id, professional_user_id
  FROM reviews r
  WHERE r.id = NEW.review_id;

  -- Müşteriye bildirim (kendi yorumuna profesyonel yanıt verdi)
  IF customer_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, link, body)
    VALUES (
      customer_user_id,
      'review_reply',
      '/p/' || professional_user_id || '/yorumlar',
      'Yorumuna yanıt geldi'
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: touch_review_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_review_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_conversation_last_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_conversation_last_message_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_last_message_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    event_date date,
    event_type text,
    last_message_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    location text,
    guest_count integer,
    budget_range text,
    CONSTRAINT conversations_budget_range_check CHECK (((budget_range IS NULL) OR (budget_range = ANY (ARRAY['under_5k'::text, '5k_15k'::text, '15k_30k'::text, '30k_50k'::text, 'over_50k'::text, 'open'::text])))),
    CONSTRAINT conversations_different_users CHECK ((customer_id <> professional_id)),
    CONSTRAINT conversations_event_type_check CHECK (((event_type IS NULL) OR (event_type = ANY (ARRAY['wedding'::text, 'birthday'::text, 'corporate'::text, 'baby_shower'::text, 'graduation'::text, 'engagement'::text, 'circumcision'::text, 'other'::text])))),
    CONSTRAINT conversations_guest_count_check CHECK (((guest_count IS NULL) OR ((guest_count >= 0) AND (guest_count <= 100000))))
);

ALTER TABLE ONLY public.conversations REPLICA IDENTITY FULL;


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    email_notified_at timestamp with time zone,
    CONSTRAINT messages_body_check CHECK (((length(body) > 0) AND (length(body) <= 2000)))
);

ALTER TABLE ONLY public.messages REPLICA IDENTITY FULL;


--
-- Name: COLUMN messages.email_notified_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.messages.email_notified_at IS 'Email bildirimi gönderildiği zaman. NULL = henüz gönderilmedi.';


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    link text NOT NULL,
    body text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['message'::text, 'review'::text, 'review_reply'::text])))
);


--
-- Name: portfolio_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portfolio_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    media_url text NOT NULL,
    media_type text NOT NULL,
    caption text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT portfolio_items_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text])))
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    rating integer NOT NULL,
    body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: TABLE reviews; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reviews IS 'Customer reviews for professionals; requires existing conversation.';


--
-- Name: professional_rating_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.professional_rating_summary AS
 SELECT professional_id,
    count(*) AS review_count,
    round(avg(rating), 2) AS average_rating
   FROM public.reviews
  GROUP BY professional_id;


--
-- Name: VIEW professional_rating_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.professional_rating_summary IS 'Aggregated rating per professional for quick lookups in profile cards and headers.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    role text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bio text,
    phone text,
    city_id integer,
    slug text,
    is_published boolean DEFAULT false NOT NULL,
    primary_category_id integer,
    company_name text,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['professional'::text, 'client'::text, 'business'::text])))
);


--
-- Name: profile_completeness; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profile_completeness AS
 SELECT id,
    role,
        CASE
            WHEN ((full_name IS NOT NULL) AND (length(full_name) > 0)) THEN 1
            ELSE 0
        END AS has_name,
        CASE
            WHEN (avatar_url IS NOT NULL) THEN 1
            ELSE 0
        END AS has_avatar,
        CASE
            WHEN ((bio IS NOT NULL) AND (length(bio) > 20)) THEN 1
            ELSE 0
        END AS has_bio,
        CASE
            WHEN (phone IS NOT NULL) THEN 1
            ELSE 0
        END AS has_phone,
        CASE
            WHEN (city_id IS NOT NULL) THEN 1
            ELSE 0
        END AS has_city,
        CASE
            WHEN ((role = 'professional'::text) AND (primary_category_id IS NOT NULL)) THEN 1
            ELSE 0
        END AS has_primary_category,
        CASE
            WHEN ((role = 'business'::text) AND (company_name IS NOT NULL)) THEN 1
            ELSE 0
        END AS has_company
   FROM public.profiles p;


--
-- Name: review_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT review_replies_body_check CHECK ((length(TRIM(BOTH FROM body)) > 0))
);


--
-- Name: TABLE review_replies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.review_replies IS 'Professional reply to a review; one reply per review.';


--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_categories (
    id integer NOT NULL,
    slug text NOT NULL,
    name_tr text NOT NULL,
    emoji text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_categories_id_seq OWNED BY public.service_categories.id;


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    category_id integer NOT NULL,
    title text NOT NULL,
    description text,
    price_min numeric(10,2),
    price_max numeric(10,2),
    price_on_request boolean DEFAULT false NOT NULL,
    duration_hours numeric(4,1),
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT price_range_valid CHECK (((price_on_request = true) OR ((price_min IS NOT NULL) AND (price_max IS NOT NULL) AND (price_min <= price_max))))
);


--
-- Name: turkish_cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turkish_cities (
    id integer NOT NULL,
    plate_no integer NOT NULL,
    name text NOT NULL
);


--
-- Name: turkish_cities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.turkish_cities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: turkish_cities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.turkish_cities_id_seq OWNED BY public.turkish_cities.id;


--
-- Name: waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'landing'::text,
    ip_address text,
    user_agent text
);


--
-- Name: service_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories ALTER COLUMN id SET DEFAULT nextval('public.service_categories_id_seq'::regclass);


--
-- Name: turkish_cities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turkish_cities ALTER COLUMN id SET DEFAULT nextval('public.turkish_cities_id_seq'::regclass);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_unique_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_unique_pair UNIQUE (customer_id, professional_id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_user_id_professional_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_professional_id_key UNIQUE (user_id, professional_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: portfolio_items portfolio_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_items
    ADD CONSTRAINT portfolio_items_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_slug_key UNIQUE (slug);


--
-- Name: review_replies review_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_replies
    ADD CONSTRAINT review_replies_pkey PRIMARY KEY (id);


--
-- Name: review_replies review_replies_review_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_replies
    ADD CONSTRAINT review_replies_review_id_key UNIQUE (review_id);


--
-- Name: reviews reviews_conversation_id_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_conversation_id_customer_id_key UNIQUE (conversation_id, customer_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_slug_key UNIQUE (slug);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: turkish_cities turkish_cities_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turkish_cities
    ADD CONSTRAINT turkish_cities_name_key UNIQUE (name);


--
-- Name: turkish_cities turkish_cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turkish_cities
    ADD CONSTRAINT turkish_cities_pkey PRIMARY KEY (id);


--
-- Name: turkish_cities turkish_cities_plate_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turkish_cities
    ADD CONSTRAINT turkish_cities_plate_no_key UNIQUE (plate_no);


--
-- Name: waitlist waitlist_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_email_key UNIQUE (email);


--
-- Name: waitlist waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_pkey PRIMARY KEY (id);


--
-- Name: favorites_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX favorites_created_at_idx ON public.favorites USING btree (created_at DESC);


--
-- Name: favorites_professional_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX favorites_professional_id_idx ON public.favorites USING btree (professional_id);


--
-- Name: favorites_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX favorites_user_id_idx ON public.favorites USING btree (user_id);


--
-- Name: idx_conversations_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_customer ON public.conversations USING btree (customer_id, last_message_at DESC);


--
-- Name: idx_conversations_professional; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_professional ON public.conversations USING btree (professional_id, last_message_at DESC);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at);


--
-- Name: idx_messages_email_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_email_pending ON public.messages USING btree (created_at) WHERE ((email_notified_at IS NULL) AND (read_at IS NULL));


--
-- Name: idx_messages_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_unread ON public.messages USING btree (conversation_id, sender_id) WHERE (read_at IS NULL);


--
-- Name: idx_portfolio_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_portfolio_profile ON public.portfolio_items USING btree (profile_id);


--
-- Name: idx_profiles_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_city ON public.profiles USING btree (city_id) WHERE (is_published = true);


--
-- Name: idx_profiles_primary_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_primary_category ON public.profiles USING btree (primary_category_id) WHERE (is_published = true);


--
-- Name: idx_profiles_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_published ON public.profiles USING btree (is_published) WHERE (is_published = true);


--
-- Name: idx_profiles_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_slug ON public.profiles USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: idx_review_replies_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_replies_review ON public.review_replies USING btree (review_id);


--
-- Name: idx_reviews_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_customer ON public.reviews USING btree (customer_id);


--
-- Name: idx_reviews_professional; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_professional ON public.reviews USING btree (professional_id, created_at DESC);


--
-- Name: idx_services_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_category ON public.services USING btree (category_id) WHERE (is_active = true);


--
-- Name: idx_services_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_profile ON public.services USING btree (profile_id);


--
-- Name: notifications_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_created_at_idx ON public.notifications USING btree (created_at DESC);


--
-- Name: notifications_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);


--
-- Name: notifications_user_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_unread_idx ON public.notifications USING btree (user_id, read_at) WHERE (read_at IS NULL);


--
-- Name: profiles_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_email_idx ON public.profiles USING btree (email);


--
-- Name: profiles_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_role_idx ON public.profiles USING btree (role);


--
-- Name: waitlist_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waitlist_created_at_idx ON public.waitlist USING btree (created_at DESC);


--
-- Name: waitlist_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX waitlist_email_idx ON public.waitlist USING btree (email);


--
-- Name: messages messages_update_conversation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_update_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();


--
-- Name: messages on_message_insert_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_message_insert_notify AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();


--
-- Name: messages on_message_insert_update_conversation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_message_insert_update_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message_at();


--
-- Name: profiles on_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: reviews on_review_insert_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_review_insert_notify AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.notify_new_review();


--
-- Name: review_replies on_review_reply_insert_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_review_reply_insert_notify AFTER INSERT ON public.review_replies FOR EACH ROW EXECUTE FUNCTION public.notify_review_reply();


--
-- Name: review_replies trg_review_replies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_review_replies_updated_at BEFORE UPDATE ON public.review_replies FOR EACH ROW EXECUTE FUNCTION public.touch_review_updated_at();


--
-- Name: reviews trg_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.touch_review_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: services update_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversations conversations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: portfolio_items portfolio_items_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portfolio_items
    ADD CONSTRAINT portfolio_items_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.turkish_cities(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_primary_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_primary_category_id_fkey FOREIGN KEY (primary_category_id) REFERENCES public.service_categories(id) ON DELETE SET NULL;


--
-- Name: review_replies review_replies_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_replies
    ADD CONSTRAINT review_replies_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_professional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: services services_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id);


--
-- Name: services services_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reviews Customers can create reviews for their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create reviews for their conversations" ON public.reviews FOR INSERT WITH CHECK (((auth.uid() = customer_id) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = reviews.conversation_id) AND (c.customer_id = auth.uid()) AND (c.professional_id = reviews.professional_id))))));


--
-- Name: reviews Customers can delete their own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can delete their own reviews" ON public.reviews FOR DELETE USING ((auth.uid() = customer_id));


--
-- Name: reviews Customers can update their own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update their own reviews" ON public.reviews FOR UPDATE USING ((auth.uid() = customer_id)) WITH CHECK ((auth.uid() = customer_id));


--
-- Name: review_replies Professionals can delete their own replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Professionals can delete their own replies" ON public.review_replies FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.reviews r
  WHERE ((r.id = review_replies.review_id) AND (r.professional_id = auth.uid())))));


--
-- Name: review_replies Professionals can reply to their own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Professionals can reply to their own reviews" ON public.review_replies FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.reviews r
  WHERE ((r.id = review_replies.review_id) AND (r.professional_id = auth.uid())))));


--
-- Name: review_replies Professionals can update their own replies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Professionals can update their own replies" ON public.review_replies FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.reviews r
  WHERE ((r.id = review_replies.review_id) AND (r.professional_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.reviews r
  WHERE ((r.id = review_replies.review_id) AND (r.professional_id = auth.uid())))));


--
-- Name: profiles Profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);


--
-- Name: review_replies Replies are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Replies are publicly readable" ON public.review_replies FOR SELECT USING (true);


--
-- Name: reviews Reviews are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reviews are publicly readable" ON public.reviews FOR SELECT USING (true);


--
-- Name: favorites Users can add favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add favorites" ON public.favorites FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can delete own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING ((auth.uid() = id));


--
-- Name: favorites Users can remove own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove own favorites" ON public.favorites FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: favorites Users can view own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own favorites" ON public.favorites FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users delete own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notifications Users update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications Users view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: waitlist anon_can_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_can_insert ON public.waitlist FOR INSERT TO anon WITH CHECK (true);


--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_insert_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_insert_customer ON public.conversations FOR INSERT WITH CHECK ((auth.uid() = customer_id));


--
-- Name: conversations conversations_select_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_select_participant ON public.conversations FOR SELECT USING (((auth.uid() = customer_id) OR (auth.uid() = professional_id)));


--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_insert_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert_participant ON public.messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.customer_id = auth.uid()) OR (c.professional_id = auth.uid())))))));


--
-- Name: messages messages_select_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select_participant ON public.messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.customer_id = auth.uid()) OR (c.professional_id = auth.uid()))))));


--
-- Name: messages messages_update_recipient; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_update_recipient ON public.messages FOR UPDATE USING (((sender_id <> auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.customer_id = auth.uid()) OR (c.professional_id = auth.uid())))))));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: portfolio_items portfolio_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portfolio_delete_own ON public.portfolio_items FOR DELETE USING ((auth.uid() = profile_id));


--
-- Name: portfolio_items portfolio_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portfolio_insert_own ON public.portfolio_items FOR INSERT WITH CHECK ((auth.uid() = profile_id));


--
-- Name: portfolio_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

--
-- Name: portfolio_items portfolio_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portfolio_read_own ON public.portfolio_items FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: portfolio_items portfolio_read_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portfolio_read_published ON public.portfolio_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = portfolio_items.profile_id) AND (profiles.is_published = true)))));


--
-- Name: portfolio_items portfolio_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY portfolio_update_own ON public.portfolio_items FOR UPDATE USING ((auth.uid() = profile_id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_read_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_read_published ON public.profiles FOR SELECT USING ((is_published = true));


--
-- Name: review_replies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: service_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: service_categories service_categories_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_categories_read_all ON public.service_categories FOR SELECT USING (true);


--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: services services_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_delete_own ON public.services FOR DELETE USING ((auth.uid() = profile_id));


--
-- Name: services services_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_insert_own ON public.services FOR INSERT WITH CHECK ((auth.uid() = profile_id));


--
-- Name: services services_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_read_own ON public.services FOR SELECT USING ((auth.uid() = profile_id));


--
-- Name: services services_read_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_read_published ON public.services FOR SELECT USING (((is_active = true) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = services.profile_id) AND (profiles.is_published = true))))));


--
-- Name: services services_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_update_own ON public.services FOR UPDATE USING ((auth.uid() = profile_id));


--
-- Name: turkish_cities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.turkish_cities ENABLE ROW LEVEL SECURITY;

--
-- Name: turkish_cities turkish_cities_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY turkish_cities_read_all ON public.turkish_cities FOR SELECT USING (true);


--
-- Name: waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


