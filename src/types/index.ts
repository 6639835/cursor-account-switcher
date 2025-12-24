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

export interface TokenInfo {
  token_type: 'jwt' | 'session';
  user_id?: string;
  is_valid: boolean;
}

export interface UsageEvent {
  id: string;
  timestamp: string;
  model?: string;
  type?: string;
  usage_type?: string;
  cost?: number;
  tokens?: number;
  request_type?: string;
}

export interface BillingCycle {
  start_date?: string;
  end_date?: string;
  usage?: number;
  limit?: number;
}

export interface DetailedUserInfo {
  email?: string;
  user_id?: string;
  membership_type?: string;
  subscription_status?: string;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  period_start?: string;
  period_end?: string;
  number?: string;
}

export interface UsageEventsResponse {
  events: UsageEvent[];
  total?: number;
}

export interface InvoicesResponse {
  invoices: Invoice[];
  total?: number;
}
