import { Request, Response } from 'express';
import { supabaseAdmin } from '../supabase';

function generateDigitalId(): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `PET-${rand}`;
}

export async function getPets(req: Request, res: Response) {
  try {
    const ownerId = req.user?.id || req.query.ownerId;
    if (!ownerId) {
      return res.status(400).json({
        success: false,
        error: { message: 'ownerId is required.', code: 'VALIDATION_ERROR' },
      });
    }

    const { data: pets, error } = await supabaseAdmin
      .from('pets')
      .select('*, vaccinations:pet_vaccinations(*)')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    // Map to client-friendly format
    const formatted = (pets || []).map((p: any) => ({
      id: p.id,
      _id: p.id,
      ownerId: p.owner_id,
      digitalId: p.digital_id || `PET-${p.id.slice(0, 6).toUpperCase()}`,
      name: p.name,
      species: p.species,
      breed: p.breed,
      age: p.age,
      weight: p.weight,
      gender: p.gender,
      allergies: p.allergies || [],
      photoUrl: p.photo_url || '',
      vaccinations: (p.vaccinations || []).map((v: any) => ({
        vaccineName: v.vaccine_name,
        dateAdministered: v.administered_at,
        validUntil: v.next_due_at,
        vetName: v.administered_by,
        batchNumber: v.batch_number,
      })),
      createdAt: p.created_at,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to fetch pets.', code: 'SERVER_ERROR' },
    });
  }
}

export async function getPetById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const { data: pet, error } = await supabaseAdmin
      .from('pets')
      .select('*, vaccinations:pet_vaccinations(*)')
      .eq('id', id)
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
        error: { message: 'Pet not found.', code: 'NOT_FOUND' },
      });
    }

    const formatted = {
      id: pet.id,
      _id: pet.id,
      ownerId: pet.owner_id,
      digitalId: pet.digital_id || `PET-${pet.id.slice(0, 6).toUpperCase()}`,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      age: pet.age,
      weight: pet.weight,
      gender: pet.gender,
      allergies: pet.allergies || [],
      photoUrl: pet.photo_url || '',
      vaccinations: (pet.vaccinations || []).map((v: any) => ({
        vaccineName: v.vaccine_name,
        dateAdministered: v.administered_at,
        validUntil: v.next_due_at,
        vetName: v.administered_by,
        batchNumber: v.batch_number,
      })),
      createdAt: pet.created_at,
    };

    return res.status(200).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to fetch pet details.', code: 'SERVER_ERROR' },
    });
  }
}

export async function createPet(req: Request, res: Response) {
  try {
    const ownerId = req.user?.id || req.body.ownerId;
    const { name, species, breed, age, weight, gender, allergies, photoUrl } = req.body;

    if (!ownerId || !name || !species || !breed) {
      return res.status(400).json({
        success: false,
        error: { message: 'ownerId, name, species, and breed are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const digitalId = generateDigitalId();

    const { data: pet, error } = await supabaseAdmin
      .from('pets')
      .insert({
        owner_id: ownerId,
        digital_id: digitalId,
        name,
        species,
        breed,
        age: Number(age) || 12,
        weight: Number(weight) || 5,
        gender: gender || 'male',
        allergies: Array.isArray(allergies) ? allergies : [],
        photo_url: photoUrl || '',
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    const formatted = {
      id: pet.id,
      _id: pet.id,
      ownerId: pet.owner_id,
      digitalId: pet.digital_id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      age: pet.age,
      weight: pet.weight,
      gender: pet.gender,
      allergies: pet.allergies,
      photoUrl: pet.photo_url,
      vaccinations: [],
      createdAt: pet.created_at,
    };

    return res.status(201).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to create pet.', code: 'SERVER_ERROR' },
    });
  }
}

export async function addVaccination(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { vaccineName, dateAdministered, validUntil, vetName, batchNumber } = req.body;

    if (!vaccineName || !dateAdministered || !validUntil) {
      return res.status(400).json({
        success: false,
        error: { message: 'vaccineName, dateAdministered, and validUntil are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from('pet_vaccinations')
      .insert({
        pet_id: id,
        vaccine_name: vaccineName,
        administered_at: new Date(dateAdministered).toISOString().split('T')[0],
        next_due_at: new Date(validUntil).toISOString().split('T')[0],
        administered_by: vetName || 'Dr. Veterinarian',
        batch_number: batchNumber || 'BATCH-001',
      });

    if (insertError) {
      return res.status(500).json({
        success: false,
        error: { message: insertError.message, code: 'DATABASE_ERROR' },
      });
    }

    // Return the updated pet
    return await getPetById(req, res);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to add vaccination.', code: 'SERVER_ERROR' },
    });
  }
}
