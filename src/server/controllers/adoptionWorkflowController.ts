import { Request, Response } from 'express';
import { supabaseAdmin } from '../supabase';

const DEFAULT_SHELTER_PETS = [
  {
    shelterId: 'shelter_ny_01',
    shelterName: 'North Shore Rescue Haven',
    name: 'Buddy',
    slug: 'buddy',
    species: 'Dogs',
    breed: 'Golden Retriever',
    age: '2 yrs',
    location: 'Brooklyn, NY',
    imageUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80',
    story: 'Buddy is a calm, affectionate Golden looking for a family with a yard. Loves children and other dogs.',
    vaccinated: true,
    neutered: true,
    status: 'available',
    applications: [],
  },
  {
    shelterId: 'shelter_tx_02',
    shelterName: 'Austin Animal Friends',
    name: 'Luna',
    slug: 'luna',
    species: 'Cats',
    breed: 'Tabby Cat',
    age: '1 yr',
    location: 'Austin, TX',
    imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80',
    story: 'Luna is an independent young tabby. Quiet, clean, and perfect for apartment living.',
    vaccinated: true,
    neutered: true,
    status: 'available',
    applications: [],
  },
];

export async function getAdoptionPets(req: Request, res: Response) {
  try {
    const { species, status = 'available' } = req.query;
    let query = supabaseAdmin.from('adoptions').select('*').order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (species && species !== 'All') {
      query = query.eq('species', species);
    }

    const { data: pets, error } = await query;
    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    if (!pets || pets.length === 0) {
      return res.status(200).json({ success: true, data: DEFAULT_SHELTER_PETS });
    }

    const formatted = pets.map((p: any) => ({
      id: p.id,
      _id: p.id,
      shelterId: p.shelter_id,
      shelterName: p.shelter_name,
      name: p.name,
      slug: p.slug,
      species: p.species,
      breed: p.breed,
      age: p.age,
      location: p.location,
      imageUrl: p.image_url,
      story: p.story,
      vaccinated: p.vaccinated,
      neutered: p.neutered,
      status: p.status,
      createdAt: p.created_at,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to fetch adoption pets.', code: 'SERVER_ERROR' },
    });
  }
}

export async function applyForAdoption(req: Request, res: Response) {
  try {
    const { petSlug } = req.params;
    const applicantId = req.user?.id || req.body.applicantId;
    const { applicantName, applicantEmail, homeType, activityLevel, hoursAlone, hasOtherPets } = req.body;

    if (!applicantId || !applicantName || !applicantEmail) {
      return res.status(400).json({
        success: false,
        error: { message: 'Applicant name, email, and ID are required.', code: 'VALIDATION_ERROR' },
      });
    }

    // 1. Insert adoption application
    const isApplicantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicantId);
    const { data: application, error: appError } = await supabaseAdmin
      .from('adoption_applications')
      .insert({
        pet_slug: petSlug,
        applicant_id: isApplicantUuid ? applicantId : null,
        applicant_name: applicantName,
        applicant_email: applicantEmail,
        home_type: homeType || 'Apartment',
        activity_level: activityLevel || 'Moderate',
        hours_alone: hoursAlone || '4-8 hours',
        has_other_pets: Boolean(hasOtherPets),
        status: 'pending',
      })
      .select()
      .single();

    if (appError) {
      return res.status(500).json({
        success: false,
        error: { message: appError.message, code: 'DATABASE_ERROR' },
      });
    }

    // 2. Transition adoption pet status to 'requested'
    const { data: updatedPet } = await supabaseAdmin
      .from('adoptions')
      .update({ status: 'requested' })
      .eq('slug', petSlug)
      .select()
      .maybeSingle();

    return res.status(201).json({
      success: true,
      data: {
        message: 'Adoption application submitted successfully.',
        status: 'requested',
        pet: updatedPet || { slug: petSlug, status: 'requested' },
        application,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to submit adoption application.', code: 'SERVER_ERROR' },
    });
  }
}

// State transition: requested -> approved -> completed
export async function updateAdoptionStatus(req: Request, res: Response) {
  try {
    const { petSlug } = req.params;
    const { status, applicantId } = req.body;

    const validStatuses = ['available', 'requested', 'approved', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, code: 'VALIDATION_ERROR' },
      });
    }

    const { data: pet, error } = await supabaseAdmin
      .from('adoptions')
      .update({ status })
      .eq('slug', petSlug)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    if (!pet) {
      return res.status(404).json({
        success: false,
        error: { message: 'Adoptable pet not found.', code: 'NOT_FOUND' },
      });
    }

    if (applicantId) {
      const isApplicantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicantId);
      if (isApplicantUuid) {
        await supabaseAdmin
          .from('adoption_applications')
          .update({ status: status === 'approved' || status === 'completed' ? 'approved' : 'rejected' })
          .eq('pet_slug', petSlug)
          .eq('applicant_id', applicantId);
      }
    }

    return res.status(200).json({ success: true, data: pet });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to update adoption status.', code: 'SERVER_ERROR' },
    });
  }
}
