import { apiClient } from '../api';
import { Farm, Clinic } from '../../types/farm';

export async function registerFarm(farmData: Partial<Farm>): Promise<Farm> {
  const res = await apiClient.request<Farm>('farms', {
    method: 'POST',
    body: farmData,
    requiresAuth: false,
  });
  return res.data;
}

export async function registerClinic(clinicData: Partial<Clinic>): Promise<Clinic> {
  const res = await apiClient.request<Clinic>('clinics', {
    method: 'POST',
    body: clinicData,
    requiresAuth: false,
  });
  return res.data;
}

export async function fetchFarms(): Promise<Farm[]> {
  const res = await apiClient.request<Farm[]>('farms', {
    requiresAuth: false,
  });
  return res.data || [];
}

export async function fetchClinics(): Promise<Clinic[]> {
  const res = await apiClient.request<Clinic[]>('clinics', {
    requiresAuth: false,
  });
  return res.data || [];
}
