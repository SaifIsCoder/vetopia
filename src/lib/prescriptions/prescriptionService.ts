import { supabase } from '../supabase/client';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  AuthError,
  ConflictError,
  ApiError,
} from '../api/errors';
import {
  Prescription,
  CreatePrescriptionDTO,
  CreatePrescriptionResponse,
} from '../../types/prescription';

export class PrescriptionService {
  /**
   * Issue a new digital prescription for a completed consultation (FR-PRES-001).
   * Validated server-side via PostgreSQL RPC `create_prescription`.
   * Strictly authorized for the assigned consulting veterinarian.
   */
  public async createPrescription(dto: CreatePrescriptionDTO): Promise<CreatePrescriptionResponse> {
    if (!dto.appointment_id) {
      throw new ValidationError('Appointment ID is required.');
    }

    if (!dto.diagnosis || !dto.diagnosis.trim()) {
      throw new ValidationError('Clinical diagnosis is required.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new ValidationError('Prescription must include at least one medication item.');
    }

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      if (!item.medication_name || !item.medication_name.trim()) {
        throw new ValidationError(`Medication name is required for item #${i + 1}.`);
      }
      if (!item.dosage || !item.dosage.trim()) {
        throw new ValidationError(`Dosage is required for medication: ${item.medication_name}.`);
      }
      if (!item.frequency || !item.frequency.trim()) {
        throw new ValidationError(`Frequency is required for medication: ${item.medication_name}.`);
      }
      if (!item.duration || !item.duration.trim()) {
        throw new ValidationError(`Duration is required for medication: ${item.medication_name}.`);
      }
    }

    try {
      const { data, error } = await supabase.rpc('create_prescription', {
        p_appointment_id: dto.appointment_id,
        p_diagnosis: dto.diagnosis.trim(),
        p_notes: dto.notes ? dto.notes.trim() : null,
        p_refills_allowed: dto.refills_allowed ?? 0,
        p_items: dto.items.map((item) => ({
          medication_name: item.medication_name.trim(),
          dosage: item.dosage.trim(),
          frequency: item.frequency.trim(),
          duration: item.duration.trim(),
          special_instructions: item.special_instructions ? item.special_instructions.trim() : null,
        })),
      });

      if (error) {
        if (error.code === '42501') {
          throw new ForbiddenError(
            error.message ||
              'Forbidden: Only the assigned consulting veterinarian can create a prescription for this appointment.',
          );
        }
        if (error.code === 'P0002') {
          throw new NotFoundError('Appointment not found.');
        }
        if (error.code === 'P0001') {
          throw new ConflictError(
            error.message || 'Prescription can only be issued for completed appointments.',
          );
        }
        if (error.code === '23505') {
          throw new ConflictError('A prescription has already been issued for this appointment.');
        }
        if (error.code === '28000') {
          throw new AuthError(
            error.message || 'Authentication required to create digital prescription.',
          );
        }
        if (error.code === '22023') {
          throw new ValidationError(error.message || 'Validation error in prescription payload.');
        }
        throw new ApiError(error.message, 500);
      }

      return data as CreatePrescriptionResponse;
    } catch (err: any) {
      if (
        err instanceof ValidationError ||
        err instanceof ForbiddenError ||
        err instanceof NotFoundError ||
        err instanceof ConflictError ||
        err instanceof AuthError ||
        err instanceof ApiError
      ) {
        throw err;
      }
      throw new ApiError(err?.message || 'Failed to create digital prescription.', 500);
    }
  }

  /**
   * Retrieve a prescription by ID with joined items, vet, pet, and appointment details (FR-PRES-002).
   * RLS strictly enforces that only the prescribed pet's owner or authoring vet can read this record.
   */
  public async getPrescriptionById(id: string): Promise<Prescription> {
    if (!id) {
      throw new ValidationError('Prescription ID is required.');
    }

    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(
          `
          *,
          items:prescription_items(*),
          vet:vet_profiles (
            id,
            name,
            specialty,
            flag,
            country,
            rating,
            verified
          ),
          pet:pets (
            id,
            name,
            species,
            breed,
            age,
            weight_kg
          ),
          appointment:appointments (
            id,
            starts_at,
            ends_at,
            mode,
            status
          )
        `,
        )
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError(
            'Prescription not found or you do not have permission to view it.',
          );
        }
        if (error.code === 'PGRST301' || error.code === '28000') {
          throw new AuthError(error.message || 'Authentication required to view prescription.');
        }
        throw new ApiError(error.message, 500);
      }

      return data as Prescription;
    } catch (err: any) {
      if (
        err instanceof NotFoundError ||
        err instanceof ValidationError ||
        err instanceof AuthError ||
        err instanceof ForbiddenError ||
        err instanceof ConflictError ||
        err instanceof ApiError
      ) {
        throw err;
      }
      throw new ApiError(err?.message || 'Failed to load prescription details.', 500);
    }
  }

  /**
   * Retrieve all prescriptions issued for a specific pet (Pet Health Passport integration).
   */
  public async getPrescriptionsByPetId(petId: string): Promise<Prescription[]> {
    if (!petId) {
      throw new ValidationError('Pet ID is required.');
    }

    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(
          `
          *,
          items:prescription_items(*),
          vet:vet_profiles (
            id,
            name,
            specialty,
            flag,
            country,
            rating,
            verified
          )
        `,
        )
        .eq('pet_id', petId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new ApiError(error.message, 500);
      }

      return (data || []) as Prescription[];
    } catch (err: any) {
      if (err instanceof ValidationError || err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(err?.message || 'Failed to load pet prescriptions.', 500);
    }
  }

  /**
   * Retrieve prescription linked to a specific appointment, if one exists.
   */
  public async getPrescriptionByAppointmentId(appointmentId: string): Promise<Prescription | null> {
    if (!appointmentId) {
      throw new ValidationError('Appointment ID is required.');
    }

    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(
          `
          *,
          items:prescription_items(*),
          vet:vet_profiles (
            id,
            name,
            specialty,
            flag,
            country,
            rating,
            verified
          ),
          pet:pets (
            id,
            name,
            species,
            breed,
            age,
            weight_kg
          )
        `,
        )
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (error) {
        throw new ApiError(error.message, 500);
      }

      return (data as Prescription) || null;
    } catch (err: any) {
      if (err instanceof ValidationError || err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(err?.message || 'Failed to check appointment prescription.', 500);
    }
  }
}

export const prescriptionService = new PrescriptionService();
