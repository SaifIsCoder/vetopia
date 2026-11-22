import { Request, Response } from 'express';
import { supabaseAdmin } from '../supabase';

export async function createConsultation(req: Request, res: Response) {
  try {
    const ownerId = req.user?.id || req.body.ownerId;
    const {
      appointmentId,
      vetId,
      petId,
      scheduledAt,
      consultationFeeUsd = 45,
      isSecondOpinion = false,
      originalConsultationId,
    } = req.body;

    if (!appointmentId || !ownerId || !vetId || !petId || !scheduledAt) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'appointmentId, ownerId, vetId, petId, and scheduledAt are required.',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    const { data: consult, error } = await supabaseAdmin
      .from('consultations')
      .insert({
        appointment_id: appointmentId,
        owner_id: ownerId,
        vet_id: vetId,
        pet_id: petId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        status: 'scheduled',
        consultation_fee_usd: Number(consultationFeeUsd) || 45,
        is_second_opinion: Boolean(isSecondOpinion),
        original_consultation_id: originalConsultationId || null,
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
      id: consult.id,
      _id: consult.id,
      appointmentId: consult.appointment_id,
      ownerId: consult.owner_id,
      vetId: consult.vet_id,
      petId: consult.pet_id,
      scheduledAt: consult.scheduled_at,
      status: consult.status,
      consultationFeeUsd: consult.consultation_fee_usd,
      isSecondOpinion: consult.is_second_opinion,
      originalConsultationId: consult.original_consultation_id,
      createdAt: consult.created_at,
    };

    return res.status(201).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to create consultation.', code: 'SERVER_ERROR' },
    });
  }
}

// State Dynamics: scheduled -> active -> completed
export async function updateConsultationStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, clinicalNotes, prescriptionId, durationSeconds } = req.body;

    const validStatuses = ['scheduled', 'active', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, code: 'VALIDATION_ERROR' },
      });
    }

    const updateFields: any = { status, updated_at: new Date().toISOString() };
    if (status === 'active') updateFields.started_at = new Date().toISOString();
    if (status === 'completed') {
      updateFields.completed_at = new Date().toISOString();
      if (durationSeconds) updateFields.duration_seconds = Number(durationSeconds);
      if (clinicalNotes) updateFields.clinical_notes = clinicalNotes;
      if (prescriptionId) updateFields.prescription_id = prescriptionId;
    }

    // Try finding by UUID or appointment_id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    let query = supabaseAdmin.from('consultations').update(updateFields);

    if (isUuid) {
      query = query.or(`id.eq.${id},appointment_id.eq.${id}`);
    } else {
      query = query.eq('appointment_id', id);
    }

    const { data: updatedConsult, error } = await query.select().maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    if (!updatedConsult) {
      return res.status(404).json({
        success: false,
        error: { message: 'Consultation not found.', code: 'NOT_FOUND' },
      });
    }

    const formatted = {
      id: updatedConsult.id,
      _id: updatedConsult.id,
      appointmentId: updatedConsult.appointment_id,
      ownerId: updatedConsult.owner_id,
      vetId: updatedConsult.vet_id,
      petId: updatedConsult.pet_id,
      scheduledAt: updatedConsult.scheduled_at,
      startedAt: updatedConsult.started_at,
      completedAt: updatedConsult.completed_at,
      durationSeconds: updatedConsult.duration_seconds,
      status: updatedConsult.status,
      consultationFeeUsd: updatedConsult.consultation_fee_usd,
      isSecondOpinion: updatedConsult.is_second_opinion,
      originalConsultationId: updatedConsult.original_consultation_id,
      prescriptionId: updatedConsult.prescription_id,
      clinicalNotes: updatedConsult.clinical_notes,
      createdAt: updatedConsult.created_at,
    };

    return res.status(200).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to update consultation status.', code: 'SERVER_ERROR' },
    });
  }
}

// Second Opinions
export async function requestSecondOpinion(req: Request, res: Response) {
  try {
    const ownerId = req.user?.id || req.body.ownerId;
    const { originalConsultationId, targetVetId, petId, secondOpinionNotes } = req.body;

    if (!ownerId || !originalConsultationId || !targetVetId || !petId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'ownerId, originalConsultationId, targetVetId, and petId are required.',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    const appointmentId = `sec_op_${Date.now()}`;
    const scheduledAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const { data: consult, error } = await supabaseAdmin
      .from('consultations')
      .insert({
        appointment_id: appointmentId,
        owner_id: ownerId,
        vet_id: targetVetId,
        pet_id: petId,
        scheduled_at: scheduledAt,
        status: 'scheduled',
        consultation_fee_usd: 35, // Discounted second opinion fee
        is_second_opinion: true,
        original_consultation_id: originalConsultationId,
        second_opinion_notes: secondOpinionNotes || null,
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
      id: consult.id,
      _id: consult.id,
      appointmentId: consult.appointment_id,
      ownerId: consult.owner_id,
      vetId: consult.vet_id,
      petId: consult.pet_id,
      scheduledAt: consult.scheduled_at,
      status: consult.status,
      consultationFeeUsd: consult.consultation_fee_usd,
      isSecondOpinion: consult.is_second_opinion,
      originalConsultationId: consult.original_consultation_id,
      secondOpinionNotes: consult.second_opinion_notes,
      createdAt: consult.created_at,
    };

    return res.status(201).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to request second opinion.', code: 'SERVER_ERROR' },
    });
  }
}
