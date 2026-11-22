-- ==============================================================================
-- Seed: supabase/seed.sql
-- Description: Complete Idempotent Seed Data & All 4 RBAC Role Credentials
-- Ecosystem: The Pets Club — Global AI Pet Care Platform
-- Standard: Strictly valid hexadecimal UUIDs (8-4-4-4-12) & Foreign Key Compliance
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. AUTH USERS & IDENTITIES (All 4 RBAC Roles + Pending Review Accounts)
-- Default Password for all demo accounts: Password123!
-- ==============================================================================
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'owner@petsclub.com',
  crypt('Password123!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Emma Watson","role":"owner"}'::jsonb,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'vet@petsclub.com',
  crypt('Password123!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Dr. Sarah Connor","role":"vet"}'::jsonb,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'seller@petsclub.com',
  crypt('Password123!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Marcus Vance","role":"seller"}'::jsonb,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@petsclub.com',
  crypt('Password123!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Super Administrator","role":"admin"}'::jsonb,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'pending-seller@petsclub.com',
  crypt('Password123!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"BioFeed Nutrition Lab","role":"seller"}'::jsonb,
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'pending-vet@petsclub.com',
  crypt('Password123!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Dr. Jason Miller","role":"vet"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"owner@petsclub.com"}'::jsonb,
  'email',
  'owner@petsclub.com',
  NOW(),
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  '{"sub":"00000000-0000-0000-0000-000000000002","email":"vet@petsclub.com"}'::jsonb,
  'email',
  'vet@petsclub.com',
  NOW(),
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003',
  '{"sub":"00000000-0000-0000-0000-000000000003","email":"seller@petsclub.com"}'::jsonb,
  'email',
  'seller@petsclub.com',
  NOW(),
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000004',
  '{"sub":"00000000-0000-0000-0000-000000000004","email":"admin@petsclub.com"}'::jsonb,
  'email',
  'admin@petsclub.com',
  NOW(),
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000005',
  '{"sub":"00000000-0000-0000-0000-000000000005","email":"pending-seller@petsclub.com"}'::jsonb,
  'email',
  'pending-seller@petsclub.com',
  NOW(),
  NOW(),
  NOW()
),
(
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000006',
  '{"sub":"00000000-0000-0000-0000-000000000006","email":"pending-vet@petsclub.com"}'::jsonb,
  'email',
  'pending-vet@petsclub.com',
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 2. PUBLIC PROFILES
-- ==============================================================================
INSERT INTO public.profiles (
  id, full_name, role, is_verified, preferred_language, country, phone
) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'Emma Watson',
  'owner',
  true,
  'English',
  'US',
  '+1 555 234 5678'
),
(
  '00000000-0000-0000-0000-000000000002',
  'Dr. Sarah Connor',
  'vet',
  true,
  'English',
  'US',
  '+1 555 345 6789'
),
(
  '00000000-0000-0000-0000-000000000003',
  'Marcus Vance',
  'seller',
  true,
  'English',
  'US',
  '+1 555 456 7890'
),
(
  '00000000-0000-0000-0000-000000000004',
  'Super Administrator',
  'admin',
  true,
  'English',
  'US',
  '+1 555 567 8901'
),
(
  '00000000-0000-0000-0000-000000000005',
  'BioFeed Nutrition Lab (Pending Seller)',
  'seller',
  false,
  'English',
  'US',
  '+1 555 889 1234'
),
(
  '00000000-0000-0000-0000-000000000006',
  'Dr. Jason Miller (Pending Vet)',
  'vet',
  false,
  'English',
  'US',
  '+1 555 990 5678'
)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  is_verified = EXCLUDED.is_verified,
  full_name = EXCLUDED.full_name;

-- ==============================================================================
-- 3. VETERINARIAN PROFILES
-- ==============================================================================
INSERT INTO public.vet_profiles (
  id, user_id, name, specialty, country, flag, languages, price_usd, slot_minutes,
  rating, reviews, bio, verified, accepting
) VALUES
(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Dr. Sarah Connor, DVM',
  'Emergency Medicine & Surgery',
  'US',
  '🇺🇸',
  ARRAY['English', 'Spanish'],
  45.00,
  30,
  5.0,
  48,
  'Board-certified emergency veterinarian with 12+ years experience in companion animals and critical triage.',
  true,
  true
),
(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000006',
  'Dr. Jason Miller, DVM',
  'Avian & Exotic Specialties',
  'US',
  '🇺🇸',
  ARRAY['English'],
  50.00,
  30,
  4.8,
  19,
  'Specialist in companion birds, reptiles, and pocket pets.',
  false,
  true
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 4. CLINICS (Verified & Pending)
-- ==============================================================================
INSERT INTO public.clinics (
  id, owner_id, name, license_number, address, city, country, phone, email,
  services_offered, operating_hours, doctors_count, emergency_care_available, verified
) VALUES
(
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Metropolitan Animal Medical Center',
  'VET-LIC-NYC-98214',
  '452 Lexington Avenue',
  'New York',
  'US',
  '+1 212 555 0192',
  'care@metrovets.com',
  ARRAY['Emergency Care', 'Surgery', 'Telemedicine', 'Diagnostics', 'Ultrasound'],
  '24/7 Emergency & Specialty',
  8,
  true,
  true
),
(
  '20000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  'Pacific Veterinary Emergency & Specialty',
  'VET-LIC-SF-44120',
  '1200 Mission St',
  'San Francisco',
  'US',
  '+1 415 555 0834',
  'contact@pacificvet.org',
  ARRAY['General Medicine', 'Cardiology', 'Dental Care', 'Acupuncture'],
  'Mon-Sun 7:00 AM - 11:00 PM',
  5,
  true,
  true
),
(
  '20000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  'Austin Hill Country Equine & Farm Clinic',
  'VET-LIC-TX-10924',
  '8840 Ranch Road 12',
  'Austin',
  'US',
  '+1 512 555 3311',
  'info@hillcountryfarmvet.com',
  ARRAY['Large Animal Care', 'Herd Health', 'Dairy Consultation', 'Field Surgery'],
  'Mon-Sat 8:00 AM - 6:00 PM',
  4,
  true,
  true
),
(
  '20000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000006',
  'Lakeside Avian & Exotic Care (Pending Approval)',
  'VET-LIC-PEND-5521',
  '220 Lake Shore Blvd',
  'Chicago',
  'US',
  '+1 312 555 7719',
  'admin@lakesideavian.com',
  ARRAY['Avian Medicine', 'Exotic Surgery', 'Endoscopy'],
  'Mon-Fri 9:00 AM - 5:00 PM',
  2,
  false,
  false
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 5. FARMS (Dairy, Poultry & Livestock)
-- ==============================================================================
INSERT INTO public.farms (
  id, owner_id, name, farm_type, country, region, size,
  herd_count, lactating_count, yield_per_day_liters, flock_count, egg_production_per_day,
  health_compliance_status, verified, notes
) VALUES
(
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Green Valley Organic Dairy Estate',
  'dairy',
  'US',
  'Wisconsin',
  'Medium (50-250 head)',
  140,
  110,
  3100.0,
  NULL,
  NULL,
  'compliant',
  true,
  'Pasture-raised Jersey and Holstein cows with automated milk monitoring and daily somatic cell checks.'
),
(
  '30000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  'Sunrise Heritage Poultry Farm',
  'poultry',
  'US',
  'Iowa',
  'Large (250+ head)',
  NULL,
  NULL,
  NULL,
  1200,
  980,
  'compliant',
  true,
  'Free-range pasture laying hens fed non-GMO grains with strict salmonella bio-security protocols.'
),
(
  '30000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Blue Ridge Homestead & Livestock',
  'mixed',
  'US',
  'Virginia',
  'Small (under 50 head)',
  25,
  12,
  240.0,
  80,
  65,
  'compliant',
  true,
  'Sustainable family-run mixed operation producing artisan goat cheese, honey, and fresh eggs.'
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 6. MARKETPLACE ITEMS (Linked to Verified Seller)
-- ==============================================================================
INSERT INTO public.marketplace_items (
  id, seller_id, seller_name, name, slug, category, price_usd, rating, reviews_count,
  image_url, blurb, details, stock_quantity, is_vet_approved, verified_seller
) VALUES
(
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003',
  'Global Vet Care Essentials',
  'Premium Kibble (5kg)',
  'premium-kibble-5kg',
  'Food',
  42.00,
  4.9,
  312,
  'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=600&q=80',
  'High-protein, grain-free kibble for adult dogs crafted with pasture-raised chicken and probiotics.',
  ARRAY['Grain-free recipe', '30% real chicken', 'Vet-approved formula', 'Omega-3 fatty acids for coat shine'],
  120,
  true,
  true
),
(
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  'Global Vet Care Essentials',
  'Smart Feeder Pro',
  'smart-feeder-pro',
  'Health',
  129.00,
  4.7,
  88,
  'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=600&q=80',
  'App-controlled smart feeder with portion tracking, HD camera, and customizable feeding schedules.',
  ARRAY['Wi-Fi enabled', 'Voice recording message', '10L airtight hopper', 'Dual power backup battery'],
  45,
  true,
  true
),
(
  '40000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003',
  'Pro Groomers Network',
  'Vet Grooming Kit',
  'vet-grooming-kit',
  'Grooming',
  58.00,
  4.9,
  134,
  'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=600&q=80',
  'Professional-grade grooming kit with low-vibration quiet clippers and stainless steel shears.',
  ARRAY['12 stainless attachments', 'Whisper-quiet motor (<50dB)', 'Cordless USB-C rechargeable', 'Protective travel case'],
  85,
  true,
  true
),
(
  '40000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000003',
  'Feline Fortresses',
  'Cat Tower XL',
  'cat-tower-xl',
  'Toys',
  89.00,
  4.8,
  267,
  'https://images.unsplash.com/photo-1545249390-6bdfa286032f?auto=format&fit=crop&w=600&q=80',
  'Multi-tier solid wooden climbing tower with natural sisal scratching posts and memory foam hammocks.',
  ARRAY['180cm height', 'Non-toxic natural sisal', 'Reinforced anti-topple base', 'Removable machine-washable cushions'],
  30,
  true,
  true
),
(
  '40000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000003',
  'Heritage Farm Feeds',
  'Egg Layer Complete Feed (25kg)',
  'egg-layer-feed-25kg',
  'Farm Supplies',
  36.00,
  4.9,
  156,
  'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=600&q=80',
  'Complete layer feed formulated for productive backyard hens and small poultry farms.',
  ARRAY['16% crude protein', 'Calcium fortified (4.0%)', 'Non-GMO regional whole grains', 'Resealable moisture-lock bag'],
  300,
  true,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ==============================================================================
-- 7. ADOPTION PETS & APPLICATIONS
-- ==============================================================================
INSERT INTO public.adoptions (
  id, shelter_id, shelter_name, name, slug, species, breed, age,
  location, image_url, story, vaccinated, neutered, status
) VALUES
(
  '50000000-0000-0000-0000-000000000001',
  'shelter_ny_01',
  'North Shore Rescue Haven',
  'Buddy',
  'buddy',
  'Dogs',
  'Golden Retriever',
  '2 yrs',
  'Brooklyn, NY',
  'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80',
  'Buddy is a gentle, affectionate Golden Retriever who loves belly rubs, outdoor hikes, and playing fetch with kids.',
  true,
  true,
  'available'
),
(
  '50000000-0000-0000-0000-000000000002',
  'shelter_tx_02',
  'Austin Animal Friends',
  'Luna',
  'luna',
  'Cats',
  'Tabby Cat',
  '1 yr',
  'Austin, TX',
  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80',
  'Luna is an independent, sweet-natured young tabby. Litter-box trained, quiet, and perfect for apartment living.',
  true,
  true,
  'available'
),
(
  '50000000-0000-0000-0000-000000000003',
  'shelter_ca_03',
  'Pacific Avian Sanctuary',
  'Kiwi',
  'kiwi',
  'Birds',
  'Green-cheeked Conure',
  '2 yrs',
  'San Diego, CA',
  'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=600&q=80',
  'Kiwi is a lively conure who loves shoulder rides, whistles happy tunes, and enjoys fresh fruit treats.',
  true,
  false,
  'available'
),
(
  '50000000-0000-0000-0000-000000000004',
  'shelter_fl_04',
  'Sunshine State Rescue Network',
  'Charlie',
  'charlie',
  'Dogs',
  'Labrador Mix',
  '3 yrs',
  'Miami, FL',
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80',
  'Charlie is an energetic, loyal Lab mix who loves swimming, morning jogs, and learning new agility tricks.',
  true,
  true,
  'available'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.adoption_applications (
  id, pet_slug, applicant_id, applicant_name, applicant_email,
  home_type, activity_level, hours_alone, has_other_pets, status
) VALUES
(
  '51000000-0000-0000-0000-000000000001',
  'buddy',
  '00000000-0000-0000-0000-000000000001',
  'Emma Watson',
  'owner@petsclub.com',
  'House with fenced yard',
  'High',
  '2-4 hours',
  true,
  'pending'
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 8. REGISTERED PETS & VACCINATION RECORDS (Self-Healing Table Creation)
-- ==============================================================================
INSERT INTO public.pets (
  id, owner_id, digital_id, name, species, breed, age, gender, weight,
  allergies, photo_url, microchip_number
) VALUES
(
  '60000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'PET-849102',
  'Max',
  'Dog',
  'Golden Retriever',
  '3',
  'male',
  31.5,
  ARRAY['Chicken protein'],
  'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80',
  '985141002941029'
),
(
  '60000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'PET-291048',
  'Milo',
  'Cat',
  'British Shorthair',
  '2',
  'male',
  4.8,
  ARRAY[]::TEXT[],
  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80',
  '985141007781031'
),
(
  '60000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'PET-550192',
  'Bella',
  'Cow',
  'Holstein Dairy',
  '4',
  'female',
  610.0,
  ARRAY[]::TEXT[],
  'https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?auto=format&fit=crop&w=600&q=80',
  '982000389104821'
)
ON CONFLICT (id) DO NOTHING;

-- Ensure pet_vaccinations exists before inserting
CREATE TABLE IF NOT EXISTS public.pet_vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  administered_at DATE NOT NULL,
  next_due_at DATE,
  batch_number TEXT,
  administered_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.pet_vaccinations (
  id, pet_id, vaccine_name, administered_at, next_due_at, batch_number, administered_by, notes
) VALUES
(
  '61000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  'Rabies (Defensor 3)',
  '2026-01-15',
  '2027-01-15',
  'RAB-2026-9041',
  'Dr. Sarah Connor, DVM',
  'Subcutaneous injection left hindlimb. No adverse reactions observed.'
),
(
  '61000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000001',
  'DHPP 5-in-1 Vanguard',
  '2026-03-10',
  '2027-03-10',
  'DHPP-7721',
  'Dr. Sarah Connor, DVM',
  'Annual canine distemper-parvo booster.'
),
(
  '61000000-0000-0000-0000-000000000003',
  '60000000-0000-0000-0000-000000000002',
  'FVRCP PureVax Feline',
  '2026-02-20',
  '2027-02-20',
  'FVR-1092',
  'Dr. Sarah Connor, DVM',
  'Feline viral rhinotracheitis, calicivirus, and panleukopenia vaccine.'
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 9. APPOINTMENTS & TELEMEDICINE CONSULTATIONS
-- ==============================================================================
INSERT INTO public.appointments (
  id, vet_id, pet_parent_id, starts_at, ends_at, mode, status,
  pet_name, species, breed, price_usd
) VALUES
(
  '70000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  NOW() - INTERVAL '5 minutes',
  NOW() + INTERVAL '25 minutes',
  'video',
  'scheduled',
  'Max',
  'Dog',
  'Golden Retriever',
  45.00
),
(
  '70000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '30 minutes',
  'video',
  'completed',
  'Max',
  'Dog',
  'Golden Retriever',
  45.00
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.consultations (
  id, appointment_id, owner_id, vet_id, pet_id, scheduled_at, started_at, completed_at,
  duration_seconds, status, consultation_fee_usd, is_second_opinion, original_consultation_id,
  second_opinion_notes, prescription_id, clinical_notes
) VALUES
(
  '71000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000001',
  NOW() - INTERVAL '5 minutes',
  NOW() - INTERVAL '4 minutes',
  NULL,
  0,
  'scheduled',
  45.00,
  false,
  NULL,
  NULL,
  NULL,
  NULL
),
(
  '71000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000001',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '20 minutes',
  1240,
  'completed',
  45.00,
  false,
  NULL,
  NULL,
  '80000000-0000-0000-0000-000000000001',
  'Patient presented with mild acute gastrointestinal upset. Abdominal palpation was soft and non-painful. Prescribed short course of oral probiotics and bland diet.'
),
(
  '71000000-0000-0000-0000-000000000003',
  'sec_op_demo_9918',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000001',
  NOW() + INTERVAL '1 day',
  NULL,
  NULL,
  0,
  'scheduled',
  35.00,
  true,
  '71000000-0000-0000-0000-000000000002',
  'Requesting second opinion on recurring pruritus and ear redness following elimination diet trial.',
  NULL,
  NULL
)
ON CONFLICT (appointment_id) DO NOTHING;

-- ==============================================================================
-- 10. DIGITAL PRESCRIPTIONS
-- ==============================================================================
INSERT INTO public.prescriptions (
  id, appointment_id, vet_id, pet_id, diagnosis, notes, refills_allowed, status
) VALUES
(
  '80000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  'Acute Canine Enteritis (Mild)',
  'Give medication with food. Ensure continuous access to fresh clean water.',
  1,
  'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.prescription_items (
  id, prescription_id, medication_name, dosage, frequency, duration, special_instructions
) VALUES
(
  '81000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000001',
  'Pro-Pectalin Anti-Diarrheal Gel',
  '2 ml',
  'Every 8 hours',
  '5 days',
  'Administer orally or mix with plain boiled chicken and rice.'
),
(
  '81000000-0000-0000-0000-000000000002',
  '80000000-0000-0000-0000-000000000001',
  'Purina Pro Plan FortiFlora Probiotic',
  '1 sachet',
  'Once daily',
  '14 days',
  'Sprinkle contents over morning meal.'
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 11. MULTI-CURRENCY PAYMENTS
-- ==============================================================================
INSERT INTO public.payments (
  id, user_id, amount, currency, exchange_rate_to_usd, amount_usd,
  status, item_type, reference_id, transaction_id, payment_method
) VALUES
(
  '90000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  45.00,
  'USD',
  1.0,
  45.00,
  'completed',
  'consultation',
  '71000000-0000-0000-0000-000000000001',
  'txn_demo_tele_001',
  'visa_ending_4242'
),
(
  '90000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  32.41,
  'EUR',
  1.08,
  35.00,
  'completed',
  'second_opinion',
  'sec_op_demo_9918',
  'txn_demo_secop_002',
  'mastercard_ending_5510'
),
(
  '90000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  32.81,
  'GBP',
  1.28,
  42.00,
  'completed',
  'marketplace',
  'premium-kibble-5kg',
  'txn_demo_market_003',
  'apple_pay'
)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 12. PET CLUBS & MEMBERSHIPS
-- ==============================================================================
INSERT INTO public.clubs (
  id, slug, name, description, category, cover_image, icon_name, member_count, post_count, is_active
) VALUES
(
  'a0000000-0000-0000-0000-000000000001',
  'dog-lovers-club',
  'Canine Companions Club',
  'Global hub for dog owners, training tips, breed wisdom, and meetup groups.',
  'Dogs',
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
  'paw',
  1420,
  389,
  true
),
(
  'a0000000-0000-0000-0000-000000000002',
  'feline-friends-society',
  'Feline Friends Society',
  'Celebrating everything cats — health, nutrition, behavioral quirks, and cozy spots.',
  'Cats',
  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
  'heart',
  980,
  241,
  true
),
(
  'a0000000-0000-0000-0000-000000000003',
  'avian-feathered-flock',
  'Feathered Friends & Avian Care',
  'Parrots, canaries, and aviary owners sharing diet formulas, enrichment, and cage designs.',
  'Birds',
  'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=800&q=80',
  'feather',
  420,
  95,
  true
),
(
  'a0000000-0000-0000-0000-000000000004',
  'equine-enthusiasts',
  'Equine & Horse Care Collective',
  'Barn management, equestrian sports, hoof care, and pasture management discussions.',
  'Horses',
  'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?auto=format&fit=crop&w=800&q=80',
  'shield',
  310,
  72,
  true
),
(
  'a0000000-0000-0000-0000-000000000005',
  'dairy-homesteaders',
  'Dairy, Cattle & Homesteading',
  'Dairy cow care, herd health, lactation cycles, and milk preservation tips.',
  'Farm Animals',
  'https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?auto=format&fit=crop&w=800&q=80',
  'award',
  640,
  180,
  true
),
(
  'a0000000-0000-0000-0000-000000000006',
  'backyard-poultry-keepers',
  'Backyard Poultry & Flock Keepers',
  'Egg production secrets, coop predator-proofing, molting support, and organic chicken care.',
  'Poultry',
  'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=800&q=80',
  'sun',
  530,
  143,
  true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.club_memberships (
  id, club_id, user_id, role
) VALUES
(
  'a1000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'member'
),
(
  'a1000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'moderator'
)
ON CONFLICT (club_id, user_id) DO NOTHING;

-- ==============================================================================
-- 13. SOCIAL FEED: POSTS, COMMENTS & LIKES
-- ==============================================================================
INSERT INTO public.posts (
  id, author_id, club_id, content, caption, image_url, likes_count, comments_count, status
) VALUES
(
  'b0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Max just graduated from his advanced agility training course! Consistent positive reinforcement made a huge difference with his focus.',
  'Max graduated agility training!',
  'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
  24,
  5,
  'approved'
),
(
  'b0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'Veterinary Reminder: Seasonal tick activity is surging in grassy and wooded trails. Check your dogs after outdoor hikes and ensure monthly preventative treatments are active.',
  'Seasonal tick prevention reminder',
  'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80',
  67,
  12,
  'approved'
),
(
  'b0000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000006',
  'Flock Management Insight: Adding a small splash of apple cider vinegar with garlic extract to drinking water once weekly supports digestive flora in laying hens.',
  'Backyard flock hydration tips',
  'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=800&q=80',
  38,
  7,
  'approved'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.post_comments (
  id, post_id, user_id, body, status
) VALUES
(
  'b1000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Congratulations Emma! Max looks so healthy and proud. Great job with the consistency!',
  'approved'
),
(
  'b1000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Thank you Dr. Connor! We just picked up the vet-approved tick collar from the marketplace.',
  'approved'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.post_likes (
  post_id, user_id
) VALUES
(
  'b0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
),
(
  'b0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (post_id, user_id) DO NOTHING;

-- ==============================================================================
-- 14. ADMIN MODERATION & ABUSE REPORTS QUEUE
-- ==============================================================================
INSERT INTO public.reports (
  id, reporter_id, reporter_name, target_type, target_id, reason, status, action_taken, admin_notes
) VALUES
(
  'c0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Emma Watson',
  'post',
  'b0000000-0000-0000-0000-000000000003',
  'User posted non-prescription medication claims with external third-party telegram link.',
  'pending',
  NULL,
  NULL
),
(
  'c0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Emma Watson',
  'clinic',
  '20000000-0000-0000-0000-000000000004',
  'Unverified clinic phone number; patient unable to reach emergency line.',
  'pending',
  NULL,
  NULL
),
(
  'c0000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Emma Watson',
  'seller',
  '00000000-0000-0000-0000-000000000003',
  'Routine seller tax documentation audit inquiry.',
  'resolved',
  'Verified merchant certificate and tax ID cross-checked against business registry.',
  'Account cleared and verified.'
)
ON CONFLICT (id) DO NOTHING;
