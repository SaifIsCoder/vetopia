import { supabaseAdmin } from '../supabase';

interface UserSeedDef {
  id: string;
  email: string;
  password: string;
  fullName: string;
  role: 'owner' | 'vet' | 'seller' | 'admin';
  phone: string;
  country: string;
  isVerified: boolean;
  vetDetails?: {
    id: string;
    specialty: string;
    licenseNumber: string;
    priceUsd: number;
    bio: string;
  };
}

const SEED_USERS: UserSeedDef[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'owner@petsclub.com',
    password: 'Password123!',
    fullName: 'Emma Watson',
    role: 'owner',
    phone: '+1 555 234 5678',
    country: 'US',
    isVerified: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'vet@petsclub.com',
    password: 'Password123!',
    fullName: 'Dr. Sarah Connor',
    role: 'vet',
    phone: '+1 555 345 6789',
    country: 'US',
    isVerified: true,
    vetDetails: {
      id: '10000000-0000-0000-0000-000000000001',
      specialty: 'Emergency Medicine & Surgery',
      licenseNumber: 'VET-DVM-NY-84920',
      priceUsd: 45.0,
      bio: 'Board-certified veterinarian with 12+ years experience in small animal emergency and critical care.',
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'seller@petsclub.com',
    password: 'Password123!',
    fullName: 'Marcus Vance',
    role: 'seller',
    phone: '+1 555 456 7890',
    country: 'US',
    isVerified: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'admin@petsclub.com',
    password: 'Password123!',
    fullName: 'Super Administrator',
    role: 'admin',
    phone: '+1 555 567 8901',
    country: 'US',
    isVerified: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'pending-seller@petsclub.com',
    password: 'Password123!',
    fullName: 'BioFeed Nutrition Lab (Pending Seller)',
    role: 'seller',
    phone: '+1 555 889 1234',
    country: 'US',
    isVerified: false,
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    email: 'pending-vet@petsclub.com',
    password: 'Password123!',
    fullName: 'Dr. Jason Miller (Pending Vet)',
    role: 'vet',
    phone: '+1 555 990 5678',
    country: 'US',
    isVerified: false,
    vetDetails: {
      id: '10000000-0000-0000-0000-000000000002',
      specialty: 'Avian & Exotic Specialties',
      licenseNumber: 'VET-DVM-IL-33921',
      priceUsd: 50.0,
      bio: 'Specialist in companion birds, reptiles, and pocket pets.',
    },
  },
];

export async function runUserSeed() {
  console.info('🌱 [SeedUsers] Starting Supabase RBAC Auth User & Profile Seeding...');

  for (const userDef of SEED_USERS) {
    try {
      let authUserId = userDef.id;

      // 1. Check if auth user exists
      const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) {
        console.warn(`[SeedUsers] Warning listing users: ${listError.message}`);
      }

      const existingAuthUser = userList?.users?.find(
        (u) => u.email?.toLowerCase() === userDef.email.toLowerCase() || u.id === userDef.id
      );

      if (!existingAuthUser) {
        console.info(`  ➕ Creating auth user: ${userDef.email} (${userDef.role})...`);
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          id: userDef.id,
          email: userDef.email,
          password: userDef.password,
          email_confirm: true,
          user_metadata: {
            full_name: userDef.fullName,
            role: userDef.role,
          },
        });

        if (createError) {
          console.error(`  ❌ Failed to create auth user ${userDef.email}:`, createError.message);
        } else if (newUser?.user) {
          authUserId = newUser.user.id;
        }
      } else {
        console.info(`  🔄 Updating existing auth user: ${userDef.email} (id: ${existingAuthUser.id})...`);
        authUserId = existingAuthUser.id;
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
          password: userDef.password,
          email_confirm: true,
          user_metadata: {
            full_name: userDef.fullName,
            role: userDef.role,
          },
        });
        if (updateError) {
          console.warn(`  ⚠️ Update notice for ${userDef.email}:`, updateError.message);
        }
      }

      // 2. Upsert public.profiles
      const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
        {
          id: authUserId,
          full_name: userDef.fullName,
          role: userDef.role,
          is_verified: userDef.isVerified,
          phone: userDef.phone,
          country: userDef.country,
          preferred_language: 'English',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (profileError) {
        console.warn(`  ⚠️ Profile upsert warning for ${userDef.email}:`, profileError.message);
      } else {
        console.info(`  ✅ Profile synced: ${userDef.fullName} [${userDef.role}]`);
      }

      // 3. Upsert user_roles for backwards compatibility with RLS policies
      const roleName = userDef.role === 'owner' ? 'pet_parent' : userDef.role;
      try {
        await supabaseAdmin.from('user_roles').upsert(
          {
            user_id: authUserId,
            role: roleName,
          },
          { onConflict: 'user_id,role' }
        );
      } catch {
        // Ignored if user_roles enum has differences
      }

      // 4. If vet, ensure vet_profiles record exists with valid hex UUID
      if (userDef.role === 'vet' && userDef.vetDetails) {
        const { error: vetError } = await supabaseAdmin.from('vet_profiles').upsert(
          {
            id: userDef.vetDetails.id,
            user_id: authUserId,
            name: `${userDef.fullName}, DVM`,
            specialty: userDef.vetDetails.specialty,
            country: 'US',
            flag: '🇺🇸',
            languages: ['English', 'Spanish'],
            price_usd: userDef.vetDetails.priceUsd,
            slot_minutes: 30,
            rating: 5.0,
            reviews: 48,
            bio: userDef.vetDetails.bio,
            verified: userDef.isVerified,
            accepting: true,
          },
          { onConflict: 'id' }
        );

        if (vetError) {
          console.warn('  ⚠️ Vet profile sync warning:', vetError.message);
        } else {
          console.info(`  ✅ Vet profile active: ${userDef.fullName}, DVM`);
        }
      }
    } catch (err: any) {
      console.error(`  ❌ Error processing ${userDef.email}:`, err?.message || err);
    }
  }

  console.info('✨ [SeedUsers] All RBAC role credentials ready to log in:');
  console.table(
    SEED_USERS.map((u) => ({
      Role: u.role.toUpperCase(),
      Email: u.email,
      Password: u.password,
      FullName: u.fullName,
      Verified: u.isVerified ? 'YES' : 'NO',
    }))
  );
}

if (require.main === module) {
  runUserSeed()
    .then(() => {
      console.info('🏁 Seed script completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal seed script error:', err);
      process.exit(1);
    });
}
