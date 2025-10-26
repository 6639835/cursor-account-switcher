export interface Account {
  index: number;
  email: string;
  access_token: string;
  refresh_token: string;
  cookie: string;
  days_remaining: string;
  status: string;
  record_time: string;
  source: string; // "imported" or "web_login"
  usage_used?: number;
  usage_remaining?: number;
  usage_total?: number;
  usage_percentage?: number;
}

export interface AccountInfo {
  email: string;
  membership_type: string;
  days_remaining: number;
  is_student: boolean;
}

export interface UsageInfo {
  total_quota: number;
  used: number;
  remaining: number;
  usage_percentage: number;
}

export interface MachineIds {
  machine_id: string;
  mac_machine_id: string;
  dev_device_id: string;
  sqm_id: string;
}
