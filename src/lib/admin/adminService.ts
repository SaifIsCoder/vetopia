import { apiClient } from '../api';
import { AdminReport, VerificationCandidate } from '../../types/admin';

export async function fetchAdminReports(): Promise<AdminReport[]> {
  try {
    const res = await apiClient.request<AdminReport[]>('admin/reports', {
      requiresAuth: false,
    });
    if (res.data && res.data.length > 0) return res.data;
  } catch {
    // Fallback reports
  }

  return [
    {
      id: 'rep_001',
      reporterId: 'usr_101',
      reporterName: 'David K.',
      targetType: 'post',
      targetId: 'pst_9921',
      reason: 'Suspicious third-party medication seller advertisement with external telegram link.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'rep_002',
      reporterId: 'usr_102',
      reporterName: 'Emily S.',
      targetType: 'clinic',
      targetId: 'cln_401',
      reason: 'Unverified clinic phone number; patient unable to reach emergency line.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
  ];
}

export async function resolveReport(reportId: string, actionTaken: string): Promise<any> {
  const res = await apiClient.request(`admin/reports/${reportId}/resolve`, {
    method: 'PATCH',
    body: { actionTaken },
    requiresAuth: false,
  });
  return res.data;
}

export async function approveEntity(entityType: string, entityId: string): Promise<any> {
  const res = await apiClient.request(`admin/approvals/${entityType}/${entityId}`, {
    method: 'PATCH',
    requiresAuth: false,
  });
  return res.data;
}
