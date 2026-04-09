--
-- PostgreSQL database dump
--

--esta es el script de la bd de supabase

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.0

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
-- Name: business_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.business_status AS ENUM (
    'pending',
    'active',
    'inactive',
    'rejected'
);


--
-- Name: point_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.point_action AS ENUM (
    'checkin',
    'review_created',
    'like_received',
    'new_category',
    'pack_opened',
    'duplicate_stamp',
    'admin_adjustment',
    'like_removed'
);


--
-- Name: stamp_rarity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stamp_rarity AS ENUM (
    'common',
    'rare',
    'exclusive'
);


--
-- Name: translation_language; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.translation_language AS ENUM (
    'es',
    'en',
    'fr',
    'pt',
    'de',
    'zh'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'tourist',
    'owner',
    'admin'
);


--
-- Name: fn_album_progress(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_album_progress(p_user_id uuid) RETURNS TABLE(collection_id smallint, collection_slug text, collection_icon text, total_stamps bigint, obtained_stamps bigint, completion_pct numeric, is_complete boolean, reward_desc text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    sc.id                                                     AS collection_id,
    sc.slug                                                   AS collection_slug,
    sc.icon                                                   AS collection_icon,
    COUNT(s.id)                                               AS total_stamps,
    COUNT(DISTINCT us.stamp_id)                               AS obtained_stamps,
    ROUND(
      COUNT(DISTINCT us.stamp_id)::NUMERIC /
      NULLIF(COUNT(s.id), 0) * 100, 1
    )                                                         AS completion_pct,
    COUNT(s.id) = COUNT(DISTINCT us.stamp_id)                AS is_complete,
    sc.reward_desc
  FROM public.stamp_collections sc
  JOIN public.stamps s
    ON s.collection_id = sc.id
  LEFT JOIN public.user_stamps us
    ON us.stamp_id = s.id AND us.user_id = p_user_id
  GROUP BY sc.id, sc.slug, sc.icon, sc.reward_desc
  ORDER BY sc.sort_order;
$$;


--
-- Name: FUNCTION fn_album_progress(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.fn_album_progress(p_user_id uuid) IS 'Progreso del álbum por colección para un usuario específico. O(colecciones × estampas del usuario), no O(N×M global).';


--
-- Name: fn_current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_current_user_role() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: fn_decay_heat_scores(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_decay_heat_scores() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.businesses b
  SET recent_heat_score = COALESCE((
    SELECT COUNT(*)::SMALLINT
    FROM public.checkins c
    WHERE c.business_id = b.id
      AND c.created_at  >= now() - INTERVAL '6 hours'
  ), 0),
  updated_at = now()
  WHERE b.status     = 'active'
    AND b.deleted_at IS NULL;
END;
$$;


--
-- Name: FUNCTION fn_decay_heat_scores(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.fn_decay_heat_scores() IS 'Recalcula recent_heat_score en businesses. Ejecutar con pg_cron cada 5 minutos.';


--
-- Name: fn_handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_display_name TEXT;
  v_adjectives TEXT[] := ARRAY['viajero', 'garnachero', 'explorador', 'azteca', 'nomada', 'fanatico'];
BEGIN
  -- 1. Intentar obtener nombre real
  v_display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), '')
  );

  -- 2. Si no hay nombre (o es OAuth genérico), generar estilo Reddit
  IF v_display_name IS NULL OR length(v_display_name) < 2 THEN
    v_display_name := v_adjectives[floor(random() * array_length(v_adjectives, 1) + 1)] || floor(random() * 8999 + 1000)::TEXT;
  END IF;

  -- 3. Insertar con valores por defecto de tu BD (role, lang, etc)
  INSERT INTO public.profiles (id, display_name, role, preferred_lang)
  VALUES (NEW.id, v_display_name, 'tourist', 'es')
  ON CONFLICT (id) DO UPDATE 
  SET display_name = EXCLUDED.display_name -- Actualiza si el perfil estaba vacío
  WHERE profiles.display_name IS NULL;

  RETURN NEW;
END;
$$;


--
-- Name: fn_increment_checkin_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_increment_checkin_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.businesses
  SET checkin_count       = checkin_count + 1,
      recent_heat_score   = recent_heat_score + 1,
      updated_at          = now()
  WHERE id = NEW.business_id;
  RETURN NULL;
END;
$$;


--
-- Name: fn_indice_ola(double precision, double precision, integer, uuid, smallint, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_indice_ola(p_lat double precision, p_lng double precision, p_radius_m integer DEFAULT 2000, p_user_id uuid DEFAULT NULL::uuid, p_category_id smallint DEFAULT NULL::smallint, p_limit integer DEFAULT 20) RETURNS TABLE(id uuid, name text, slug text, category_slug text, category_icon text, lat double precision, lng double precision, primary_image text, avg_rating numeric, review_count integer, checkin_count integer, accepts_card boolean, ola_verified boolean, distance_m double precision, indice_ola numeric, is_open_now boolean)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_user_point GEOGRAPHY := ST_MakePoint(p_lng, p_lat)::GEOGRAPHY;
BEGIN
  RETURN QUERY
  WITH
  -- 1. Negocios dentro del radio con datos base
  nearby AS (
    SELECT
      b.id,
      b.name,
      b.slug,
      b.category_id,
      b.schedule,
      b.accepts_card,
      b.ola_verified,
      b.avg_rating,
      b.review_count,
      b.checkin_count,
      b.recent_heat_score,                                      
      ST_Distance(b.location, v_user_point)             AS distance_m,
      ST_Y(b.location::geometry)                        AS _lat,
      ST_X(b.location::geometry)                        AS _lng
    FROM public.businesses b
    WHERE b.status     = 'active'
      AND b.deleted_at IS NULL
      AND ST_DWithin(b.location, v_user_point, p_radius_m)
      AND (p_category_id IS NULL OR b.category_id = p_category_id)
  ),

  -- 2. Afinidad del usuario: categorías que más ha visitado
  user_affinity AS (
    SELECT
      b.category_id,
      COUNT(*) AS visit_count
    FROM public.checkins ci
    JOIN public.businesses b ON ci.business_id = b.id
    WHERE ci.user_id = p_user_id
    GROUP BY b.category_id
  ),

  -- 3. Normalización del calor: máximo entre los negocios del radio
  heat_max AS (
    SELECT GREATEST(MAX(recent_heat_score), 1) AS max_heat
    FROM nearby
  ),

  -- 4. Normalización de la afinidad
  affinity_max AS (
    SELECT GREATEST(MAX(visit_count), 1) AS max_affinity
    FROM user_affinity
  )

  SELECT
    n.id,
    n.name,
    n.slug,
    cat.slug                                             AS category_slug,
    cat.icon                                             AS category_icon,
    n._lat                                               AS lat,
    n._lng                                               AS lng,
    bi.storage_path                                      AS primary_image,
    n.avg_rating,
    n.review_count,
    n.checkin_count,
    n.accepts_card,
    n.ola_verified,
    n.distance_m,

    -- CÁLCULO DEL ÍNDICE OLA
    ROUND((
      -- Variable 1: Proximidad (30%)
      (1.0 - (n.distance_m / p_radius_m)) * 0.30

      -- Variable 2: Calificación promedio (25%)
      + (n.avg_rating / 5.0) * 0.25

      -- Variable 3: Abierto ahora (20%)
      + CASE
          WHEN n.schedule IS NOT NULL THEN 0.20
          ELSE 0.10  
        END

      -- Variable 4: Afinidad de categoría (15%)
      + COALESCE(
          (ua.visit_count::FLOAT / NULLIF(am.max_affinity, 0)) * 0.15,
          0.075
        )

      -- Variable 5: Calor de visitas recientes (10%)
      + (n.recent_heat_score::FLOAT / hm.max_heat) * 0.10

    )::NUMERIC, 4)                                       AS indice_ola,

    n.schedule IS NOT NULL                               AS is_open_now

  FROM nearby n
  JOIN public.categories cat ON n.category_id = cat.id
  LEFT JOIN public.business_images bi
    ON bi.business_id = n.id AND bi.is_primary = true
  LEFT JOIN user_affinity ua ON ua.category_id  = n.category_id
  LEFT JOIN affinity_max  am ON true
  LEFT JOIN heat_max      hm ON true

  ORDER BY indice_ola DESC, n.distance_m ASC
  LIMIT p_limit;
END;
$$;


--
-- Name: fn_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: fn_update_business_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_update_business_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_business_id UUID;
BEGIN
  -- Determinar el business_id afectado
  v_business_id := COALESCE(NEW.business_id, OLD.business_id);

  UPDATE public.businesses
  SET
    avg_rating   = COALESCE((
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM public.reviews
      WHERE business_id = v_business_id
        AND deleted_at IS NULL
    ), 0.00),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE business_id = v_business_id
        AND deleted_at IS NULL
    ),
    updated_at = now()
  WHERE id = v_business_id;

  RETURN NULL;
END;
$$;


--
-- Name: fn_update_point_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_update_point_balance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles
  SET point_balance = point_balance + NEW.amount,
      updated_at    = now()
  WHERE id = NEW.user_id;

  -- Si el UPDATE anterior viola CHECK (point_balance >= 0), PostgreSQL
  -- lo detecta al final del statement y hace ROLLBACK automático.
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: business_daily_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_daily_metrics (
    business_id uuid NOT NULL,
    date date NOT NULL,
    profile_views integer DEFAULT 0 NOT NULL,
    checkin_count integer DEFAULT 0 NOT NULL,
    review_count integer DEFAULT 0 NOT NULL,
    avg_rating numeric(3,2)
);


--
-- Name: business_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    storage_path text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE business_images; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.business_images IS 'Máximo 5 imágenes por negocio. is_primary = true indica la foto de portada.';


--
-- Name: business_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    storage_path text NOT NULL,
    video_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_videos_video_type_check CHECK ((video_type = ANY (ARRAY['pre_worldcup'::text, 'post_worldcup'::text])))
);


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    category_id smallint NOT NULL,
    name text NOT NULL,
    slug text GENERATED ALWAYS AS (lower(regexp_replace(name, '[^a-zA-Z0-9]+'::text, '-'::text, 'g'::text))) STORED,
    description text,
    location extensions.geography(Point,4326) NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    schedule jsonb,
    phone text,
    website text,
    accepts_card boolean DEFAULT false NOT NULL,
    status public.business_status DEFAULT 'pending'::public.business_status NOT NULL,
    ola_verified boolean DEFAULT false NOT NULL,
    ola_verified_at timestamp with time zone,
    qr_token text,
    avg_rating numeric(3,2) DEFAULT 0.00 NOT NULL,
    review_count integer DEFAULT 0 NOT NULL,
    checkin_count integer DEFAULT 0 NOT NULL,
    recent_heat_score smallint DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    folio integer,
    worldcup_finished boolean DEFAULT false NOT NULL,
    CONSTRAINT businesses_avg_rating_check CHECK (((avg_rating >= (0)::numeric) AND (avg_rating <= (5)::numeric))),
    CONSTRAINT businesses_checkin_count_check CHECK ((checkin_count >= 0)),
    CONSTRAINT businesses_description_check CHECK ((char_length(description) <= 1000)),
    CONSTRAINT businesses_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 120))),
    CONSTRAINT businesses_recent_heat_score_check CHECK ((recent_heat_score >= 0)),
    CONSTRAINT businesses_review_count_check CHECK ((review_count >= 0))
);


--
-- Name: TABLE businesses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.businesses IS 'Negocios certificados Ola México. Usa PostGIS para consultas de proximidad.';


--
-- Name: COLUMN businesses.location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.businesses.location IS 'GEOGRAPHY(POINT): longitud primero, luego latitud. ST_MakePoint(lng, lat).';


--
-- Name: COLUMN businesses.schedule; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.businesses.schedule IS 'JSON con horarios por día. Ej: {"mon":["09:00","21:00"],"sun":null}';


--
-- Name: COLUMN businesses.avg_rating; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.businesses.avg_rating IS 'Desnormalizado. Se actualiza via trigger en INSERT/UPDATE/DELETE de reviews.';


--
-- Name: COLUMN businesses.recent_heat_score; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.businesses.recent_heat_score IS 'Check-ins en las últimas 6h. Actualizado por trigger en INSERT de checkins y por pg_cron cada 5min.';


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id smallint NOT NULL,
    slug text NOT NULL,
    icon text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    CONSTRAINT categories_slug_check CHECK ((slug ~ '^[a-z0-9_]+$'::text))
);


--
-- Name: TABLE categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.categories IS 'Catálogo de tipos de negocio. Nombres en tabla translations.';


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    business_id uuid NOT NULL,
    location extensions.geography(Point,4326),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE checkins; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.checkins IS 'Un registro por visita física. Prerequisito para poder dejar reseña.';


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    user_id uuid NOT NULL,
    business_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    price numeric(8,2),
    icon text,
    is_available boolean DEFAULT true NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT menu_items_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT menu_items_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: TABLE menu_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.menu_items IS 'Especialidades del negocio. Traducciones de name en tabla translations.';


--
-- Name: pack_openings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pack_openings (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    points_spent smallint DEFAULT 200 NOT NULL,
    stamp_ids smallint[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pack_openings_points_spent_check CHECK ((points_spent > 0))
);


--
-- Name: pack_openings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pack_openings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pack_openings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pack_openings_id_seq OWNED BY public.pack_openings.id;


--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_transactions (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    amount smallint NOT NULL,
    action public.point_action NOT NULL,
    ref_type text,
    ref_id text,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT point_transactions_ref_type_check CHECK ((ref_type = ANY (ARRAY['checkin'::text, 'review'::text, 'pack'::text, 'stamp'::text])))
);


--
-- Name: TABLE point_transactions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.point_transactions IS 'Ledger inmutable de puntos. Saldo = SUM(amount) WHERE user_id = ? AND created_at <= now().';


--
-- Name: point_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.point_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: point_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.point_transactions_id_seq OWNED BY public.point_transactions.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role public.user_role DEFAULT 'tourist'::public.user_role NOT NULL,
    display_name text NOT NULL,
    avatar_url text,
    preferred_lang public.translation_language DEFAULT 'es'::public.translation_language NOT NULL,
    point_balance integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_display_name_check CHECK (((char_length(display_name) >= 2) AND (char_length(display_name) <= 80))),
    CONSTRAINT profiles_point_balance_check CHECK ((point_balance >= 0))
);


--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.profiles IS 'Extiende auth.users con datos de perfil. Un registro por usuario autenticado.';


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth_key text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: review_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_likes (
    user_id uuid NOT NULL,
    review_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating smallint NOT NULL,
    body text,
    image_path text,
    language public.translation_language DEFAULT 'es'::public.translation_language NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_body_check CHECK ((char_length(body) <= 800)),
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: TABLE reviews; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reviews IS 'Reseñas verificadas. Solo usuarios con check-in previo pueden publicar.';


--
-- Name: stamp_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stamp_collections (
    id smallint NOT NULL,
    slug text NOT NULL,
    icon text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL,
    reward_desc text
);


--
-- Name: stamp_collections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stamp_collections_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stamp_collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stamp_collections_id_seq OWNED BY public.stamp_collections.id;


--
-- Name: stamp_pity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stamp_pity (
    user_id uuid NOT NULL,
    stamp_id smallint NOT NULL,
    packs_since_last smallint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stamp_pity_packs_since_last_check CHECK ((packs_since_last >= 0))
);


--
-- Name: TABLE stamp_pity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stamp_pity IS 'Packs abiertos sin obtener cada estampa. Se resetea a 0 al obtenerla.';


--
-- Name: stamps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stamps (
    id smallint NOT NULL,
    collection_id smallint NOT NULL,
    slug text NOT NULL,
    icon text NOT NULL,
    rarity public.stamp_rarity DEFAULT 'common'::public.stamp_rarity NOT NULL,
    base_probability numeric(5,4) DEFAULT 0.1500 NOT NULL,
    pity_increment numeric(5,4) DEFAULT 0.0500 NOT NULL,
    pity_threshold smallint DEFAULT 20 NOT NULL,
    exclusive_city text,
    sort_order smallint DEFAULT 0 NOT NULL,
    CONSTRAINT stamps_base_probability_check CHECK (((base_probability >= (0)::numeric) AND (base_probability <= (1)::numeric))),
    CONSTRAINT stamps_exclusive_city_check CHECK ((exclusive_city = ANY (ARRAY['cdmx'::text, 'guadalajara'::text, 'monterrey'::text]))),
    CONSTRAINT stamps_pity_increment_check CHECK (((pity_increment >= (0)::numeric) AND (pity_increment <= (1)::numeric))),
    CONSTRAINT stamps_pity_threshold_check CHECK ((pity_threshold > 0))
);


--
-- Name: TABLE stamps; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stamps IS 'Catálogo de estampas. exclusive_city != null implica check-in físico en esa ciudad.';


--
-- Name: COLUMN stamps.base_probability; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.stamps.base_probability IS 'Común: 0.15, Rara: 0.05, Exclusiva: 0.00 (no sale en sobres).';


--
-- Name: stamps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stamps_id_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stamps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stamps_id_seq OWNED BY public.stamps.id;


--
-- Name: translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translations (
    id bigint NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    field text NOT NULL,
    language public.translation_language NOT NULL,
    value text NOT NULL,
    is_ai boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT translations_entity_type_check CHECK ((entity_type = ANY (ARRAY['business'::text, 'menu_item'::text, 'category'::text, 'stamp'::text, 'collection'::text])))
);


--
-- Name: TABLE translations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.translations IS 'Caché de traducciones. Una fila por (entidad, campo, idioma). is_ai=false indica revisión humana.';


--
-- Name: translations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.translations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: translations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.translations_id_seq OWNED BY public.translations.id;


--
-- Name: user_stamps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_stamps (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    stamp_id smallint NOT NULL,
    obtained_at timestamp with time zone DEFAULT now() NOT NULL,
    source text NOT NULL,
    ref_id text,
    CONSTRAINT user_stamps_source_check CHECK ((source = ANY (ARRAY['pack'::text, 'checkin'::text])))
);


--
-- Name: user_stamps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_stamps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_stamps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_stamps_id_seq OWNED BY public.user_stamps.id;


--
-- Name: v_businesses_map; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_businesses_map AS
 SELECT b.id,
    b.name,
    b.slug,
    b.description,
    b.category_id,
    c.slug AS category_slug,
    c.icon AS category_icon,
    b.address,
    b.city,
    b.schedule,
    b.accepts_card,
    b.ola_verified,
    b.avg_rating,
    b.review_count,
    b.checkin_count,
    extensions.st_y((b.location)::extensions.geometry) AS lat,
    extensions.st_x((b.location)::extensions.geometry) AS lng,
    bi.storage_path AS primary_image,
    b.created_at
   FROM ((public.businesses b
     JOIN public.categories c ON ((b.category_id = c.id)))
     LEFT JOIN public.business_images bi ON (((bi.business_id = b.id) AND (bi.is_primary = true))))
  WHERE ((b.status = 'active'::public.business_status) AND (b.deleted_at IS NULL));


--
-- Name: VIEW v_businesses_map; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_businesses_map IS 'Negocios activos con coordenadas lat/lng separadas. Usar para queries del mapa.';


--
-- Name: v_user_points; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_user_points AS
 SELECT user_id,
    sum(amount) AS balance,
    count(*) AS transaction_count,
    max(created_at) AS last_transaction_at
   FROM public.point_transactions
  GROUP BY user_id;


--
-- Name: VIEW v_user_points; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_user_points IS 'Historial agregado de puntos por usuario. Para el saldo en tiempo real usar profiles.point_balance.';


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: pack_openings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pack_openings ALTER COLUMN id SET DEFAULT nextval('public.pack_openings_id_seq'::regclass);


--
-- Name: point_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions ALTER COLUMN id SET DEFAULT nextval('public.point_transactions_id_seq'::regclass);


--
-- Name: stamp_collections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_collections ALTER COLUMN id SET DEFAULT nextval('public.stamp_collections_id_seq'::regclass);


--
-- Name: stamps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamps ALTER COLUMN id SET DEFAULT nextval('public.stamps_id_seq'::regclass);


--
-- Name: translations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translations ALTER COLUMN id SET DEFAULT nextval('public.translations_id_seq'::regclass);


--
-- Name: user_stamps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stamps ALTER COLUMN id SET DEFAULT nextval('public.user_stamps_id_seq'::regclass);


--
-- Name: business_daily_metrics business_daily_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_daily_metrics
    ADD CONSTRAINT business_daily_metrics_pkey PRIMARY KEY (business_id, date);


--
-- Name: business_images business_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_images
    ADD CONSTRAINT business_images_pkey PRIMARY KEY (id);


--
-- Name: business_videos business_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_videos
    ADD CONSTRAINT business_videos_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_qr_token_key UNIQUE (qr_token);


--
-- Name: businesses businesses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_slug_key UNIQUE (slug);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: checkins checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, business_id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: pack_openings pack_openings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pack_openings
    ADD CONSTRAINT pack_openings_pkey PRIMARY KEY (id);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: review_likes review_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_likes
    ADD CONSTRAINT review_likes_pkey PRIMARY KEY (user_id, review_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: stamp_collections stamp_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_collections
    ADD CONSTRAINT stamp_collections_pkey PRIMARY KEY (id);


--
-- Name: stamp_collections stamp_collections_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_collections
    ADD CONSTRAINT stamp_collections_slug_key UNIQUE (slug);


--
-- Name: stamp_pity stamp_pity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_pity
    ADD CONSTRAINT stamp_pity_pkey PRIMARY KEY (user_id, stamp_id);


--
-- Name: stamps stamps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamps
    ADD CONSTRAINT stamps_pkey PRIMARY KEY (id);


--
-- Name: stamps stamps_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamps
    ADD CONSTRAINT stamps_slug_key UNIQUE (slug);


--
-- Name: translations translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translations
    ADD CONSTRAINT translations_pkey PRIMARY KEY (id);


--
-- Name: reviews uq_review_per_user_business; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT uq_review_per_user_business UNIQUE (user_id, business_id);


--
-- Name: translations uq_translation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translations
    ADD CONSTRAINT uq_translation UNIQUE (entity_type, entity_id, field, language);


--
-- Name: user_stamps uq_user_stamp_source; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stamps
    ADD CONSTRAINT uq_user_stamp_source UNIQUE (user_id, stamp_id, source, obtained_at);


--
-- Name: user_stamps user_stamps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stamps
    ADD CONSTRAINT user_stamps_pkey PRIMARY KEY (id);


--
-- Name: business_videos_business_type_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX business_videos_business_type_unique ON public.business_videos USING btree (business_id, video_type);


--
-- Name: idx_business_images_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_images_business ON public.business_images USING btree (business_id, sort_order);


--
-- Name: idx_business_images_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_business_images_primary ON public.business_images USING btree (business_id) WHERE (is_primary = true);


--
-- Name: idx_businesses_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_businesses_category ON public.businesses USING btree (category_id) WHERE ((status = 'active'::public.business_status) AND (deleted_at IS NULL));


--
-- Name: idx_businesses_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_businesses_location ON public.businesses USING gist (location);


--
-- Name: idx_businesses_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_businesses_name_trgm ON public.businesses USING gin (name extensions.gin_trgm_ops);


--
-- Name: idx_businesses_ola_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_businesses_ola_score ON public.businesses USING btree (avg_rating DESC, checkin_count DESC) WHERE ((status = 'active'::public.business_status) AND (deleted_at IS NULL));


--
-- Name: idx_businesses_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_businesses_owner ON public.businesses USING btree (owner_id);


--
-- Name: idx_businesses_status_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_businesses_status_deleted ON public.businesses USING btree (status, deleted_at) WHERE ((status = 'active'::public.business_status) AND (deleted_at IS NULL));


--
-- Name: idx_checkins_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkins_business ON public.checkins USING btree (business_id);


--
-- Name: idx_checkins_business_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkins_business_recent ON public.checkins USING btree (business_id, created_at DESC);


--
-- Name: idx_checkins_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkins_location ON public.checkins USING gist (location) WHERE (location IS NOT NULL);


--
-- Name: idx_checkins_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkins_user ON public.checkins USING btree (user_id);


--
-- Name: idx_checkins_user_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_checkins_user_business ON public.checkins USING btree (user_id, business_id);


--
-- Name: idx_daily_metrics_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_metrics_business ON public.business_daily_metrics USING btree (business_id, date DESC);


--
-- Name: idx_favorites_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_user ON public.favorites USING btree (user_id, created_at DESC);


--
-- Name: idx_menu_items_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_items_business ON public.menu_items USING btree (business_id, sort_order) WHERE (is_available = true);


--
-- Name: idx_pack_openings_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pack_openings_user ON public.pack_openings USING btree (user_id, created_at DESC);


--
-- Name: idx_point_transactions_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_point_transactions_action ON public.point_transactions USING btree (action);


--
-- Name: idx_point_transactions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_point_transactions_user ON public.point_transactions USING btree (user_id, created_at DESC);


--
-- Name: idx_profiles_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_deleted_at ON public.profiles USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_push_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_review_likes_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_likes_review ON public.review_likes USING btree (review_id);


--
-- Name: idx_reviews_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_business ON public.reviews USING btree (business_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_reviews_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_user ON public.reviews USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_stamps_collection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stamps_collection ON public.stamps USING btree (collection_id);


--
-- Name: idx_stamps_rarity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stamps_rarity ON public.stamps USING btree (rarity);


--
-- Name: idx_translations_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_translations_entity ON public.translations USING btree (entity_type, entity_id);


--
-- Name: idx_translations_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_translations_lookup ON public.translations USING btree (entity_type, entity_id, language);


--
-- Name: idx_user_stamps_stamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_stamps_stamp ON public.user_stamps USING btree (stamp_id);


--
-- Name: idx_user_stamps_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_stamps_user ON public.user_stamps USING btree (user_id);


--
-- Name: businesses trg_businesses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: checkins trg_checkins_increment_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_checkins_increment_count AFTER INSERT ON public.checkins FOR EACH ROW EXECUTE FUNCTION public.fn_increment_checkin_count();


--
-- Name: menu_items trg_menu_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: point_transactions trg_point_transactions_update_balance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_point_transactions_update_balance AFTER INSERT ON public.point_transactions FOR EACH ROW EXECUTE FUNCTION public.fn_update_point_balance();


--
-- Name: profiles trg_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: reviews trg_reviews_update_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reviews_update_rating AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.fn_update_business_rating();


--
-- Name: reviews trg_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: translations trg_translations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_translations_updated_at BEFORE UPDATE ON public.translations FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


--
-- Name: business_daily_metrics business_daily_metrics_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_daily_metrics
    ADD CONSTRAINT business_daily_metrics_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_images business_images_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_images
    ADD CONSTRAINT business_images_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_videos business_videos_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_videos
    ADD CONSTRAINT business_videos_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: businesses businesses_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: businesses businesses_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: checkins checkins_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: checkins checkins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkins
    ADD CONSTRAINT checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: favorites favorites_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: pack_openings pack_openings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pack_openings
    ADD CONSTRAINT pack_openings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: point_transactions point_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: review_likes review_likes_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_likes
    ADD CONSTRAINT review_likes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: review_likes review_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_likes
    ADD CONSTRAINT review_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: stamp_pity stamp_pity_stamp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_pity
    ADD CONSTRAINT stamp_pity_stamp_id_fkey FOREIGN KEY (stamp_id) REFERENCES public.stamps(id);


--
-- Name: stamp_pity stamp_pity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_pity
    ADD CONSTRAINT stamp_pity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: stamps stamps_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamps
    ADD CONSTRAINT stamps_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.stamp_collections(id);


--
-- Name: user_stamps user_stamps_stamp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stamps
    ADD CONSTRAINT user_stamps_stamp_id_fkey FOREIGN KEY (stamp_id) REFERENCES public.stamps(id);


--
-- Name: user_stamps user_stamps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stamps
    ADD CONSTRAINT user_stamps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: checkins Enable insert for users based on user_id; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable insert for users based on user_id" ON public.checkins FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: business_daily_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_daily_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: business_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_images ENABLE ROW LEVEL SECURITY;

--
-- Name: business_images business_images: dueño gestiona imágenes propias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "business_images: dueño gestiona imágenes propias" ON public.business_images USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: business_images business_images: lectura pública; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "business_images: lectura pública" ON public.business_images FOR SELECT USING (true);


--
-- Name: businesses businesses: admin gestión total; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "businesses: admin gestión total" ON public.businesses USING ((public.fn_current_user_role() = 'admin'::public.user_role));


--
-- Name: businesses businesses: dueño crea negocios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "businesses: dueño crea negocios" ON public.businesses FOR INSERT WITH CHECK (((owner_id = auth.uid()) AND (public.fn_current_user_role() = 'owner'::public.user_role)));


--
-- Name: businesses businesses: dueño edita sus propios negocios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "businesses: dueño edita sus propios negocios" ON public.businesses FOR UPDATE USING ((owner_id = auth.uid())) WITH CHECK ((owner_id = auth.uid()));


--
-- Name: businesses businesses: dueño lee sus propios negocios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "businesses: dueño lee sus propios negocios" ON public.businesses FOR SELECT USING ((owner_id = auth.uid()));


--
-- Name: businesses businesses: lectura pública de negocios activos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "businesses: lectura pública de negocios activos" ON public.businesses FOR SELECT USING (((status = 'active'::public.business_status) AND (deleted_at IS NULL)));


--
-- Name: checkins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

--
-- Name: checkins checkins: admin lectura total; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "checkins: admin lectura total" ON public.checkins FOR SELECT USING ((public.fn_current_user_role() = 'admin'::public.user_role));


--
-- Name: checkins checkins: dueño ve check-ins en sus negocios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "checkins: dueño ve check-ins en sus negocios" ON public.checkins FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: checkins checkins: turista crea check-ins propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "checkins: turista crea check-ins propios" ON public.checkins FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: checkins checkins: usuario lee sus propios check-ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "checkins: usuario lee sus propios check-ins" ON public.checkins FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: favorites favorites: usuario gestiona sus favoritos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "favorites: usuario gestiona sus favoritos" ON public.favorites USING ((user_id = auth.uid()));


--
-- Name: menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_items menu_items: dueño gestiona su menú; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "menu_items: dueño gestiona su menú" ON public.menu_items USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: menu_items menu_items: lectura pública; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "menu_items: lectura pública" ON public.menu_items FOR SELECT USING (true);


--
-- Name: business_daily_metrics metrics: admin lectura total; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "metrics: admin lectura total" ON public.business_daily_metrics FOR SELECT USING ((public.fn_current_user_role() = 'admin'::public.user_role));


--
-- Name: business_daily_metrics metrics: dueño ve métricas de sus negocios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "metrics: dueño ve métricas de sus negocios" ON public.business_daily_metrics FOR SELECT USING ((business_id IN ( SELECT businesses.id
   FROM public.businesses
  WHERE (businesses.owner_id = auth.uid()))));


--
-- Name: pack_openings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pack_openings ENABLE ROW LEVEL SECURITY;

--
-- Name: pack_openings pack_openings: solo backend inserta; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pack_openings: solo backend inserta" ON public.pack_openings FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: pack_openings pack_openings: usuario ve su historial; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pack_openings: usuario ve su historial" ON public.pack_openings FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: point_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: point_transactions points: admin lectura total; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "points: admin lectura total" ON public.point_transactions FOR SELECT USING ((public.fn_current_user_role() = 'admin'::public.user_role));


--
-- Name: point_transactions points: solo backend inserta; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "points: solo backend inserta" ON public.point_transactions FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: point_transactions points: usuario lee sus transacciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "points: usuario lee sus transacciones" ON public.point_transactions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles: admin gestión total; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles: admin gestión total" ON public.profiles USING ((public.fn_current_user_role() = 'admin'::public.user_role));


--
-- Name: profiles profiles: lectura pública de perfiles activos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles: lectura pública de perfiles activos" ON public.profiles FOR SELECT USING ((deleted_at IS NULL));


--
-- Name: profiles profiles: usuario actualiza su propio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles: usuario actualiza su propio perfil" ON public.profiles FOR UPDATE USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: push_subscriptions push: usuario gestiona sus suscripciones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "push: usuario gestiona sus suscripciones" ON public.push_subscriptions USING ((user_id = auth.uid()));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: review_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: review_likes review_likes: lectura pública; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "review_likes: lectura pública" ON public.review_likes FOR SELECT USING (true);


--
-- Name: review_likes review_likes: usuario gestiona sus likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "review_likes: usuario gestiona sus likes" ON public.review_likes USING ((user_id = auth.uid()));


--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews reviews: admin modera todas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reviews: admin modera todas" ON public.reviews USING ((public.fn_current_user_role() = 'admin'::public.user_role));


--
-- Name: reviews reviews: lectura pública de reseñas activas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reviews: lectura pública de reseñas activas" ON public.reviews FOR SELECT USING ((deleted_at IS NULL));


--
-- Name: reviews reviews: usuario crea y edita sus reseñas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reviews: usuario crea y edita sus reseñas" ON public.reviews FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: reviews reviews: usuario edita sus reseñas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reviews: usuario edita sus reseñas" ON public.reviews FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: business_daily_metrics service_role bypass all business_daily_metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all business_daily_metrics" ON public.business_daily_metrics TO service_role USING (true) WITH CHECK (true);


--
-- Name: business_images service_role bypass all business_images; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all business_images" ON public.business_images TO service_role USING (true) WITH CHECK (true);


--
-- Name: checkins service_role bypass all checkins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all checkins" ON public.checkins TO service_role USING (true) WITH CHECK (true);


--
-- Name: favorites service_role bypass all favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all favorites" ON public.favorites TO service_role USING (true) WITH CHECK (true);


--
-- Name: menu_items service_role bypass all menu_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all menu_items" ON public.menu_items TO service_role USING (true) WITH CHECK (true);


--
-- Name: pack_openings service_role bypass all pack_openings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all pack_openings" ON public.pack_openings TO service_role USING (true) WITH CHECK (true);


--
-- Name: point_transactions service_role bypass all point_transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all point_transactions" ON public.point_transactions TO service_role USING (true) WITH CHECK (true);


--
-- Name: profiles service_role bypass all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all profiles" ON public.profiles TO service_role USING (true) WITH CHECK (true);


--
-- Name: push_subscriptions service_role bypass all push_subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all push_subscriptions" ON public.push_subscriptions TO service_role USING (true) WITH CHECK (true);


--
-- Name: review_likes service_role bypass all review_likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all review_likes" ON public.review_likes TO service_role USING (true) WITH CHECK (true);


--
-- Name: reviews service_role bypass all reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all reviews" ON public.reviews TO service_role USING (true) WITH CHECK (true);


--
-- Name: stamp_pity service_role bypass all stamp_pity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all stamp_pity" ON public.stamp_pity TO service_role USING (true) WITH CHECK (true);


--
-- Name: translations service_role bypass all translations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all translations" ON public.translations TO service_role USING (true) WITH CHECK (true);


--
-- Name: user_stamps service_role bypass all user_stamps; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass all user_stamps" ON public.user_stamps TO service_role USING (true) WITH CHECK (true);


--
-- Name: businesses service_role bypass insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass insert" ON public.businesses FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: businesses service_role bypass select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass select" ON public.businesses FOR SELECT TO service_role USING (true);


--
-- Name: businesses service_role bypass update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_role bypass update" ON public.businesses FOR UPDATE TO service_role USING (true) WITH CHECK (true);


--
-- Name: stamp_pity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stamp_pity ENABLE ROW LEVEL SECURITY;

--
-- Name: stamp_pity stamp_pity: usuario lee y actualiza su pity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "stamp_pity: usuario lee y actualiza su pity" ON public.stamp_pity USING ((user_id = auth.uid()));


--
-- Name: translations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

--
-- Name: translations translations: lectura pública; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "translations: lectura pública" ON public.translations FOR SELECT USING (true);


--
-- Name: translations translations: solo backend escribe; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "translations: solo backend escribe" ON public.translations FOR INSERT WITH CHECK ((public.fn_current_user_role() = ANY (ARRAY['owner'::public.user_role, 'admin'::public.user_role])));


--
-- Name: user_stamps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_stamps ENABLE ROW LEVEL SECURITY;

--
-- Name: user_stamps user_stamps: lectura pública del álbum; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_stamps: lectura pública del álbum" ON public.user_stamps FOR SELECT USING (true);


--
-- Name: user_stamps user_stamps: solo backend inserta; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_stamps: solo backend inserta" ON public.user_stamps FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- PostgreSQL database dump complete
--


