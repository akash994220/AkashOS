import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  FinancialEntry,
  Budget,
  FinancialCalculation,
  CalculationIncomeItem,
  CalculationDeductionItem,
  CalculationExpenseItem,
} from '../../types/financial';
import { CurrencyDisplay } from './CurrencyDisplay';
import { formatBDT } from '../../lib/currency';
import {
  Calculator,
  History,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  Check,
  ArrowRight,
  Sliders,
  Percent,
  Layers,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search,
  ExternalLink,
  Edit2,
  X,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  PiggyBank,
  Wallet,
} from 'lucide-react';

interface CalculationHubProps {
  entries: FinancialEntry[];
  onApplyBudget?: (budget: Partial<Budget>) => Promise<void>;
  onSwitchTab?: (tab: string) => void;
}

// Preset templates for quick starting
const PRESET_SCENARIOS = [
  {
    name: 'Balanced Professional (৳80,000)',
    baseSalary: 75000,
    incomes: [
      { id: 'inc_allowance', label: 'Conveyance & Medical', amount_bdt: 5000, type: 'allowance' as const },
    ],
    deductions: [
      { id: 'ded_tax', label: 'Income Tax', amount_bdt: 4000, is_percentage: false, type: 'tax' as const },
      { id: 'ded_pf', label: 'Provident Fund (PF)', amount_bdt: 3750, is_percentage: true, percentage_value: 5, type: 'provident_fund' as const },
    ],
    expenses: [
      // Needs
      { id: 'exp_rent', label: 'House Rent & Service', amount_bdt: 24000, category: 'needs' },
      { id: 'exp_util', label: 'Utilities (Gas, Elec, Water)', amount_bdt: 4500, category: 'needs' },
      { id: 'exp_groc', label: 'Groceries & Household', amount_bdt: 12000, category: 'needs' },
      { id: 'exp_comm', label: 'Commute / Transport', amount_bdt: 4000, category: 'needs' },
      { id: 'exp_net', label: 'Internet & Mobile', amount_bdt: 1800, category: 'needs' },
      // Wants
      { id: 'exp_dine', label: 'Dining Out & Cafes', amount_bdt: 6000, category: 'wants' },
      { id: 'exp_ent', label: 'Entertainment & Subs', amount_bdt: 2000, category: 'wants' },
      { id: 'exp_shop', label: 'Shopping & Apparel', amount_bdt: 4000, category: 'wants' },
      // Savings & Debt
      { id: 'exp_dps', label: 'DPS / Fixed Deposit', amount_bdt: 8000, category: 'savings_debt' },
      { id: 'exp_emerg', label: 'Emergency Fund Savings', amount_bdt: 5000, category: 'savings_debt' },
    ],
  },
  {
    name: 'Starter / Entry Level (৳45,000)',
    baseSalary: 45000,
    incomes: [],
    deductions: [
      { id: 'ded_tax', label: 'Income Tax', amount_bdt: 1000, is_percentage: false, type: 'tax' as const },
    ],
    expenses: [
      // Needs
      { id: 'exp_rent', label: 'Bachelor Flat / Room Rent', amount_bdt: 12000, category: 'needs' },
      { id: 'exp_groc', label: 'Food & Groceries', amount_bdt: 8000, category: 'needs' },
      { id: 'exp_util', label: 'Bills & Utilities', amount_bdt: 2500, category: 'needs' },
      { id: 'exp_comm', label: 'Commute & Travel', amount_bdt: 3500, category: 'needs' },
      // Wants
      { id: 'exp_dine', label: 'Eating Out & Snacks', amount_bdt: 3500, category: 'wants' },
      { id: 'exp_shop', label: 'Personal Expenses', amount_bdt: 2500, category: 'wants' },
      // Savings
      { id: 'exp_dps', label: 'Emergency Reserve', amount_bdt: 6000, category: 'savings_debt' },
    ],
  },
  {
    name: 'Senior / High Earner (৳160,000)',
    baseSalary: 140000,
    incomes: [
      { id: 'inc_bonus', label: 'Performance Bonus / Retainer', amount_bdt: 20000, type: 'bonus' as const },
    ],
    deductions: [
      { id: 'ded_tax', label: 'Income Tax', amount_bdt: 15000, is_percentage: false, type: 'tax' as const },
      { id: 'ded_pf', label: 'Provident Fund (PF)', amount_bdt: 14000, is_percentage: true, percentage_value: 10, type: 'provident_fund' as const },
      { id: 'ded_ins', label: 'Health Insurance', amount_bdt: 3000, is_percentage: false, type: 'insurance' as const },
    ],
    expenses: [
      // Needs
      { id: 'exp_rent', label: 'Family Apartment Rent', amount_bdt: 42000, category: 'needs' },
      { id: 'exp_util', label: 'Utilities & Bills', amount_bdt: 7000, category: 'needs' },
      { id: 'exp_groc', label: 'Groceries & Organic', amount_bdt: 18000, category: 'needs' },
      { id: 'exp_comm', label: 'Car Fuel / Maintenance', amount_bdt: 8000, category: 'needs' },
      // Wants
      { id: 'exp_dine', label: 'Fine Dining & Weekends', amount_bdt: 12000, category: 'wants' },
      { id: 'exp_ent', label: 'Gadgets & Travel Fund', amount_bdt: 8000, category: 'wants' },
      { id: 'exp_shop', label: 'Shopping & Lifestyle', amount_bdt: 7000, category: 'wants' },
      // Savings & Debt
      { id: 'exp_dps', label: 'Monthly DPS / Stocks', amount_bdt: 20000, category: 'savings_debt' },
      { id: 'exp_fam', label: 'Family & Parents Support', amount_bdt: 10000, category: 'savings_debt' },
    ],
  },
];

export const CalculationHubView: React.FC<CalculationHubProps> = ({
  entries,
  onApplyBudget,
  onSwitchTab,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();

  // Primary active hub view: 'calculator' | 'history' | 'compare'
  const [activeSubView, setActiveSubView] = useState<'calculator' | 'history' | 'compare'>('calculator');

  // Calculation state
  const [calculationTitle, setCalculationTitle] = useState('My Rough Salary & Expenses Estimation');
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [baseSalary, setBaseSalary] = useState<number>(80000);
  const [incomeItems, setIncomeItems] = useState<CalculationIncomeItem[]>([
    { id: 'inc_1', label: 'Conveyance & Medical Allowance', amount_bdt: 5000, type: 'allowance' },
  ]);
  const [deductionItems, setDeductionItems] = useState<CalculationDeductionItem[]>([
    { id: 'ded_1', label: 'Estimated Income Tax', amount_bdt: 4000, is_percentage: false, type: 'tax' },
    { id: 'ded_2', label: 'Provident Fund (5%)', amount_bdt: 4000, is_percentage: true, percentage_value: 5, type: 'provident_fund' },
  ]);
  const [expenseItems, setExpenseItems] = useState<CalculationExpenseItem[]>([
    { id: 'exp_1', label: 'House Rent & Service', amount_bdt: 24000, category: 'needs' },
    { id: 'exp_2', label: 'Groceries & Provisions', amount_bdt: 12000, category: 'needs' },
    { id: 'exp_3', label: 'Utilities (Gas, Power, Water)', amount_bdt: 4500, category: 'needs' },
    { id: 'exp_4', label: 'Commute & Travel', amount_bdt: 4000, category: 'needs' },
    { id: 'exp_5', label: 'Internet & Mobile Bills', amount_bdt: 1800, category: 'needs' },
    { id: 'exp_6', label: 'Dining Out & Food Delivery', amount_bdt: 6000, category: 'wants' },
    { id: 'exp_7', label: 'Subscriptions & Entertainment', amount_bdt: 2000, category: 'wants' },
    { id: 'exp_8', label: 'Shopping & Personal Care', amount_bdt: 3500, category: 'wants' },
    { id: 'exp_9', label: 'DPS / Mutual Fund / Gold', amount_bdt: 8000, category: 'savings_debt' },
  ]);
  const [notes, setNotes] = useState('');

  // History state
  const [historyList, setHistoryList] = useState<FinancialCalculation[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedForCompareA, setSelectedForCompareA] = useState<string>('current');
  const [selectedForCompareB, setSelectedForCompareB] = useState<string>('');

  // Modals & UI feedback
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveScenarioName, setSaveScenarioName] = useState('');
  const [saveScenarioNotes, setSaveScenarioNotes] = useState('');
  const [savingHistory, setSavingHistory] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [appliedBudgetSuccess, setAppliedBudgetSuccess] = useState(false);

  // New item draft inputs
  const [newIncomeLabel, setNewIncomeLabel] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState<string>('');
  const [showAddIncome, setShowAddIncome] = useState(false);

  const [newDeductionLabel, setNewDeductionLabel] = useState('');
  const [newDeductionAmount, setNewDeductionAmount] = useState<string>('');
  const [newDeductionIsPct, setNewDeductionIsPct] = useState(false);
  const [showAddDeduction, setShowAddDeduction] = useState(false);

  const [newExpenseLabel, setNewExpenseLabel] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState<string>('');
  const [newExpenseCat, setNewExpenseCat] = useState<'needs' | 'wants' | 'savings_debt'>('needs');
  const [showAddExpense, setShowAddExpense] = useState(false);

  // 1. Subscribe to Firestore saved calculations
  useEffect(() => {
    if (!user || !db) return;
    const qCalc = query(
      collection(db, 'financial_calculations'),
      where('owner_uid', '==', user.uid)
    );
    const unsub = onSnapshot(
      qCalc,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinancialCalculation));
        list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        setHistoryList(list);
        if (list.length > 0 && !selectedForCompareB) {
          setSelectedForCompareB(list[0].id);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'financial_calculations')
    );
    return () => unsub();
  }, [user]);

  // Derived Calculations
  const totalOtherIncome = incomeItems.reduce((acc, curr) => acc + (Number(curr.amount_bdt) || 0), 0);
  const grossIncome = (Number(baseSalary) || 0) + totalOtherIncome;

  // Deductions calculation (handles % of base salary or fixed)
  const totalDeductions = deductionItems.reduce((acc, curr) => {
    if (curr.is_percentage && curr.percentage_value) {
      return acc + Math.round((Number(baseSalary) || 0) * (Number(curr.percentage_value) / 100));
    }
    return acc + (Number(curr.amount_bdt) || 0);
  }, 0);

  const netIncome = Math.max(0, grossIncome - totalDeductions);

  // Categorized expenses
  const needsExpenses = expenseItems
    .filter((e) => e.category === 'needs')
    .reduce((acc, curr) => acc + (Number(curr.amount_bdt) || 0), 0);

  const wantsExpenses = expenseItems
    .filter((e) => e.category === 'wants')
    .reduce((acc, curr) => acc + (Number(curr.amount_bdt) || 0), 0);

  const savingsDebtExpenses = expenseItems
    .filter((e) => e.category === 'savings_debt')
    .reduce((acc, curr) => acc + (Number(curr.amount_bdt) || 0), 0);

  const totalLivingExpenses = needsExpenses + wantsExpenses; // pure consumption
  const totalPlannedOutflows = needsExpenses + wantsExpenses + savingsDebtExpenses; // all outflows

  // Remaining Cash Flow (Net Salary - all expenses)
  const netSurplus = netIncome - totalPlannedOutflows;

  // Effective Savings (Explicit savings item + remaining surplus)
  const totalEffectiveSavings = Math.max(0, savingsDebtExpenses + (netSurplus > 0 ? netSurplus : 0));
  const savingsRatePct = netIncome > 0 ? Math.round((totalEffectiveSavings / netIncome) * 100) : 0;

  // 50/30/20 Percentages against Net Income
  const needsPct = netIncome > 0 ? Math.round((needsExpenses / netIncome) * 100) : 0;
  const wantsPct = netIncome > 0 ? Math.round((wantsExpenses / netIncome) * 100) : 0;
  const savingsPct = netIncome > 0 ? Math.round((totalEffectiveSavings / netIncome) * 100) : 0;

  // Daily & Weekly Allowances
  const safeDailyAllowance = Math.round(Math.max(0, netSurplus) / 30);
  const safeWeeklyAllowance = Math.round(Math.max(0, netSurplus) / 4.3);

  // Annual Projections
  const annualGross = grossIncome * 12;
  const annualNet = netIncome * 12;
  const annualExpenses = totalPlannedOutflows * 12;
  const annualPotentialSavings = totalEffectiveSavings * 12;

  // Handler: Add Income Stream
  const handleAddIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncomeLabel.trim() || !newIncomeAmount) return;
    const item: CalculationIncomeItem = {
      id: `inc_${Date.now()}`,
      label: newIncomeLabel.trim(),
      amount_bdt: parseFloat(newIncomeAmount) || 0,
      type: 'other',
    };
    setIncomeItems([...incomeItems, item]);
    setNewIncomeLabel('');
    setNewIncomeAmount('');
    setShowAddIncome(false);
  };

  // Handler: Add Deduction
  const handleAddDeduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeductionLabel.trim() || !newDeductionAmount) return;
    const val = parseFloat(newDeductionAmount) || 0;
    const item: CalculationDeductionItem = {
      id: `ded_${Date.now()}`,
      label: newDeductionLabel.trim(),
      amount_bdt: newDeductionIsPct ? Math.round((baseSalary * val) / 100) : val,
      is_percentage: newDeductionIsPct,
      percentage_value: newDeductionIsPct ? val : undefined,
      type: 'other',
    };
    setDeductionItems([...deductionItems, item]);
    setNewDeductionLabel('');
    setNewDeductionAmount('');
    setNewDeductionIsPct(false);
    setShowAddDeduction(false);
  };

  // Handler: Add Expense Item
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseLabel.trim() || !newExpenseAmount) return;
    const item: CalculationExpenseItem = {
      id: `exp_${Date.now()}`,
      label: newExpenseLabel.trim(),
      amount_bdt: parseFloat(newExpenseAmount) || 0,
      category: newExpenseCat,
    };
    setExpenseItems([...expenseItems, item]);
    setNewExpenseLabel('');
    setNewExpenseAmount('');
    setShowAddExpense(false);
  };

  // Handler: Apply Preset
  const handleApplyPreset = (presetIndex: number) => {
    const preset = PRESET_SCENARIOS[presetIndex];
    if (!preset) return;
    setCalculationTitle(preset.name);
    setBaseSalary(preset.baseSalary);
    setIncomeItems(preset.incomes);
    setDeductionItems(preset.deductions);
    setExpenseItems(preset.expenses);
  };

  // Handler: Import recorded expenses from actual financial ledger
  const handleImportRecordedExpenses = () => {
    const expenseEntries = entries.filter((e) => e.entry_type === 'expense');
    if (expenseEntries.length === 0) {
      alert('No recorded expenses found in your financial ledger yet to import.');
      return;
    }

    // Group expenses by category
    const catMap: Record<string, number> = {};
    expenseEntries.forEach((e) => {
      const cat = e.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + (e.amount_bdt || 0);
    });

    // Approximate monthly values based on distinct months or entries
    const dates = expenseEntries.map((e) => e.date?.substring(0, 7)).filter(Boolean);
    const uniqueMonths = new Set(dates).size || 1;

    const importedExpenses: CalculationExpenseItem[] = Object.entries(catMap).map(
      ([cat, total], idx) => {
        const monthlyAvg = Math.round(total / uniqueMonths);
        const lower = cat.toLowerCase();
        let group: 'needs' | 'wants' | 'savings_debt' = 'needs';
        if (lower.includes('dine') || lower.includes('food') || lower.includes('shop') || lower.includes('entertainment')) {
          group = 'wants';
        } else if (lower.includes('saving') || lower.includes('debt') || lower.includes('loan') || lower.includes('invest')) {
          group = 'savings_debt';
        }
        return {
          id: `imp_exp_${idx}_${Date.now()}`,
          label: cat,
          amount_bdt: monthlyAvg,
          category: group,
        };
      }
    );

    setExpenseItems(importedExpenses);
    setCalculationTitle(`Scenario (Imported from Ledger - ${uniqueMonths} mo avg)`);
  };

  // Handler: Save Snapshot to Firestore History
  const handleSaveToHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingHistory(true);
    const docId = `calc_${Date.now()}`;
    const payload: FinancialCalculation = {
      id: docId,
      owner_uid: user.uid,
      title: saveScenarioName.trim() || calculationTitle || `Calculation (${new Date().toLocaleDateString()})`,
      period,
      income_items: incomeItems,
      deduction_items: deductionItems.map((d) => ({
        ...d,
        amount_bdt: d.is_percentage && d.percentage_value
          ? Math.round((baseSalary * d.percentage_value) / 100)
          : d.amount_bdt,
      })),
      expense_items: expenseItems,
      gross_income_bdt: grossIncome,
      total_deductions_bdt: totalDeductions,
      net_income_bdt: netIncome,
      total_expenses_bdt: totalPlannedOutflows,
      net_surplus_bdt: netSurplus,
      savings_rate_pct: savingsRatePct,
      notes: saveScenarioNotes.trim() || notes.trim() || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'financial_calculations', docId), payload);
      setShowSaveModal(false);
      setSaveScenarioName('');
      setSaveScenarioNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `financial_calculations/${docId}`);
    } finally {
      setSavingHistory(false);
    }
  };

  // Handler: Load Saved Calculation back into Calculator
  const handleLoadCalculation = (calc: FinancialCalculation) => {
    setCalculationTitle(calc.title);
    setPeriod(calc.period || 'monthly');
    const base = calc.income_items?.find((i) => i.type === 'base');
    if (base) {
      setBaseSalary(base.amount_bdt);
      setIncomeItems(calc.income_items.filter((i) => i.id !== base.id));
    } else {
      // If base wasn't stored as separate item, deduce from gross or keep current
      setBaseSalary(calc.gross_income_bdt - (calc.income_items?.reduce((a, c) => a + c.amount_bdt, 0) || 0) || 80000);
      setIncomeItems(calc.income_items || []);
    }
    setDeductionItems(calc.deduction_items || []);
    setExpenseItems(calc.expense_items || []);
    setNotes(calc.notes || '');
    setActiveSubView('calculator');
  };

  // Handler: Delete Calculation from History
  const handleDeleteCalculation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this saved calculation?')) return;
    try {
      await deleteDoc(doc(db, 'financial_calculations', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `financial_calculations/${id}`);
    }
  };

  // Handler: Copy formatted text summary
  const handleCopySummary = () => {
    const text = `
=== ${calculationTitle} ===
Period: ${period === 'monthly' ? 'Monthly' : 'Annual'}
Gross Income: ৳${grossIncome.toLocaleString()}
Total Deductions & Taxes: ৳${totalDeductions.toLocaleString()}
Net In-Hand Salary: ৳${netIncome.toLocaleString()}
-----------------------------------
Total Expenses: ৳${totalPlannedOutflows.toLocaleString()}
  - Needs (Rent, Bills, Food): ৳${needsExpenses.toLocaleString()} (${needsPct}%)
  - Wants (Dining, Shopping): ৳${wantsExpenses.toLocaleString()} (${wantsPct}%)
  - Savings & Debt Payments: ৳${savingsDebtExpenses.toLocaleString()}
-----------------------------------
Net Disposable Surplus: ৳${netSurplus.toLocaleString()}
Overall Savings Rate: ${savingsRatePct}%
Safe Daily Allowance: ৳${safeDailyAllowance.toLocaleString()} / day
Safe Weekly Allowance: ৳${safeWeeklyAllowance.toLocaleString()} / week
Annual Potential Savings: ৳${annualPotentialSavings.toLocaleString()}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  // Handler: Apply as Monthly Budgets in the actual Budget view
  const handleApplyAsBudgets = async () => {
    if (!onApplyBudget) return;
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    try {
      for (const item of expenseItems) {
        await onApplyBudget({
          category: item.label,
          monthly_limit_bdt: item.amount_bdt,
          month: currentMonth,
        });
      }
      setAppliedBudgetSuccess(true);
      setTimeout(() => setAppliedBudgetSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to apply budgets', err);
    }
  };

  // Comparison logic
  const getCalculationById = (id: string) => {
    if (id === 'current') {
      return {
        id: 'current',
        title: calculationTitle || 'Current Active Calculation',
        gross_income_bdt: grossIncome,
        total_deductions_bdt: totalDeductions,
        net_income_bdt: netIncome,
        total_expenses_bdt: totalPlannedOutflows,
        needs_expenses: needsExpenses,
        wants_expenses: wantsExpenses,
        savings_debt: savingsDebtExpenses,
        net_surplus_bdt: netSurplus,
        savings_rate_pct: savingsRatePct,
        created_at: new Date().toISOString(),
      };
    }
    const found = historyList.find((h) => h.id === id);
    if (!found) return null;
    const n = (found.expense_items || [])
      .filter((e) => e.category === 'needs')
      .reduce((a, c) => a + c.amount_bdt, 0);
    const w = (found.expense_items || [])
      .filter((e) => e.category === 'wants')
      .reduce((a, c) => a + c.amount_bdt, 0);
    const s = (found.expense_items || [])
      .filter((e) => e.category === 'savings_debt')
      .reduce((a, c) => a + c.amount_bdt, 0);
    return {
      ...found,
      needs_expenses: n,
      wants_expenses: w,
      savings_debt: s,
    };
  };

  const compA = getCalculationById(selectedForCompareA);
  const compB = getCalculationById(selectedForCompareB);

  const filteredHistory = historyList.filter((h) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return h.title.toLowerCase().includes(q) || (h.notes || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Top Bar: Sub Navigation & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-zinc-200">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveSubView('calculator')}
            style={{
              borderRadius: theme.radius.full,
              backgroundColor: activeSubView === 'calculator' ? theme.colors.accent : theme.colors.bgSecondary,
              color: activeSubView === 'calculator' ? theme.colors.accentText : theme.colors.textSecondary,
              minHeight: '34px',
            }}
            className="flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold cursor-pointer transition-colors"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Interactive Calculator</span>
          </button>

          <button
            onClick={() => setActiveSubView('history')}
            style={{
              borderRadius: theme.radius.full,
              backgroundColor: activeSubView === 'history' ? theme.colors.accent : theme.colors.bgSecondary,
              color: activeSubView === 'history' ? theme.colors.accentText : theme.colors.textSecondary,
              minHeight: '34px',
            }}
            className="flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold cursor-pointer transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            <span>Calculation History</span>
            {historyList.length > 0 && (
              <span
                style={{
                  backgroundColor: activeSubView === 'history' ? 'rgba(255,255,255,0.25)' : theme.colors.bgTertiary,
                }}
                className="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
              >
                {historyList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubView('compare')}
            style={{
              borderRadius: theme.radius.full,
              backgroundColor: activeSubView === 'compare' ? theme.colors.accent : theme.colors.bgSecondary,
              color: activeSubView === 'compare' ? theme.colors.accentText : theme.colors.textSecondary,
              minHeight: '34px',
            }}
            className="flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold cursor-pointer transition-colors"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Compare Scenarios</span>
          </button>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2">
          {activeSubView === 'calculator' && (
            <>
              <button
                onClick={handleCopySummary}
                style={{
                  backgroundColor: theme.colors.bgCard,
                  borderColor: theme.colors.borderLight,
                  borderRadius: theme.radius.full,
                  minHeight: '32px',
                }}
                className="flex items-center gap-1.5 px-3 py-1 border text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer shadow-2xs"
                title="Copy formatted calculation summary"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
              </button>

              <button
                onClick={() => {
                  setSaveScenarioName(calculationTitle);
                  setShowSaveModal(true);
                }}
                style={{
                  backgroundColor: theme.colors.accent,
                  color: theme.colors.accentText,
                  borderRadius: theme.radius.full,
                  minHeight: '32px',
                }}
                className="flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold hover:opacity-90 cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save to History</span>
              </button>
            </>
          )}
        </div>
      </div>

      {appliedBudgetSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Successfully updated category limits in the <strong>Budgets</strong> tab for this month!</span>
          </div>
          {onSwitchTab && (
            <button
              onClick={() => onSwitchTab('budgets')}
              className="font-bold underline text-emerald-900 cursor-pointer ml-2"
            >
              View Budgets
            </button>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SUBVIEW 1: ACTIVE CALCULATOR & BREAKDOWN */}
      {/* ========================================================= */}
      {activeSubView === 'calculator' && (
        <div className="space-y-4">
          {/* Preset Bar & Title */}
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderColor: theme.colors.borderLight,
              borderRadius: theme.radius.lg,
            }}
            className="p-3.5 border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={calculationTitle}
                  onChange={(e) => setCalculationTitle(e.target.value)}
                  placeholder="Enter scenario name (e.g. Q2 Expected Increment)..."
                  className="font-bold text-sm sm:text-base text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-blue-500 focus:outline-none w-full"
                />
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Simulate your monthly take-home salary, budget living expenses, and see your exact disposable cash.
              </p>
            </div>

            {/* Presets and import */}
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <span className="text-[11px] text-zinc-400 font-medium">Presets:</span>
              {PRESET_SCENARIOS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(idx)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md cursor-pointer transition-colors"
                >
                  {p.name.split(' ')[0]}
                </button>
              ))}

              <button
                onClick={handleImportRecordedExpenses}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md cursor-pointer transition-colors"
                title="Populate rough expenses from actual logged expenses in Financial ledger"
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>Import from Ledger</span>
              </button>
            </div>
          </div>

          {/* HERO METRICS CARDS (Sticky / High-Visibility Grid) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* 1. Gross Income */}
            <div
              style={{
                backgroundColor: theme.colors.bgCard,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.lg,
              }}
              className="p-3.5 border shadow-xs"
            >
              <div className="flex items-center justify-between text-zinc-500 text-xs mb-1">
                <span>Gross Income</span>
                <Wallet className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div className="text-base sm:text-lg font-bold text-zinc-900">
                <CurrencyDisplay amountBdt={grossIncome} size="md" />
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Base ৳{baseSalary.toLocaleString()} + Other ৳{totalOtherIncome.toLocaleString()}
              </p>
            </div>

            {/* 2. Total Deductions */}
            <div
              style={{
                backgroundColor: theme.colors.bgCard,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.lg,
              }}
              className="p-3.5 border shadow-xs"
            >
              <div className="flex items-center justify-between text-zinc-500 text-xs mb-1">
                <span>Taxes & Deductions</span>
                <Percent className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-base sm:text-lg font-bold text-amber-700">
                -<CurrencyDisplay amountBdt={totalDeductions} size="md" />
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                {grossIncome > 0 ? Math.round((totalDeductions / grossIncome) * 100) : 0}% of gross salary
              </p>
            </div>

            {/* 3. Net Take-Home Salary */}
            <div
              style={{
                backgroundColor: theme.colors.bgCard,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.lg,
              }}
              className="p-3.5 border shadow-xs bg-gradient-to-br from-blue-50/40 to-transparent"
            >
              <div className="flex items-center justify-between text-blue-700 text-xs font-semibold mb-1">
                <span>In-Hand Net Salary</span>
                <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-base sm:text-lg font-bold text-blue-900">
                <CurrencyDisplay amountBdt={netIncome} size="md" />
              </div>
              <p className="text-[10px] text-blue-600/80 mt-0.5">
                Actual bank deposit amount
              </p>
            </div>

            {/* 4. Net Remaining Disposable Cash */}
            <div
              style={{
                backgroundColor: theme.colors.bgCard,
                borderColor: netSurplus >= 0 ? '#BBF7D0' : '#FECDD3',
                borderRadius: theme.radius.lg,
              }}
              className={`p-3.5 border shadow-xs ${
                netSurplus >= 0 ? 'bg-emerald-50/30' : 'bg-rose-50/30'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span className={netSurplus >= 0 ? 'text-emerald-800' : 'text-rose-800'}>
                  {netSurplus >= 0 ? 'Monthly Surplus Leftover' : 'Budget Deficit Warning'}
                </span>
                <PiggyBank className={`w-3.5 h-3.5 ${netSurplus >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
              </div>
              <div className={`text-base sm:text-lg font-bold ${netSurplus >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {netSurplus < 0 && '-'}
                <CurrencyDisplay amountBdt={Math.abs(netSurplus)} size="md" />
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {netSurplus >= 0
                  ? `Safe daily: ৳${safeDailyAllowance.toLocaleString()} / day`
                  : 'Expenses exceed net salary!'}
              </p>
            </div>
          </div>

          {/* 50/30/20 Rule Analysis & Spending Health Bar */}
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderColor: theme.colors.borderLight,
              borderRadius: theme.radius.lg,
            }}
            className="p-4 border shadow-xs space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>50/30/20 Budgeting Rule Analysis</span>
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Ideal framework: 50% Essential Needs, 30% Lifestyle Wants, 20% Savings & Debt elimination.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-zinc-600">Needs: <strong>{needsPct}%</strong> (Target 50%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="text-zinc-600">Wants: <strong>{wantsPct}%</strong> (Target 30%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-zinc-600">Savings: <strong>{savingsPct}%</strong> (Target 20%)</span>
                </div>
              </div>
            </div>

            {/* Segmented Progress Bar */}
            <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${Math.min(needsPct, 100)}%` }}
                className="bg-blue-500 transition-all duration-300"
                title={`Needs: ${needsPct}% (৳${needsExpenses.toLocaleString()})`}
              />
              <div
                style={{ width: `${Math.min(wantsPct, 100 - needsPct)}%` }}
                className="bg-purple-500 transition-all duration-300"
                title={`Wants: ${wantsPct}% (৳${wantsExpenses.toLocaleString()})`}
              />
              <div
                style={{ width: `${Math.min(savingsPct, 100 - needsPct - wantsPct)}%` }}
                className="bg-emerald-500 transition-all duration-300"
                title={`Savings: ${savingsPct}% (৳${totalEffectiveSavings.toLocaleString()})`}
              />
            </div>

            {/* Health verdict badge */}
            <div className="flex flex-wrap items-center justify-between text-xs text-zinc-600 pt-1">
              <div className="flex items-center gap-1.5">
                {needsPct > 60 ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                    <AlertTriangle className="w-3 h-3" />
                    Essential needs are {needsPct}%, slightly higher than the 50% target.
                  </span>
                ) : wantsPct > 35 ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                    <AlertTriangle className="w-3 h-3" />
                    Lifestyle wants are {wantsPct}%, exceeding the 30% guideline.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Well-balanced financial structure! You are saving {savingsPct}% of net income.
                  </span>
                )}
              </div>

              <div className="text-[11px] text-zinc-400">
                Annual Wealth Building Potential: <strong className="text-zinc-700">৳{annualPotentialSavings.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* MAIN TWO-COLUMN WORKBENCH: SALARY/INCOME ON LEFT, EXPENSES ON RIGHT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* LEFT COLUMN: INCOME & DEDUCTIONS (5 COLS) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Income Panel */}
              <div
                style={{
                  backgroundColor: theme.colors.bgCard,
                  borderColor: theme.colors.borderLight,
                  borderRadius: theme.radius.lg,
                }}
                className="p-4 border shadow-xs space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                    <span>Salary & Income Streams</span>
                  </h3>
                  <span className="text-xs font-bold text-blue-700">
                    ৳{grossIncome.toLocaleString()}
                  </span>
                </div>

                {/* Base Monthly Salary */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium text-zinc-700">
                    <label>Base Monthly Salary</label>
                    <span className="text-[11px] text-zinc-400">Main monthly wage</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">৳</span>
                    <input
                      type="number"
                      value={baseSalary || ''}
                      onChange={(e) => setBaseSalary(parseFloat(e.target.value) || 0)}
                      className="w-full pl-7 pr-3 py-1.5 text-sm font-semibold border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      placeholder="e.g. 75000"
                    />
                  </div>
                </div>

                {/* Additional Income Items */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 uppercase">
                    <span>Other Incomes / Allowances</span>
                    <button
                      onClick={() => setShowAddIncome(!showAddIncome)}
                      className="text-blue-600 hover:text-blue-800 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Stream
                    </button>
                  </div>

                  {showAddIncome && (
                    <form onSubmit={handleAddIncome} className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Freelance, Bonus"
                          value={newIncomeLabel}
                          onChange={(e) => setNewIncomeLabel(e.target.value)}
                          className="px-2 py-1 text-xs border rounded bg-white"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Amount ৳"
                          value={newIncomeAmount}
                          onChange={(e) => setNewIncomeAmount(e.target.value)}
                          className="px-2 py-1 text-xs border rounded bg-white"
                          required
                        />
                      </div>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowAddIncome(false)}
                          className="px-2 py-0.5 text-xs text-zinc-500"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Add
                        </button>
                      </div>
                    </form>
                  )}

                  {incomeItems.length === 0 ? (
                    <p className="text-[11px] text-zinc-400 italic">No additional income streams added.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {incomeItems.map((inc) => (
                        <div
                          key={inc.id}
                          className="flex items-center justify-between p-2 rounded-md bg-zinc-50/70 border border-zinc-100 text-xs"
                        >
                          <span className="font-medium text-zinc-700 truncate">{inc.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-900">৳{inc.amount_bdt.toLocaleString()}</span>
                            <button
                              onClick={() => setIncomeItems(incomeItems.filter((i) => i.id !== inc.id))}
                              className="text-zinc-400 hover:text-rose-600 cursor-pointer p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Deductions & Taxes Panel */}
              <div
                style={{
                  backgroundColor: theme.colors.bgCard,
                  borderColor: theme.colors.borderLight,
                  borderRadius: theme.radius.lg,
                }}
                className="p-4 border shadow-xs space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-amber-600" />
                    <span>Deductions & Taxes</span>
                  </h3>
                  <span className="text-xs font-bold text-amber-700">
                    -৳{totalDeductions.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 uppercase">
                  <span>Deduction Breakdown</span>
                  <button
                    onClick={() => setShowAddDeduction(!showAddDeduction)}
                    className="text-amber-600 hover:text-amber-800 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Deduction
                  </button>
                </div>

                {showAddDeduction && (
                  <form onSubmit={handleAddDeduction} className="p-2.5 bg-amber-50/50 border border-amber-200 rounded-lg space-y-2">
                    <input
                      type="text"
                      placeholder="e.g. Health Insurance, Loan Recovery"
                      value={newDeductionLabel}
                      onChange={(e) => setNewDeductionLabel(e.target.value)}
                      className="w-full px-2 py-1 text-xs border rounded bg-white"
                      required
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder={newDeductionIsPct ? '% of base salary' : 'Amount ৳'}
                        value={newDeductionAmount}
                        onChange={(e) => setNewDeductionAmount(e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded bg-white"
                        required
                      />
                      <label className="flex items-center gap-1 text-[11px] text-zinc-600 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newDeductionIsPct}
                          onChange={(e) => setNewDeductionIsPct(e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        <span>Is %</span>
                      </label>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowAddDeduction(false)}
                        className="px-2 py-0.5 text-xs text-zinc-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-2.5 py-0.5 text-xs font-semibold bg-amber-600 text-white rounded hover:bg-amber-700"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1.5">
                  {deductionItems.map((ded) => {
                    const effectiveAmount =
                      ded.is_percentage && ded.percentage_value
                        ? Math.round((baseSalary * ded.percentage_value) / 100)
                        : ded.amount_bdt;

                    return (
                      <div
                        key={ded.id}
                        className="flex items-center justify-between p-2 rounded-md bg-zinc-50/70 border border-zinc-100 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-medium text-zinc-700 truncate block">{ded.label}</span>
                          {ded.is_percentage && (
                            <span className="text-[10px] text-zinc-400">
                              {ded.percentage_value}% of ৳{baseSalary.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-semibold text-amber-800">-৳{effectiveAmount.toLocaleString()}</span>
                          <button
                            onClick={() => setDeductionItems(deductionItems.filter((d) => d.id !== ded.id))}
                            className="text-zinc-400 hover:text-rose-600 cursor-pointer p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotal of In-hand salary */}
                <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-800">Net In-Hand Salary:</span>
                  <span className="font-bold text-blue-700 text-sm">৳{netIncome.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: ROUGH LIVING EXPENSES (7 COLS) */}
            <div className="lg:col-span-7 space-y-4">
              <div
                style={{
                  backgroundColor: theme.colors.bgCard,
                  borderColor: theme.colors.borderLight,
                  borderRadius: theme.radius.lg,
                }}
                className="p-4 border shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
                      <span>Rough Estimated Living Expenses</span>
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Tweak amounts to simulate your actual monthly cash outflows.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">
                      Total: ৳{totalPlannedOutflows.toLocaleString()}
                    </span>
                    <button
                      onClick={() => setShowAddExpense(!showAddExpense)}
                      style={{
                        backgroundColor: theme.colors.accent,
                        color: theme.colors.accentText,
                        borderRadius: theme.radius.md,
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold cursor-pointer shadow-xs shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Expense</span>
                    </button>
                  </div>
                </div>

                {/* Add Expense Form Modal / Box */}
                {showAddExpense && (
                  <form onSubmit={handleAddExpense} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2.5">
                    <div className="text-xs font-semibold text-zinc-800">Add Rough Expense Item</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Item name (e.g. Gym, Fuel)"
                        value={newExpenseLabel}
                        onChange={(e) => setNewExpenseLabel(e.target.value)}
                        className="px-2.5 py-1 text-xs border rounded-lg bg-white"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Amount ৳"
                        value={newExpenseAmount}
                        onChange={(e) => setNewExpenseAmount(e.target.value)}
                        className="px-2.5 py-1 text-xs border rounded-lg bg-white"
                        required
                      />
                      <select
                        value={newExpenseCat}
                        onChange={(e) => setNewExpenseCat(e.target.value as any)}
                        className="px-2 py-1 text-xs border rounded-lg bg-white"
                      >
                        <option value="needs">Needs (Essential 50%)</option>
                        <option value="wants">Wants (Lifestyle 30%)</option>
                        <option value="savings_debt">Savings & Debt (20%)</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddExpense(false)}
                        className="px-3 py-1 text-xs text-zinc-600 hover:text-zinc-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs font-semibold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
                      >
                        Save Expense
                      </button>
                    </div>
                  </form>
                )}

                {/* 3 Categories: Needs, Wants, Savings */}
                <div className="space-y-3">
                  {/* Category 1: Needs */}
                  <div className="border border-blue-100 bg-blue-50/20 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>Essential Needs (Rent, Utilities, Food, Commute)</span>
                      </div>
                      <span>৳{needsExpenses.toLocaleString()} ({needsPct}%)</span>
                    </div>

                    <div className="space-y-1.5">
                      {expenseItems
                        .filter((e) => e.category === 'needs')
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white border border-blue-100 text-xs shadow-2xs hover:border-blue-300 transition-colors"
                          >
                            <span className="font-medium text-zinc-800">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">৳</span>
                                <input
                                  type="number"
                                  value={item.amount_bdt || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setExpenseItems(
                                      expenseItems.map((ex) => (ex.id === item.id ? { ...ex, amount_bdt: val } : ex))
                                    );
                                  }}
                                  className="w-24 pl-5 pr-2 py-0.5 text-xs font-bold text-right border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-zinc-50/50"
                                />
                              </div>
                              <button
                                onClick={() => setExpenseItems(expenseItems.filter((e) => e.id !== item.id))}
                                className="text-zinc-300 hover:text-rose-600 cursor-pointer p-0.5"
                                title="Remove expense"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Category 2: Wants */}
                  <div className="border border-purple-100 bg-purple-50/20 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <span>Lifestyle Wants (Dining, Shopping, Entertainment)</span>
                      </div>
                      <span>৳{wantsExpenses.toLocaleString()} ({wantsPct}%)</span>
                    </div>

                    <div className="space-y-1.5">
                      {expenseItems
                        .filter((e) => e.category === 'wants')
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white border border-purple-100 text-xs shadow-2xs hover:border-purple-300 transition-colors"
                          >
                            <span className="font-medium text-zinc-800">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">৳</span>
                                <input
                                  type="number"
                                  value={item.amount_bdt || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setExpenseItems(
                                      expenseItems.map((ex) => (ex.id === item.id ? { ...ex, amount_bdt: val } : ex))
                                    );
                                  }}
                                  className="w-24 pl-5 pr-2 py-0.5 text-xs font-bold text-right border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 bg-zinc-50/50"
                                />
                              </div>
                              <button
                                onClick={() => setExpenseItems(expenseItems.filter((e) => e.id !== item.id))}
                                className="text-zinc-300 hover:text-rose-600 cursor-pointer p-0.5"
                                title="Remove expense"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Category 3: Savings & Debt */}
                  <div className="border border-emerald-100 bg-emerald-50/20 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Planned Savings & Debt (DPS, Emergency Fund, Loans)</span>
                      </div>
                      <span>৳{savingsDebtExpenses.toLocaleString()}</span>
                    </div>

                    <div className="space-y-1.5">
                      {expenseItems
                        .filter((e) => e.category === 'savings_debt')
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white border border-emerald-100 text-xs shadow-2xs hover:border-emerald-300 transition-colors"
                          >
                            <span className="font-medium text-zinc-800">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">৳</span>
                                <input
                                  type="number"
                                  value={item.amount_bdt || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setExpenseItems(
                                      expenseItems.map((ex) => (ex.id === item.id ? { ...ex, amount_bdt: val } : ex))
                                    );
                                  }}
                                  className="w-24 pl-5 pr-2 py-0.5 text-xs font-bold text-right border border-zinc-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-zinc-50/50"
                                />
                              </div>
                              <button
                                onClick={() => setExpenseItems(expenseItems.filter((e) => e.id !== item.id))}
                                className="text-zinc-300 hover:text-rose-600 cursor-pointer p-0.5"
                                title="Remove expense"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Optional Connected action: Apply as Budgets */}
                {onApplyBudget && (
                  <div className="pt-2 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-[11px] text-zinc-500">
                      Happy with this rough plan? You can apply these categories directly as your monthly spending limits.
                    </p>
                    <button
                      type="button"
                      onClick={handleApplyAsBudgets}
                      className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                    >
                      Export to Monthly Budgets
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUBVIEW 2: CALCULATION HISTORY & SAVED SCENARIOS */}
      {/* ========================================================= */}
      {activeSubView === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-zinc-900 tracking-tight">
                Calculation History & Saved Scenarios
              </h2>
              <p className="text-xs text-zinc-500">
                All saved rough salary and expense estimates stored securely in your history.
              </p>
            </div>

            {/* Search */}
            <div
              style={{
                backgroundColor: theme.colors.bgCard,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.full,
              }}
              className="flex items-center gap-2 px-3 py-1 border text-xs sm:w-64 shadow-2xs"
            >
              <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <input
                type="text"
                placeholder="Search saved scenarios..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="bg-transparent w-full focus:outline-none text-xs text-zinc-900 placeholder:text-zinc-400 py-0.5"
              />
              {historySearch && (
                <button onClick={() => setHistorySearch('')} className="text-zinc-400 hover:text-zinc-700">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div
              style={{
                backgroundColor: theme.colors.bgCard,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.lg,
              }}
              className="p-8 border text-center space-y-3"
            >
              <Calculator className="w-8 h-8 text-zinc-300 mx-auto" />
              <p className="text-sm font-semibold text-zinc-700">No saved calculations found</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {historySearch
                  ? 'Try a different search keyword.'
                  : 'Run a calculation in the interactive calculator and click "Save to History" to preserve scenarios over time.'}
              </p>
              <button
                onClick={() => setActiveSubView('calculator')}
                style={{
                  backgroundColor: theme.colors.accent,
                  color: theme.colors.accentText,
                  borderRadius: theme.radius.md,
                }}
                className="px-4 py-1.5 text-xs font-semibold cursor-pointer hover:opacity-90 inline-flex items-center gap-1.5"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Go to Calculator</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredHistory.map((item) => {
                const dateStr = item.created_at
                  ? new Date(item.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Recent';

                const isSurplus = item.net_surplus_bdt >= 0;

                return (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: theme.colors.bgCard,
                      borderColor: theme.colors.borderLight,
                      borderRadius: theme.radius.lg,
                    }}
                    className="p-4 border shadow-xs flex flex-col justify-between hover:border-zinc-400 hover:shadow-md transition-all group"
                  >
                    <div>
                      {/* Title & Date */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-zinc-900 truncate" title={item.title}>
                            {item.title}
                          </h3>
                          <span className="text-[10px] text-zinc-400">{dateStr}</span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            isSurplus
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isSurplus ? 'Surplus' : 'Deficit'}
                        </span>
                      </div>

                      {/* Notes if any */}
                      {item.notes && (
                        <p className="text-xs text-zinc-500 line-clamp-2 mb-3 italic">
                          "{item.notes}"
                        </p>
                      )}

                      {/* Key Figures Grid */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 bg-zinc-50/80 rounded-lg border border-zinc-100 text-xs mb-3">
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Gross Income</span>
                          <span className="font-bold text-zinc-800">৳{item.gross_income_bdt.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Net In-Hand</span>
                          <span className="font-bold text-blue-700">৳{item.net_income_bdt.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Expenses</span>
                          <span className="font-bold text-rose-700">৳{item.total_expenses_bdt.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Net Leftover</span>
                          <span className={`font-bold ${isSurplus ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {isSurplus ? '+' : '-'}৳{Math.abs(item.net_surplus_bdt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Savings Rate Tag */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-2">
                        <span>Savings Rate:</span>
                        <strong className="text-zinc-800">{item.savings_rate_pct}%</strong>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-1">
                      <button
                        onClick={() => handleLoadCalculation(item)}
                        className="flex-1 py-1.5 px-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Load in Hub</span>
                      </button>

                      <button
                        onClick={(e) => handleDeleteCalculation(item.id, e)}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SUBVIEW 3: COMPARE SCENARIOS SIDE-BY-SIDE */}
      {/* ========================================================= */}
      {activeSubView === 'compare' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">
              Scenario Comparison Matrix
            </h2>
            <p className="text-xs text-zinc-500">
              Compare your current active calculation against saved historical scenarios to see exact financial differences.
            </p>
          </div>

          {/* Scenario Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Scenario A</label>
              <select
                value={selectedForCompareA}
                onChange={(e) => setSelectedForCompareA(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-semibold border border-zinc-200 rounded-lg bg-white"
              >
                <option value="current">Current Active Workbench</option>
                {historyList.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title} (৳{h.net_income_bdt.toLocaleString()} Net)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Scenario B</label>
              <select
                value={selectedForCompareB}
                onChange={(e) => setSelectedForCompareB(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-semibold border border-zinc-200 rounded-lg bg-white"
              >
                <option value="">Select a scenario to compare...</option>
                <option value="current">Current Active Workbench</option>
                {historyList.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.title} (৳{h.net_income_bdt.toLocaleString()} Net)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Table */}
          {compA && compB ? (
            <div
              style={{
                backgroundColor: theme.colors.bgCard,
                borderColor: theme.colors.borderLight,
                borderRadius: theme.radius.lg,
              }}
              className="border shadow-xs overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100/70 border-b border-zinc-200 text-zinc-600">
                      <th className="py-2.5 px-4 text-left font-bold">Metric</th>
                      <th className="py-2.5 px-4 text-right font-bold text-blue-900">{compA.title}</th>
                      <th className="py-2.5 px-4 text-right font-bold text-purple-900">{compB.title}</th>
                      <th className="py-2.5 px-4 text-right font-bold">Variance (Δ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-zinc-700">Gross Monthly Income</td>
                      <td className="py-2.5 px-4 text-right font-bold">৳{compA.gross_income_bdt.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold">৳{compB.gross_income_bdt.toLocaleString()}</td>
                      <td className={`py-2.5 px-4 text-right font-bold ${compA.gross_income_bdt >= compB.gross_income_bdt ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {compA.gross_income_bdt - compB.gross_income_bdt >= 0 ? '+' : ''}
                        ৳{(compA.gross_income_bdt - compB.gross_income_bdt).toLocaleString()}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-zinc-700">Taxes & Deductions</td>
                      <td className="py-2.5 px-4 text-right font-bold text-amber-700">৳{compA.total_deductions_bdt.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-amber-700">৳{compB.total_deductions_bdt.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-zinc-600">
                        {compA.total_deductions_bdt - compB.total_deductions_bdt >= 0 ? '+' : ''}
                        ৳{(compA.total_deductions_bdt - compB.total_deductions_bdt).toLocaleString()}
                      </td>
                    </tr>

                    <tr className="bg-blue-50/30">
                      <td className="py-2.5 px-4 font-bold text-blue-900">Net In-Hand Salary</td>
                      <td className="py-2.5 px-4 text-right font-bold text-blue-900">৳{compA.net_income_bdt.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-blue-900">৳{compB.net_income_bdt.toLocaleString()}</td>
                      <td className={`py-2.5 px-4 text-right font-bold ${compA.net_income_bdt >= compB.net_income_bdt ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {compA.net_income_bdt - compB.net_income_bdt >= 0 ? '+' : ''}
                        ৳{(compA.net_income_bdt - compB.net_income_bdt).toLocaleString()}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-zinc-700">Essential Needs</td>
                      <td className="py-2.5 px-4 text-right font-bold">৳{((compA as any).needs_expenses || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold">৳{((compB as any).needs_expenses || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-zinc-600">
                        {((compA as any).needs_expenses || 0) - ((compB as any).needs_expenses || 0) >= 0 ? '+' : ''}
                        ৳{(((compA as any).needs_expenses || 0) - ((compB as any).needs_expenses || 0)).toLocaleString()}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-zinc-700">Lifestyle Wants</td>
                      <td className="py-2.5 px-4 text-right font-bold">৳{((compA as any).wants_expenses || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold">৳{((compB as any).wants_expenses || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-zinc-600">
                        {((compA as any).wants_expenses || 0) - ((compB as any).wants_expenses || 0) >= 0 ? '+' : ''}
                        ৳{(((compA as any).wants_expenses || 0) - ((compB as any).wants_expenses || 0)).toLocaleString()}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-zinc-700">Total Living Expenses</td>
                      <td className="py-2.5 px-4 text-right font-bold text-rose-700">৳{compA.total_expenses_bdt.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-rose-700">৳{compB.total_expenses_bdt.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-zinc-600">
                        {compA.total_expenses_bdt - compB.total_expenses_bdt >= 0 ? '+' : ''}
                        ৳{(compA.total_expenses_bdt - compB.total_expenses_bdt).toLocaleString()}
                      </td>
                    </tr>

                    <tr className="bg-emerald-50/30">
                      <td className="py-2.5 px-4 font-bold text-emerald-900">Net Disposable Surplus</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-900">৳{compA.net_surplus_bdt.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-900">৳{compB.net_surplus_bdt.toLocaleString()}</td>
                      <td className={`py-2.5 px-4 text-right font-bold ${compA.net_surplus_bdt >= compB.net_surplus_bdt ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {compA.net_surplus_bdt - compB.net_surplus_bdt >= 0 ? '+' : ''}
                        ৳{(compA.net_surplus_bdt - compB.net_surplus_bdt).toLocaleString()}
                      </td>
                    </tr>

                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-zinc-700">Savings Rate %</td>
                      <td className="py-2.5 px-4 text-right font-bold">{compA.savings_rate_pct}%</td>
                      <td className="py-2.5 px-4 text-right font-bold">{compB.savings_rate_pct}%</td>
                      <td className={`py-2.5 px-4 text-right font-bold ${compA.savings_rate_pct >= compB.savings_rate_pct ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {compA.savings_rate_pct - compB.savings_rate_pct >= 0 ? '+' : ''}
                        {compA.savings_rate_pct - compB.savings_rate_pct}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-500">
              Please select two scenarios above to compare them side-by-side.
            </div>
          )}
        </div>
      )}

      {/* SAVE SCENARIO MODAL */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div
            style={{
              backgroundColor: theme.colors.bgCard,
              borderRadius: theme.radius.xl,
            }}
            className="w-full max-w-md border border-zinc-200 p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                <Save className="w-4 h-4 text-blue-600" />
                <span>Save Calculation to History</span>
              </h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveToHistory} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Scenario Title</label>
                <input
                  type="text"
                  required
                  value={saveScenarioName}
                  onChange={(e) => setSaveScenarioName(e.target.value)}
                  placeholder="e.g. Q3 Promotion + New Rent"
                  className="w-full px-3 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Notes / Assumptions (Optional)</label>
                <textarea
                  rows={3}
                  value={saveScenarioNotes}
                  onChange={(e) => setSaveScenarioNotes(e.target.value)}
                  placeholder="e.g. Assumes 10% tax bracket, ৳25k house rent, and ৳10k side gig."
                  className="w-full px-3 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Summary Preview */}
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-xs space-y-1">
                <div className="flex justify-between text-zinc-600">
                  <span>Gross: ৳{grossIncome.toLocaleString()}</span>
                  <span>Net In-Hand: ৳{netIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Expenses: ৳{totalPlannedOutflows.toLocaleString()}</span>
                  <span className={netSurplus >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                    Leftover: ৳{netSurplus.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingHistory}
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: theme.colors.accentText,
                    borderRadius: theme.radius.md,
                  }}
                  className="px-4 py-1.5 text-xs font-semibold hover:opacity-90 cursor-pointer transition-opacity"
                >
                  {savingHistory ? 'Saving...' : 'Save Calculation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
