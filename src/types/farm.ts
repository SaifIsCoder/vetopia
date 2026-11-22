export type FarmType = 'dairy' | 'poultry' | 'livestock' | 'mixed';

export interface Farm {
  id?: string;
  ownerId?: string;
  name: string;
  farmType: FarmType;
  country: string;
  region: string;
  size: string;
  herdCount?: number;
  lactatingCount?: number;
  yieldPerDayLiters?: number;
  flockCount?: number;
  eggProductionPerDay?: number;
  healthComplianceStatus?: 'compliant' | 'review_required' | 'pending';
  verified?: boolean;
}

export interface Clinic {
  id?: string;
  name: string;
  licenseNumber: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  servicesOffered: string[];
  operatingHours: string;
  doctorsCount: number;
  emergencyCareAvailable: boolean;
  verified?: boolean;
}
