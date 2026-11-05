export type FinancialEntryType = 'income' | 'expense' | 'recurring';
export type RecurrenceFrequency = 'monthly' | 'weekly' | 'yearly';
export type TimingMode = 'specific_date' | 'monthly';
export type MonthlyKind = 'one_time' | 'recurring';

export interface FinancialEntry {
  id: string;
  owner_uid: string;
  entry_type: FinancialEntryType;
  category: string;
  amount_bdt: number;
  date: string; // YYYY-MM-DD or default date of period
  timing_mode?: TimingMode; // 'specific_date' | 'monthly'
  monthly_kind?: MonthlyKind; // 'one_time' (for a selected month) | 'recurring' (every month)
  target_month?: string; // YYYY-MM when timing_mode is monthly
  day_of_month?: number; // 1-31 (day of month for monthly entries)
  payment_method?: string; // 'cash' | 'bank' | 'bkash' | 'nagad' | 'card' | 'other'
  is_recurring?: boolean;
  recurrence_frequency?: RecurrenceFrequency;
  last_logged_period?: string; // YYYY-MM for monthly
  notes?: string;
  foreign_currency?: string;
  foreign_amount?: number;
  created_at: string;
}

export interface Budget {
  id: string;
  owner_uid: string;
  category: string;
  monthly_limit_bdt: number;
  month: string; // YYYY-MM
  created_at?: string;
}

export interface SavingsGoal {
  id: string;
  owner_uid: string;
  goal_name: string;
  target_amount_bdt: number;
  current_amount_bdt: number;
  target_date?: string;
  created_at: string;
  updated_at?: string;
}

export interface CalculationIncomeItem {
  id: string;
  label: string;
  amount_bdt: number;
  type?: 'base' | 'bonus' | 'allowance' | 'side_gig' | 'other';
}

export interface CalculationDeductionItem {
  id: string;
  label: string;
  amount_bdt: number;
  is_percentage?: boolean;
  percentage_value?: number;
  type?: 'tax' | 'provident_fund' | 'insurance' | 'other';
}

export interface CalculationExpenseItem {
  id: string;
  label: string;
  amount_bdt: number;
  category: 'needs' | 'wants' | 'savings_debt' | string;
}

export interface FinancialCalculation {
  id: string;
  owner_uid: string;
  title: string;
  period: 'monthly' | 'annual';
  income_items: CalculationIncomeItem[];
  deduction_items: CalculationDeductionItem[];
  expense_items: CalculationExpenseItem[];
  gross_income_bdt: number;
  total_deductions_bdt: number;
  net_income_bdt: number;
  total_expenses_bdt: number;
  net_surplus_bdt: number;
  savings_rate_pct: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
}
