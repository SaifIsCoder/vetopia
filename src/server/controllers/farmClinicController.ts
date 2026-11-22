import { Request, Response } from 'express';
import { supabaseAdmin } from '../supabase';

// Farms (Dairy & Poultry)
export async function getFarms(req: Request, res: Response) {
  try {
    const ownerId = req.user?.id || req.query.ownerId;
    let query = supabaseAdmin.from('farms').select('*').order('created_at', { ascending: false });

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }
    if (req.query.farmType) {
      query = query.eq('farm_type', req.query.farmType);
    }

    const { data: farms, error } = await query;
    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    const formatted = (farms || []).map((f: any) => ({
      id: f.id,
      _id: f.id,
      ownerId: f.owner_id,
      name: f.name,
      farmType: f.farm_type,
      country: f.country,
      region: f.region,
      size: f.size,
      herdCount: f.herd_count,
      lactatingCount: f.lactating_count,
      yieldPerDayLiters: f.yield_per_day_liters,
      flockCount: f.flock_count,
      eggProductionPerDay: f.egg_production_per_day,
      healthComplianceStatus: f.health_compliance_status,
      verified: f.verified,
      notes: f.notes,
      createdAt: f.created_at,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to fetch farms.', code: 'SERVER_ERROR' },
    });
  }
}

export async function createFarm(req: Request, res: Response) {
  try {
    const ownerId = req.user?.id || req.body.ownerId;
    const {
      name,
      farmType,
      country,
      region,
      size,
      herdCount,
      lactatingCount,
      yieldPerDayLiters,
      flockCount,
      eggProductionPerDay,
      notes,
    } = req.body;

    if (!ownerId || !name || !farmType || !country || !region) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'ownerId, name, farmType, country, and region are required.',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    const { data: farm, error } = await supabaseAdmin
      .from('farms')
      .insert({
        owner_id: ownerId,
        name,
        farm_type: farmType,
        country,
        region,
        size: size || 'Small (under 50 head)',
        herd_count: herdCount ? Number(herdCount) : null,
        lactating_count: lactatingCount ? Number(lactatingCount) : null,
        yield_per_day_liters: yieldPerDayLiters ? Number(yieldPerDayLiters) : null,
        flock_count: flockCount ? Number(flockCount) : null,
        egg_production_per_day: eggProductionPerDay ? Number(eggProductionPerDay) : null,
        health_compliance_status: 'pending',
        verified: false,
        notes,
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
      id: farm.id,
      _id: farm.id,
      ownerId: farm.owner_id,
      name: farm.name,
      farmType: farm.farm_type,
      country: farm.country,
      region: farm.region,
      size: farm.size,
      herdCount: farm.herd_count,
      lactatingCount: farm.lactating_count,
      yieldPerDayLiters: farm.yield_per_day_liters,
      flockCount: farm.flock_count,
      eggProductionPerDay: farm.egg_production_per_day,
      healthComplianceStatus: farm.health_compliance_status,
      verified: farm.verified,
      notes: farm.notes,
      createdAt: farm.created_at,
    };

    return res.status(201).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to register farm.', code: 'SERVER_ERROR' },
    });
  }
}

// Clinics
export async function getClinics(req: Request, res: Response) {
  try {
    let query = supabaseAdmin.from('clinics').select('*').order('created_at', { ascending: false });

    if (req.query.country) {
      query = query.eq('country', req.query.country);
    }
    if (req.query.city) {
      query = query.eq('city', req.query.city);
    }
    if (req.query.verified === 'true') {
      query = query.eq('verified', true);
    }

    const { data: clinics, error } = await query;
    if (error) {
      return res.status(500).json({
        success: false,
        error: { message: error.message, code: 'DATABASE_ERROR' },
      });
    }

    const formatted = (clinics || []).map((c: any) => ({
      id: c.id,
      _id: c.id,
      ownerId: c.owner_id,
      name: c.name,
      licenseNumber: c.license_number,
      address: c.address,
      city: c.city,
      country: c.country,
      phone: c.phone,
      email: c.email,
      servicesOffered: c.services_offered || [],
      operatingHours: c.operating_hours,
      doctorsCount: c.doctors_count,
      emergencyCareAvailable: c.emergency_care_available,
      verified: c.verified,
      createdAt: c.created_at,
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to fetch clinics.', code: 'SERVER_ERROR' },
    });
  }
}

export async function createClinic(req: Request, res: Response) {
  try {
    const ownerId = req.user?.id || req.body.ownerId;
    const {
      name,
      licenseNumber,
      address,
      city,
      country,
      phone,
      email,
      servicesOffered,
      operatingHours,
      doctorsCount,
      emergencyCareAvailable,
    } = req.body;

    if (!ownerId || !name || !licenseNumber || !address || !city || !country || !phone || !email) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'All core contact, address, and license fields are required.',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    const { data: clinic, error } = await supabaseAdmin
      .from('clinics')
      .insert({
        owner_id: ownerId,
        name,
        license_number: licenseNumber,
        address,
        city,
        country,
        phone,
        email,
        services_offered: Array.isArray(servicesOffered) ? servicesOffered : ['General Medicine', 'Surgery'],
        operating_hours: operatingHours || '24/7',
        doctors_count: doctorsCount ? Number(doctorsCount) : 1,
        emergency_care_available: emergencyCareAvailable !== false,
        verified: false,
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
      id: clinic.id,
      _id: clinic.id,
      ownerId: clinic.owner_id,
      name: clinic.name,
      licenseNumber: clinic.license_number,
      address: clinic.address,
      city: clinic.city,
      country: clinic.country,
      phone: clinic.phone,
      email: clinic.email,
      servicesOffered: clinic.services_offered,
      operatingHours: clinic.operating_hours,
      doctorsCount: clinic.doctors_count,
      emergencyCareAvailable: clinic.emergency_care_available,
      verified: clinic.verified,
      createdAt: clinic.created_at,
    };

    return res.status(201).json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to register clinic.', code: 'SERVER_ERROR' },
    });
  }
}
