import { Request, Response } from 'express';
import { supabaseAdmin } from '../supabase';

export async function getAdminReports(req: Request, res: Response) {
  try {
    const { status = 'pending' } = req.query;
    let query = supabaseAdmin.from('reports').select('*').order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: reports, error } = await query;
    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    const formatted = (reports || []).map((r: any) => ({
      id: r.id,
      _id: r.id,
      reporterId: r.reporter_id,
      reporterName: r.reporter_name,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      status: r.status,
      actionTaken: r.action_taken,
      adminNotes: r.admin_notes,
      createdAt: r.created_at,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to fetch reports.', code: 'SERVER_ERROR' },
    });
  }
}

export async function createReport(req: Request, res: Response) {
  try {
    const reporterId = req.user?.id || req.body.reporterId;
    const { targetType, targetId, reason, reporterName } = req.body;

    if (!reporterId || !targetType || !targetId || !reason) {
      return res.status(400).json({
        success: false,
        error: { message: 'reporterId, targetType, targetId, and reason are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const isReporterUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reporterId);

    const { data: report, error } = await supabaseAdmin
      .from('reports')
      .insert({
        reporter_id: isReporterUuid ? reporterId : null,
        reporter_name: reporterName || 'Anonymous',
        target_type: targetType,
        target_id: String(targetId),
        reason,
        status: 'pending',
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
      id: report.id,
      _id: report.id,
      reporterId: report.reporter_id,
      reporterName: report.reporter_name,
      targetType: report.target_type,
      targetId: report.target_id,
      reason: report.reason,
      status: report.status,
      createdAt: report.created_at,
    };

    return res.status(201).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to create report.', code: 'SERVER_ERROR' },
    });
  }
}

export async function resolveReport(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { actionTaken, adminNotes } = req.body;

    const { data: report, error } = await supabaseAdmin
      .from('reports')
      .update({
        status: 'resolved',
        action_taken: actionTaken || 'Reviewed and dismissed',
        admin_notes: adminNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    if (!report) {
      return res.status(404).json({
        success: false,
        error: { message: 'Report not found.', code: 'NOT_FOUND' },
      });
    }

    const formatted = {
      id: report.id,
      _id: report.id,
      reporterId: report.reporter_id,
      reporterName: report.reporter_name,
      targetType: report.target_type,
      targetId: report.target_id,
      reason: report.reason,
      status: report.status,
      actionTaken: report.action_taken,
      adminNotes: report.admin_notes,
      createdAt: report.created_at,
    };

    return res.status(200).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to resolve report.', code: 'SERVER_ERROR' },
    });
  }
}

export async function approveEntity(req: Request, res: Response) {
  try {
    const { entityType, entityId } = req.params; // entityType: 'vet', 'seller', 'clinic'

    if (entityType === 'clinic') {
      const { data: clinic, error } = await supabaseAdmin
        .from('clinics')
        .update({ verified: true, updated_at: new Date().toISOString() })
        .eq('id', entityId)
        .select()
        .maybeSingle();

      if (error) {
        return res.status(500).json({ success: false, error: { message: error.message, code: 'DATABASE_ERROR' } });
      }
      return res.status(200).json({ success: true, data: clinic });
    } else if (entityType === 'seller' || entityType === 'vet') {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .update({ is_verified: true, updated_at: new Date().toISOString() })
        .eq('id', entityId)
        .select()
        .maybeSingle();

      if (error) {
        return res.status(500).json({ success: false, error: { message: error.message, code: 'DATABASE_ERROR' } });
      }

      if (entityType === 'vet') {
        // Also update vet_profiles if present
        await supabaseAdmin
          .from('vet_profiles')
          .update({ verified: true })
          .or(`id.eq.${entityId},user_id.eq.${entityId}`);
      }

      return res.status(200).json({ success: true, data: profile });
    }

    return res.status(400).json({ success: false, error: { message: 'Invalid entity type.', code: 'INVALID_TYPE' } });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to approve entity.', code: 'SERVER_ERROR' },
    });
  }
}
